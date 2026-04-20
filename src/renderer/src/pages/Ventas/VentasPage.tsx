import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Categoria, Producto, MetodoPago, CrearVentaInput } from '../../types'
import styles from './VentasPage.module.scss'

interface CarritoItem {
  tipo: 'producto' | 'manual'
  producto: Producto | null
  descripcion: string
  cod: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad: string
}

const METODO_LABELS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

const round2 = (n: number) => parseFloat(n.toFixed(2))
const precioVenta = (p: Producto) => round2(p.costo * (1 + p.renta / 100))

type EstadoModal = 'pago' | 'exito'

export default function VentasPage(): JSX.Element {
  // búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [mostrarDrop, setMostrarDrop] = useState(false)
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('')

  // entrada manual
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [manualCategoria, setManualCategoria] = useState('')
  const [manualMonto, setManualMonto] = useState('')
  const [manualVisible, setManualVisible] = useState(false)

  // carrito
  const [carrito, setCarrito] = useState<CarritoItem[]>([])

  // modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [estadoModal, setEstadoModal] = useState<EstadoModal>('pago')
  const [ventaId, setVentaId] = useState<number | null>(null)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const montoRef = useRef<HTMLInputElement>(null)
  const manualMontoRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  useEffect(() => {
    window.electronAPI.categorias.getAll().then(cats => {
      setCategorias(cats)
      if (cats.length > 0) setManualCategoria(cats[0].nombre)
    })
  }, [])

  useEffect(() => {
    if (seleccionado) setTimeout(() => cantidadRef.current?.focus(), 50)
  }, [seleccionado])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = busqueda.trim()
    if (!q) { setResultados([]); setMostrarDrop(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await window.electronAPI.productos.buscar(q)
      setResultados(res)
      setMostrarDrop(res.length > 0)
    }, 180)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  useEffect(() => {
    if (modalAbierto && estadoModal === 'pago') {
      setTimeout(() => montoRef.current?.focus(), 80)
    }
  }, [modalAbierto, estadoModal])

  /* ── Carrito ── */
  const seleccionarProducto = (p: Producto) => {
    setSeleccionado(p)
    setBusqueda('')
    setResultados([])
    setMostrarDrop(false)
    setCantidad('')
  }

  const agregarAlCarrito = useCallback(() => {
    if (!seleccionado) return
    const raw = parseFloat(cantidad)
    if (isNaN(raw) || raw <= 0) return
    const cant = seleccionado.tipo_costo === 'unidad' ? Math.round(raw) : raw
    const pv = precioVenta(seleccionado)
    const unidad = seleccionado.tipo_costo === 'peso' ? (seleccionado.unidad_peso ?? 'kg') : 'u'
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.tipo === 'producto' && i.producto?.id === seleccionado.id)
      if (idx >= 0) {
        const updated = [...prev]
        const nuevaCant = round2(updated[idx].cantidad + cant)
        updated[idx] = { ...updated[idx], cantidad: nuevaCant, subtotal: round2(nuevaCant * pv) }
        return updated
      }
      return [...prev, {
        tipo: 'producto',
        producto: seleccionado,
        descripcion: seleccionado.descripcion,
        cod: seleccionado.cod,
        cantidad: cant,
        precio_unitario: pv,
        subtotal: round2(cant * pv),
        unidad,
      }]
    })
    setSeleccionado(null)
    setCantidad('')
    searchRef.current?.focus()
  }, [seleccionado, cantidad])

  const agregarManual = useCallback(() => {
    const monto = parseFloat(manualMonto)
    if (!manualCategoria || isNaN(monto) || monto <= 0) return
    const desc = manualCategoria.charAt(0).toUpperCase() + manualCategoria.slice(1)
    setCarrito(prev => [...prev, {
      tipo: 'manual',
      producto: null,
      descripcion: desc,
      cod: null,
      cantidad: 1,
      precio_unitario: monto,
      subtotal: monto,
      unidad: 'u',
    }])
    setManualMonto('')
    manualMontoRef.current?.focus()
  }, [manualCategoria, manualMonto])

  const eliminarItem = (idx: number) => setCarrito(prev => prev.filter((_, i) => i !== idx))

  const editarCantidad = (idx: number, val: string) => {
    const raw = parseFloat(val)
    if (isNaN(raw) || raw <= 0) return
    setCarrito(prev => {
      const updated = [...prev]
      const item = updated[idx]
      const cant = item.tipo === 'producto' && item.producto?.tipo_costo === 'unidad'
        ? Math.round(raw) : raw
      updated[idx] = { ...item, cantidad: cant, subtotal: round2(cant * item.precio_unitario) }
      return updated
    })
  }

  const totalVenta = round2(carrito.reduce((s, i) => s + i.subtotal, 0))

  const limpiarVenta = () => {
    setCarrito([])
    setSeleccionado(null)
    setCantidad('')
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  /* ── Modal ── */
  const abrirModal = () => {
    if (carrito.length === 0) return
    setMetodoPago('efectivo')
    setMontoRecibido('')
    setEstadoModal('pago')
    setVentaId(null)
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    if (estadoModal === 'exito') limpiarVenta()
  }

  const montoNum = parseFloat(montoRecibido) || 0
  const vuelto = round2(Math.max(0, montoNum - totalVenta))
  const falta = metodoPago === 'efectivo' && montoNum > 0 && montoNum < totalVenta

  const seleccionarMetodo = (m: MetodoPago) => {
    setMetodoPago(m)
    setMontoRecibido(m !== 'efectivo' ? totalVenta.toFixed(2) : '')
  }

  const confirmarVenta = async () => {
    if (metodoPago === 'efectivo' && montoNum < totalVenta) {
      alert(`El monto recibido ($${montoNum.toFixed(2)}) es menor al total ($${totalVenta.toFixed(2)})`)
      return
    }
    setConfirmando(true)
    try {
      const data: CrearVentaInput = {
        items: carrito.map(i => ({
          producto_id: i.producto?.id ?? null,
          cod: i.cod,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.subtotal,
        })),
        total: totalVenta,
        descuento: 0,
        metodo_pago: metodoPago,
        monto_recibido: montoNum,
        vuelto: metodoPago === 'efectivo' ? vuelto : 0,
      }
      const { id } = await window.electronAPI.ventas.crear(data)
      setVentaId(id)
      setEstadoModal('exito')
    } catch (err) {
      alert(`Error al confirmar la venta: ${(err as Error).message}`)
    } finally {
      setConfirmando(false)
    }
  }

  /* ── Render ── */
  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* Panel izquierdo */}
        <div className={styles.panelLeft}>
          <div className={styles.searchWrap}>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código o descripción..."
              autoComplete="off"
              onKeyDown={e => {
                if (e.key === 'Escape') { setBusqueda(''); setResultados([]); setMostrarDrop(false) }
                if (e.key === 'Enter' && resultados.length === 1) seleccionarProducto(resultados[0])
              }}
            />
            {mostrarDrop && (
              <div className={styles.dropdown}>
                {resultados.map(p => (
                  <button key={p.id} className={styles.dropItem} onClick={() => seleccionarProducto(p)} type="button">
                    <span className={styles.dropCod}>{p.cod}</span>
                    <span className={styles.dropNombre}>{p.descripcion}</span>
                    <span className={styles.dropPrecio}>
                      ${precioVenta(p).toFixed(2)}/{p.tipo_costo === 'peso' ? (p.unidad_peso ?? 'kg') : 'u'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Entrada manual rápida */}
          <div className={styles.manualWrap}>
            <button
              className={`${styles.manualToggle} ${manualVisible ? styles.manualToggleActive : ''}`}
              onClick={() => setManualVisible(v => !v)}
              type="button"
            >
              <span className={styles.manualLabel}>Entrada rápida</span>
              <span className={styles.manualToggleIcon}>{manualVisible ? '▲' : '▼'}</span>
            </button>
            {manualVisible && <div className={styles.manualRow}>
              <select
                className={styles.manualSelect}
                value={manualCategoria}
                onChange={e => setManualCategoria(e.target.value)}
              >
                {categorias.map(c => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre.charAt(0).toUpperCase() + c.nombre.slice(1)}
                  </option>
                ))}
              </select>
              <div className={styles.manualMontoWrap}>
                <span>$</span>
                <input
                  ref={manualMontoRef}
                  className={styles.manualMontoInput}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualMonto}
                  placeholder="Monto total"
                  onChange={e => setManualMonto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarManual() }}
                />
              </div>
              <button
                className={styles.btnAgregarManual}
                onClick={agregarManual}
                type="button"
                disabled={!manualCategoria || !manualMonto}
              >
                Agregar
              </button>
            </div>}
          </div>

          {seleccionado && (
            <div className={styles.staging}>
              <div className={styles.stagingInfo}>
                <div className={styles.stagingNombre}>{seleccionado.descripcion}</div>
                <div className={styles.stagingPrecio}>
                  ${precioVenta(seleccionado).toFixed(2)} / {seleccionado.tipo_costo === 'peso' ? (seleccionado.unidad_peso ?? 'kg') : 'u'}
                </div>
              </div>
              <div className={styles.stagingRow}>
                <input
                  ref={cantidadRef}
                  className={styles.cantidadInput}
                  type="number"
                  min={seleccionado.tipo_costo === 'peso' ? '0.001' : '1'}
                  step={seleccionado.tipo_costo === 'peso' ? '0.001' : '1'}
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  placeholder={seleccionado.tipo_costo === 'peso' ? 'Kg' : 'Cant'}
                  onKeyDown={e => { if (e.key === 'Enter') agregarAlCarrito() }}
                />
                <button className={styles.btnAgregar} onClick={agregarAlCarrito} type="button">
                  Agregar
                </button>
                <button className={styles.btnCancelarStaging} onClick={() => { setSeleccionado(null); setCantidad('') }} type="button">
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className={styles.carritoWrap}>
            {carrito.length === 0 ? (
              <div className={styles.carritoVacio}>No hay productos en la venta</div>
            ) : (
              <table className={styles.carritoTable}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className={styles.numCol}>Cantidad</th>
                    <th className={styles.numCol}>P. Venta</th>
                    <th className={styles.numCol}>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item, idx) => (
                    <tr key={`${item.tipo}-${idx}`}>
                      <td>
                        <div className={styles.itemNombre}>{item.descripcion}</div>
                        {item.cod
                          ? <div className={styles.itemCod}>{item.cod}</div>
                          : <div className={`${styles.itemCod} ${styles.itemManual}`}>Manual</div>
                        }
                      </td>
                      <td className={styles.numCol}>
                        {item.tipo === 'manual' ? (
                          <span className={styles.itemCod}>—</span>
                        ) : (
                          <>
                            <input
                              className={styles.cantidadInline}
                              type="number"
                              min={item.producto?.tipo_costo === 'peso' ? '0.001' : '1'}
                              step={item.producto?.tipo_costo === 'peso' ? '0.001' : '1'}
                              value={item.cantidad}
                              onChange={e => editarCantidad(idx, e.target.value)}
                            />
                            <span className={styles.unidadLabel}>{item.unidad}</span>
                          </>
                        )}
                      </td>
                      <td className={styles.numCol}>${item.precio_unitario.toFixed(2)}</td>
                      <td className={styles.numCol}>${item.subtotal.toFixed(2)}</td>
                      <td>
                        <button className={styles.btnEliminar} onClick={() => eliminarItem(idx)} type="button">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className={styles.panelRight}>
          <div className={styles.totalPanel}>
            <div className={styles.totalLabel}>Total</div>
            <div className={styles.totalMonto}>${totalVenta.toFixed(2)}</div>
            {carrito.length > 0 && (
              <div className={styles.totalItems}>
                {carrito.length} producto{carrito.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className={styles.acciones}>
            <button
              className={styles.btnConfirmar}
              onClick={abrirModal}
              disabled={carrito.length === 0}
              type="button"
            >
              Confirmar
            </button>
            <button
              className={styles.btnLimpiar}
              onClick={limpiarVenta}
              disabled={carrito.length === 0 && !seleccionado}
              type="button"
            >
              Nueva venta
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal de pago / éxito ── */}
      {modalAbierto && (
        <div className={styles.overlay} onClick={estadoModal === 'exito' ? cerrarModal : undefined}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>

            {estadoModal === 'pago' ? (
              <>
                <div className={styles.modalHeader}>
                  <h2>Confirmar venta</h2>
                  <button className={styles.modalClose} onClick={cerrarModal} type="button">✕</button>
                </div>

                <div className={styles.modalBody}>
                  <table className={styles.resumenTable}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className={styles.rNumCol}>Cant.</th>
                        <th className={styles.rNumCol}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrito.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <span>{item.descripcion}</span>
                            {item.cod && <span className={styles.resumenCod}> · {item.cod}</span>}
                          </td>
                          <td className={styles.rNumCol}>
                            {item.tipo === 'manual' ? '—' : `${item.cantidad} ${item.unidad}`}
                          </td>
                          <td className={styles.rNumCol}>${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className={styles.resumenTotal}>
                    <span>Total</span>
                    <span>${totalVenta.toFixed(2)}</span>
                  </div>

                  <div className={styles.separator} />

                  <div className={styles.pagoSeccion}>
                    <div className={styles.pagoSeccionLabel}>Medio de pago</div>
                    <div className={styles.metodos}>
                      {(['efectivo', 'transferencia', 'tarjeta'] as MetodoPago[]).map(m => (
                        <button
                          key={m}
                          className={`${styles.metodBtn} ${metodoPago === m ? styles.metodActivo : ''}`}
                          onClick={() => seleccionarMetodo(m)}
                          type="button"
                        >
                          {METODO_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.pagoSeccion}>
                    <div className={styles.pagoSeccionLabel}>¿Con cuánto paga?</div>
                    <div className={styles.montoRow}>
                      <div className={styles.montoInputWrap}>
                        <span>$</span>
                        <input
                          ref={montoRef}
                          className={styles.montoInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={montoRecibido}
                          onChange={e => setMontoRecibido(e.target.value)}
                          placeholder={totalVenta.toFixed(2)}
                          onKeyDown={e => { if (e.key === 'Enter' && !confirmando) confirmarVenta() }}
                        />
                      </div>
                      <button
                        className={styles.btnPagaJusto}
                        onClick={() => setMontoRecibido(totalVenta.toFixed(2))}
                        type="button"
                      >
                        Paga justo
                      </button>
                    </div>

                    {montoNum > 0 && (
                      <div className={`${styles.vueltoRow} ${falta ? styles.vueltoNeg : ''}`}>
                        <span>{falta ? 'Falta' : 'Vuelto'}</span>
                        <span>${falta ? round2(totalVenta - montoNum).toFixed(2) : vuelto.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.btnVolver} onClick={cerrarModal} type="button">
                    Volver al carrito
                  </button>
                  <button
                    className={styles.btnConfirmarModal}
                    onClick={confirmarVenta}
                    disabled={confirmando}
                    type="button"
                  >
                    {confirmando ? 'Guardando...' : 'Confirmar venta'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`${styles.modalHeader} ${styles.modalHeaderExito}`}>
                  <div className={styles.exitoTitulo}>
                    <span className={styles.exitoCheck}>✓</span>
                    Venta #{ventaId} registrada
                  </div>
                </div>

                <div className={styles.modalBody}>
                  <table className={styles.resumenTable}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className={styles.rNumCol}>Cant.</th>
                        <th className={styles.rNumCol}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrito.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <span>{item.descripcion}</span>
                            {item.cod && <span className={styles.resumenCod}> · {item.cod}</span>}
                          </td>
                          <td className={styles.rNumCol}>
                            {item.tipo === 'manual' ? '—' : `${item.cantidad} ${item.unidad}`}
                          </td>
                          <td className={styles.rNumCol}>${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className={styles.resumenTotal}>
                    <span>Total</span>
                    <span>${totalVenta.toFixed(2)}</span>
                  </div>

                  <div className={styles.separator} />

                  <div className={styles.exitoPago}>
                    <div className={styles.exitoPagoRow}>
                      <span>Medio de pago</span>
                      <span className={`${styles.metodoBadge} ${styles[metodoPago]}`}>
                        {METODO_LABELS[metodoPago]}
                      </span>
                    </div>
                    {montoNum > 0 && (
                      <>
                        <div className={styles.exitoPagoRow}>
                          <span>Recibido</span>
                          <span>${montoNum.toFixed(2)}</span>
                        </div>
                        {metodoPago === 'efectivo' && (
                          <div className={`${styles.exitoPagoRow} ${styles.exitoVuelto}`}>
                            <span>Vuelto</span>
                            <span>${vuelto.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.btnConfirmarModal} onClick={cerrarModal} type="button">
                    Nueva venta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
