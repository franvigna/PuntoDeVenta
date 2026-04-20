import React, { useState, useEffect, useCallback } from 'react'
import { Venta, VentaDetalle, FiltrosHistorial, MetodoPago } from '../../types'
import styles from './HistorialPage.module.scss'

const METODO_LABELS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  )
}

export default function HistorialPage(): JSX.Element {
  const [ventas, setVentas] = useState<(Venta & { num_items: number })[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosHistorial>({ desde: '', hasta: '', metodo: 'todos' })
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const cargarVentas = useCallback(async () => {
    setCargando(true)
    try {
      const res = await window.electronAPI.ventas.getAll(filtros)
      setVentas(res)
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => { cargarVentas() }, [])

  const abrirDetalle = async (id: number) => {
    setCargandoDetalle(true)
    setDetalle(null)
    try {
      const d = await window.electronAPI.ventas.getDetalle(id)
      setDetalle(d)
    } finally {
      setCargandoDetalle(false)
    }
  }

  const cerrarDetalle = () => setDetalle(null)

  const totalVentas = ventas.reduce((s, v) => s + v.total, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Historial de Ventas</h2>
          {ventas.length > 0 && (
            <div className={styles.resumenBadge}>
              {ventas.length} venta{ventas.length !== 1 ? 's' : ''} · Total: ${totalVentas.toFixed(2)}
            </div>
          )}
        </div>

        <div className={styles.filtros}>
          <span className={styles.filtroLabel}>Desde</span>
          <input
            className={styles.filtroInput}
            type="date"
            value={filtros.desde}
            onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
          <span className={styles.filtroLabel}>Hasta</span>
          <input
            className={styles.filtroInput}
            type="date"
            value={filtros.hasta}
            onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
            style={{ colorScheme: 'dark' }}
          />
          <select
            className={styles.filtroSelect}
            value={filtros.metodo}
            onChange={e => setFiltros(f => ({ ...f, metodo: e.target.value }))}
          >
            <option value="todos">Todos los medios</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
          <button className={styles.btnBuscar} onClick={cargarVentas} type="button">
            Buscar
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {cargando ? (
          <div className={styles.empty}>Cargando...</div>
        ) : ventas.length === 0 ? (
          <div className={styles.empty}>No hay ventas para los filtros seleccionados</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Medio de pago</th>
                <th className={styles.numCol}>Ítems</th>
                <th className={styles.numCol}>Descuento</th>
                <th className={styles.numCol}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id} onClick={() => abrirDetalle(v.id)}>
                  <td className={styles.idCol}>#{v.id}</td>
                  <td>{formatFecha(v.fecha)}</td>
                  <td>
                    <span className={`${styles.metodoBadge} ${styles[v.metodo_pago]}`}>
                      {METODO_LABELS[v.metodo_pago]}
                    </span>
                  </td>
                  <td className={styles.numCol}>{v.num_items}</td>
                  <td className={styles.numCol}>{v.descuento > 0 ? `-$${v.descuento.toFixed(2)}` : '—'}</td>
                  <td className={styles.numCol}>${v.total.toFixed(2)}</td>
                  <td>
                    <button
                      className={styles.btnVer}
                      onClick={e => { e.stopPropagation(); abrirDetalle(v.id) }}
                      type="button"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de detalle */}
      {(detalle || cargandoDetalle) && (
        <div className={styles.overlay} onClick={cerrarDetalle}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{detalle ? `Venta #${detalle.id}` : 'Cargando...'}</h3>
              <button className={styles.closeBtn} onClick={cerrarDetalle} type="button">✕</button>
            </div>

            {cargandoDetalle || !detalle ? (
              <div className={styles.empty}>Cargando...</div>
            ) : (
              <>
                <div className={styles.modalMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Fecha</span>
                    <span className={styles.metaValue}>{formatFecha(detalle.fecha)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Medio de pago</span>
                    <span className={`${styles.metodoBadge} ${styles[detalle.metodo_pago]}`}>
                      {METODO_LABELS[detalle.metodo_pago]}
                    </span>
                  </div>
                  {detalle.descuento > 0 && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Descuento</span>
                      <span className={styles.metaValue}>-${detalle.descuento.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Total</span>
                    <span className={styles.metaTotal}>${detalle.total.toFixed(2)}</span>
                  </div>
                  {detalle.monto_recibido > 0 && (
                    <>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Recibido</span>
                        <span className={styles.metaValue}>${detalle.monto_recibido.toFixed(2)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Vuelto</span>
                        <span className={styles.metaValue}>${detalle.vuelto.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.modalItems}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>Cod</th>
                        <th>Producto</th>
                        <th style={{ textAlign: 'right' }}>Cantidad</th>
                        <th style={{ textAlign: 'right' }}>P. Venta</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map(item => (
                        <tr key={item.id}>
                          <td className={styles.codCell}>{item.cod}</td>
                          <td>{item.descripcion}</td>
                          <td style={{ textAlign: 'right' }}>{item.cantidad}</td>
                          <td style={{ textAlign: 'right' }}>${item.precio_unitario.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.btnCerrar} onClick={cerrarDetalle} type="button">
                    Cerrar
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
