import React, { useState, useEffect, useCallback } from 'react'
import { Producto, GrupoProducto } from '../../types'
import ProductoModal from './ProductoModal'
import ImportarProductos from './ImportarProductos'
import styles from './Productos.module.scss'

const capLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function ProductosPage(): JSX.Element {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterGrupo, setFilterGrupo] = useState<GrupoProducto | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [importarOpen, setImportarOpen] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.electronAPI.productos.getAll()
      setProductos(data)
    } catch (err) {
      setError(`Error al cargar productos: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => { setEditando(null); setModalOpen(true) }
  const abrirEdicion = (p: Producto) => { setEditando(p); setModalOpen(true) }

  const eliminar = async (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.descripcion}"?`)) return
    try {
      await window.electronAPI.productos.delete(p.id)
      await cargar()
    } catch (err) {
      alert(`Error: ${(err as Error).message}`)
    }
  }

  const eliminarTodos = async () => {
    if (productos.length === 0) {
      alert('No hay productos para eliminar.')
      return
    }

    const confirmar = confirm(
      `¿Seguro que querés eliminar TODOS los productos?\n\nSe van a borrar ${productos.length} registro${productos.length !== 1 ? 's' : ''} y esta acción no se puede deshacer.`
    )

    if (!confirmar) return

    try {
      await window.electronAPI.productos.deleteAll()
      await cargar()
      alert('Todos los productos fueron eliminados correctamente.')
    } catch (err) {
      alert(`Error al eliminar todos los productos: ${(err as Error).message}`)
    }
  }

  const onModalGuardado = async () => {
    setModalOpen(false)
    setEditando(null)
    await cargar()
  }

  const filtrados = productos.filter(p => {
    const matchSearch =
      p.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      p.cod.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo_barras ?? '').includes(search)
    const matchGrupo = !filterGrupo || p.grupo === filterGrupo
    return matchSearch && matchGrupo
  })

  const formatCosto = (p: Producto) => {
    const val = `$${p.costo.toFixed(2)}`
    return p.tipo_costo === 'peso' ? `${val}/${p.unidad_peso}` : val
  }

  const precioVenta = (p: Producto) => {
    const pv = (p.costo * (1 + p.renta / 100)).toFixed(2)
    return p.tipo_costo === 'peso' ? `$${pv}/${p.unidad_peso}` : `$${pv}`
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Productos</h1>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por descripción o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={filterGrupo}
            onChange={e => setFilterGrupo(e.target.value as GrupoProducto | '')}
          >
            <option value="">Todos los grupos</option>
            <option value="carniceria">Carnicería</option>
            <option value="fiambreria">Fiambrería</option>
            <option value="granja">Granja</option>
          </select>

          <button className={styles.btnSecondary} onClick={() => setImportarOpen(true)}>
            Importar Excel
          </button>

          <button
            className={styles.btnDanger}
            onClick={eliminarTodos}
            disabled={productos.length === 0}
            type="button"
          >
            Vaciar productos
          </button>

          <button className={styles.btnPrimary} onClick={abrirNuevo}>
            + Nuevo Producto
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Cargando productos...</div>
      ) : filtrados.length === 0 ? (
        <div className={styles.empty}>
          {productos.length === 0
            ? 'No hay productos. Creá el primero con "+ Nuevo Producto".'
            : 'Ningún producto coincide con los filtros.'}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cód</th>
                <th>Descripción</th>
                <th>Grupo</th>
                <th style={{ textAlign: 'right' }}>Costo</th>
                <th style={{ textAlign: 'right' }}>Renta</th>
                <th style={{ textAlign: 'right' }}>P. Venta</th>
                <th>Marca</th>
                <th>Vencimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td className={styles.codCell}>{p.cod}</td>
                  <td className={styles.descCell}>{p.descripcion}</td>
                  <td>
                    <span className={`${styles.grupoBadge} ${styles[p.grupo]}`}>
                      {capLabel(p.grupo)}
                    </span>
                  </td>
                  <td className={styles.numCell}>{formatCosto(p)}</td>
                  <td className={styles.numCell}>{p.renta}%</td>
                  <td className={styles.numCell}>{precioVenta(p)}</td>
                  <td className={styles.mutedCell}>{p.marca || '—'}</td>
                  <td className={styles.mutedCell}>{p.vencimiento || '—'}</td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button className={styles.btnEdit} onClick={() => abrirEdicion(p)}>
                        Editar
                      </button>
                      <button className={styles.btnDelete} onClick={() => eliminar(p)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.footer}>
        {filtrados.length} producto{filtrados.length !== 1 ? 's' : ''}
        {(filterGrupo || search) ? ' (filtrado)' : ''}
      </div>

      {modalOpen && (
        <ProductoModal
          producto={editando}
          onGuardar={onModalGuardado}
          onCerrar={() => { setModalOpen(false); setEditando(null) }}
        />
      )}

      {importarOpen && (
        <ImportarProductos
          onImportado={cargar}
          onCerrar={() => setImportarOpen(false)}
        />
      )}
    </div>
  )
}