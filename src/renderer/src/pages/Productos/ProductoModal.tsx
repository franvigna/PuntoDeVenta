import React, { useState, useEffect } from 'react'
import { Producto, ProductoForm, TipoCosto, UnidadPeso, Categoria } from '../../types'
import styles from './Productos.module.scss'

interface Props {
  producto: Producto | null
  onGuardar: () => void
  onCerrar: () => void
}

interface FormState {
  cod: string
  descripcion: string
  tipo_costo: TipoCosto
  costo: number | ''
  unidad_peso: UnidadPeso
  renta: number | ''
  precio_venta: number | ''
  grupo: string
  marca: string
  vencimiento: string
}

const FORM_INICIAL: FormState = {
  cod: '',
  descripcion: '',
  tipo_costo: 'unidad',
  costo: '',
  unidad_peso: 'kg',
  renta: '',
  precio_venta: '',
  grupo: '',
  marca: '',
  vencimiento: '',
}

export default function ProductoModal({ producto, onGuardar, onCerrar }: Props): JSX.Element {
  const editando = Boolean(producto)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [autoCod, setAutoCod] = useState(!editando)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false)
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    window.electronAPI.categorias.getAll().then(setCategorias)
  }, [])

  useEffect(() => {
    if (producto) {
      setForm({
        cod: producto.cod,
        descripcion: producto.descripcion,
        tipo_costo: producto.tipo_costo,
        costo: producto.costo,
        unidad_peso: producto.unidad_peso ?? 'kg',
        renta: producto.renta,
        precio_venta: parseFloat((producto.costo * (1 + producto.renta / 100)).toFixed(2)),
        grupo: producto.grupo,
        marca: producto.marca ?? '',
        vencimiento: producto.vencimiento ?? '',
      })
      setAutoCod(false)
    } else {
      setForm(FORM_INICIAL)
      setAutoCod(true)
    }
  }, [producto])

  useEffect(() => {
    if (autoCod && !editando) {
      window.electronAPI.productos.getNextCod().then(cod => {
        setForm(f => ({ ...f, cod }))
      })
    }
  }, [autoCod, editando])

  const crearCategoria = async () => {
    const nombre = nuevaCategoria.trim().toLowerCase()
    if (!nombre) return

    const creada = await window.electronAPI.categorias.create(nombre)
    const nuevas = await window.electronAPI.categorias.getAll()
    setCategorias(nuevas)
    set('grupo', creada.nombre)
    setNuevaCategoria('')
    setMostrarNuevaCategoria(false)
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrores(e => ({ ...e, [key]: undefined }))
  }

  const setCosto = (val: number | '') => {
    const c = Number(val) || 0
    const r = Number(form.renta) || 0
    const pv = c > 0 ? parseFloat((c * (1 + r / 100)).toFixed(2)) : ''
    setForm(f => ({ ...f, costo: val, precio_venta: pv }))
    setErrores(e => ({ ...e, costo: undefined }))
  }

  const setRenta = (val: number | '') => {
    const c = Number(form.costo) || 0
    const r = Number(val) || 0
    const pv = c > 0 ? parseFloat((c * (1 + r / 100)).toFixed(2)) : ''
    setForm(f => ({ ...f, renta: val, precio_venta: pv }))
    setErrores(e => ({ ...e, renta: undefined }))
  }

  const setPrecioVenta = (val: number | '') => {
    const c = Number(form.costo) || 0
    const pv = Number(val)
    const r = c > 0 && pv > 0 ? parseFloat(((pv / c - 1) * 100).toFixed(2)) : ''
    setForm(f => ({ ...f, precio_venta: val, renta: r }))
    setErrores(e => ({ ...e, renta: undefined }))
  }

  const validar = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.cod.trim()) e.cod = 'Requerido'
    if (!form.descripcion.trim()) e.descripcion = 'Requerido'
    if (Number(form.costo) <= 0) e.costo = 'Debe ser mayor a 0'
    if (Number(form.renta) < 0) e.renta = 'No puede ser negativo'
    if (!form.grupo) e.grupo = 'Requerido'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      const data: ProductoForm = {
        cod: form.cod.trim(),
        descripcion: form.descripcion.trim(),
        tipo_costo: form.tipo_costo,
        costo: Number(form.costo),
        unidad_peso: form.tipo_costo === 'peso' ? form.unidad_peso : null,
        renta: Number(form.renta) || 0,
        grupo: form.grupo,
        marca: form.marca.trim() || null,
        vencimiento: form.vencimiento || null,
      }
      if (editando && producto) {
        await window.electronAPI.productos.update(producto.id, data)
      } else {
        await window.electronAPI.productos.create(data)
      }
      onGuardar()
    } catch (err) {
      alert(`Error al guardar: ${(err as Error).message}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2>{editando ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button className={styles.closeBtn} onClick={onCerrar} type="button">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Código */}
          <div className={styles.field}>
            <span className={styles.label}>Código</span>
            {!editando && (
              <div className={styles.codToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${autoCod ? styles.activeToggle : ''}`}
                  onClick={() => setAutoCod(true)}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${!autoCod ? styles.activeToggle : ''}`}
                  onClick={() => setAutoCod(false)}
                >
                  Manual
                </button>
              </div>
            )}
            <input
              className={`${styles.input} ${errores.cod ? styles.hasError : ''}`}
              type="text"
              value={form.cod}
              onChange={e => set('cod', e.target.value)}
              disabled={autoCod}
              placeholder="Ej: 0001 o código de barras"
            />
            {errores.cod && <span className={styles.errorMsg}>{errores.cod}</span>}
          </div>

          {/* Descripción */}
          <div className={styles.field}>
            <span className={styles.label}>Descripción *</span>
            <input
              className={`${styles.input} ${errores.descripcion ? styles.hasError : ''}`}
              type="text"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Nombre del producto"
            />
            {errores.descripcion && <span className={styles.errorMsg}>{errores.descripcion}</span>}
          </div>

          {/* Tipo de precio */}
          <div className={styles.field}>
            <span className={styles.label}>Tipo de costo</span>
            <div className={styles.radioGroup}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  checked={form.tipo_costo === 'unidad'}
                  onChange={() => set('tipo_costo', 'unidad')}
                />
                Por unidad
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  checked={form.tipo_costo === 'peso'}
                  onChange={() => set('tipo_costo', 'peso')}
                />
                Por peso
              </label>
            </div>
          </div>

          {/* Costo + Unidad peso (si aplica) + Renta + Precio venta */}
          <div className={`${styles.row} ${form.tipo_costo === 'peso' ? styles.cols3 : styles.cols2}`}>
            {/* Costo */}
            <div className={styles.field}>
              <span className={styles.label}>Costo *</span>
              <div className={`${styles.inputGroup} ${errores.costo ? styles.hasError : ''}`}>
                <span className={styles.inputAddon}>$</span>
                <input
                  className={styles.inputGroupInner}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo}
                  onChange={e => setCosto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              {errores.costo && <span className={styles.errorMsg}>{errores.costo}</span>}
            </div>

            {/* Por (kg/g) — solo si tipo_costo = 'peso' */}
            {form.tipo_costo === 'peso' && (
              <div className={styles.field}>
                <span className={styles.label}>Por</span>
                <select
                  className={styles.select}
                  value={form.unidad_peso}
                  onChange={e => set('unidad_peso', e.target.value as UnidadPeso)}
                >
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="100g">100 gramos</option>
                </select>
              </div>
            )}

            {/* Renta % */}
            <div className={styles.field}>
              <span className={styles.label}>Renta</span>
              <div className={`${styles.inputGroup} ${errores.renta ? styles.hasError : ''}`}>
                <input
                  className={styles.inputGroupInner}
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.renta}
                  onChange={e => setRenta(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0"
                />
                <span className={styles.inputAddon}>%</span>
              </div>
              {errores.renta && <span className={styles.errorMsg}>{errores.renta}</span>}
            </div>
          </div>

          {/* Precio de venta (editable — sincroniza con renta) */}
          <div className={styles.field}>
            <span className={styles.label}>Precio de venta</span>
            <div className={styles.inputGroup}>
              <span className={styles.inputAddon}>$</span>
              <input
                className={`${styles.inputGroupInner} ${styles.precioVentaInput}`}
                type="number"
                min="0"
                step="0.01"
                value={form.precio_venta}
                onChange={e => setPrecioVenta(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
              />
              {form.tipo_costo === 'peso' && (
                <span className={styles.inputAddon}>/{form.unidad_peso}</span>
              )}
            </div>
          </div>
            <div className={styles.field}>
              <span className={styles.label}>Categoría *</span>

              <select
                className={`${styles.select} ${errores.grupo ? styles.hasError : ''}`}
                value={form.grupo}
                onChange={e => set('grupo', e.target.value)}
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setMostrarNuevaCategoria(v => !v)}
                >
                  {mostrarNuevaCategoria ? 'Cancelar nueva categoría' : 'Agregar nueva categoría'}
                </button>
              </div>

              {mostrarNuevaCategoria && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <input
                    className={styles.input}
                    type="text"
                    value={nuevaCategoria}
                    onChange={e => setNuevaCategoria(e.target.value)}
                    placeholder="Ej: achuras"
                  />
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={crearCategoria}
                  >
                    Guardar
                  </button>
                </div>
              )}

              {errores.grupo && <span className={styles.errorMsg}>{errores.grupo}</span>}
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Marca <span className={styles.optional}>(opcional)</span>
              </span>
              <input
                className={styles.input}
                type="text"
                value={form.marca}
                onChange={e => set('marca', e.target.value)}
                placeholder="Ej: La Serenísima"
              />
            </div>

          {/* Vencimiento */}
          <div className={styles.field}>
            <span className={styles.label}>
              Vencimiento <span className={styles.optional}>(opcional)</span>
            </span>
            <input
              className={styles.input}
              type="date"
              value={form.vencimiento}
              onChange={e => set('vencimiento', e.target.value)}
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Botones */}
          <div className={styles.formFooter}>
            <button type="button" className={styles.btnCancel} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
