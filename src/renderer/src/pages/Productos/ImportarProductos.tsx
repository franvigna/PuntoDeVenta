import React, { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { ProductoForm, TipoCosto, UnidadPeso } from '../../types'
import styles from './ImportarProductos.module.scss'
const TIPOS_VALIDOS: TipoCosto[] = ['unidad', 'peso']
const UNIDADES_VALIDAS: UnidadPeso[] = ['kg', '100g']

interface FilaParseada {
  index: number
  descripcionRaw: string
  errores: string[]
  form: ProductoForm | null
}

function normalizarFila(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().trim()
    if (v instanceof Date) {
      const y = v.getFullYear()
      const m = String(v.getMonth() + 1).padStart(2, '0')
      const d = String(v.getDate()).padStart(2, '0')
      result[key] = `${y}-${m}-${d}`
    } else {
      result[key] = v != null ? String(v).trim() : ''
    }
  }
  return result
}

function col(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== '') return row[a]
  }
  return ''
}

function parsearFecha(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m = val.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return val
}

function parsearFila(raw: Record<string, unknown>, index: number): FilaParseada {
  const row = normalizarFila(raw)

  const descripcion = col(row, 'descripcion', 'description', 'nombre', 'name', 'producto')
  const tipo_costo = col(row, 'tipo_costo', 'tipo', 'type') as TipoCosto
  const costoStr = col(row, 'costo', 'precio_costo', 'cost', 'precio')
  const costo = parseFloat(costoStr)
  const grupo = col(row, 'grupo', 'categoria', 'group', 'category').trim().toLowerCase()  
  const rentaStr = col(row, 'renta', 'margen', 'margin', 'ganancia')
  const pvStr = col(row, 'precio_venta', 'precio venta', 'pv', 'precio de venta')
  let renta = rentaStr !== '' ? parseFloat(rentaStr) : NaN
  if (isNaN(renta)) {
    const pv = parseFloat(pvStr)
    const c = parseFloat(costoStr)
    renta = (!isNaN(pv) && !isNaN(c) && c > 0 && pv > 0)
      ? parseFloat(((pv / c - 1) * 100).toFixed(2))
      : 0
  }
  const unidad_peso = col(row, 'unidad_peso', 'unidad', 'unit') as UnidadPeso
  const codRaw = col(row, 'cod', 'codigo', 'code', 'codigo_barras', 'barcode', 'ean', 'codigo_de_barras')
  const cod = codRaw ? codRaw.padStart(4, '0') : ''
  const marca = col(row, 'marca', 'brand')
  const vencimiento = parsearFecha(col(row, 'vencimiento', 'expiry', 'fecha_vencimiento', 'vence'))

  const errores: string[] = []
  if (!descripcion) errores.push('Descripción requerida')
  if (!TIPOS_VALIDOS.includes(tipo_costo)) errores.push(`tipo_costo inválido: "${tipo_costo}" (debe ser "unidad" o "peso")`)
  if (isNaN(costo) || costo <= 0) errores.push('Costo debe ser un número mayor a 0')
  if (!grupo) errores.push('Categoría / grupo requerido')  
  if (tipo_costo === 'peso' && !UNIDADES_VALIDAS.includes(unidad_peso)) errores.push(`unidad_peso inválida: "${unidad_peso}" (debe ser "kg" o "100g")`)
  if (!isNaN(renta) && renta < 0) errores.push('Renta no puede ser negativa')

  if (errores.length > 0) {
    return { index, descripcionRaw: descripcion || `Fila ${index + 2}`, errores, form: null }
  }

  return {
    index,
    descripcionRaw: descripcion,
    errores: [],
    form: {
      cod,
      descripcion,
      tipo_costo,
      costo,
      unidad_peso: tipo_costo === 'peso' ? unidad_peso : null,
      renta: isNaN(renta) ? 0 : renta,
      grupo,
      marca: marca || null,
      vencimiento: vencimiento || null,
    },
  }
}

interface Props {
  onImportado: () => void
  onCerrar: () => void
}

export default function ImportarProductos({ onImportado, onCerrar }: Props): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [filas, setFilas] = useState<FilaParseada[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState<{
    importados: number
    actualizados: number
    ignorados: number
    errores: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const procesarArchivo = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target!.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        if (rows.length === 0) {
          alert('El archivo está vacío o no tiene datos en la primera hoja.')
          return
        }
        setFilas(rows.map(parsearFila))
        setResultado(null)
      } catch {
        alert('Error al leer el archivo. Asegurate de que sea un Excel válido (.xlsx, .xls).')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
        procesarArchivo(file)
      } else {
        alert('Solo se aceptan archivos Excel (.xlsx, .xls) o CSV.')
      }
    },
    [procesarArchivo]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
    e.target.value = ''
  }

  const handleImportar = async () => {
    if (!filas) return
    const validas = filas.filter((f) => f.form !== null).map((f) => f.form!)
    if (validas.length === 0) return
    setImporting(true)
    try {
      const res = await window.electronAPI.productos.importar(validas)
      setResultado(res)
      onImportado()
    } catch (err) {
      alert(`Error al importar: ${(err as Error).message}`)
    } finally {
      setImporting(false)
    }
  }

  const validas = filas ? filas.filter((f) => f.form !== null) : []
  const invalidas = filas ? filas.filter((f) => f.form === null) : []

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Importar desde Excel</h2>
          <button className={styles.closeBtn} onClick={onCerrar} type="button">
            ✕
          </button>
        </div>

        {resultado ? (
          <div className={styles.resultado}>
            <div className={styles.resultadoOk}>
              ✓ {resultado.importados} producto{resultado.importados !== 1 ? 's' : ''} nuevo
              {resultado.importados !== 1 ? 's' : ''} importado
              {resultado.importados !== 1 ? 's' : ''}.
            </div>

            <div className={styles.resultadoOk}>
              ↻ {resultado.actualizados} producto{resultado.actualizados !== 1 ? 's' : ''} actualizado
              {resultado.actualizados !== 1 ? 's' : ''}.
            </div>

            <div className={styles.resultadoOk}>
              • {resultado.ignorados} producto{resultado.ignorados !== 1 ? 's' : ''} ignorado
              {resultado.ignorados !== 1 ? 's' : ''} por no tener cambios.
            </div>

            {resultado.errores.length > 0 && (
              <div className={styles.resultadoErrores}>
                <div className={styles.resultadoErroresTitle}>
                  {resultado.errores.length} fila{resultado.errores.length !== 1 ? 's' : ''} con error:
                </div>
                {resultado.errores.map((e, i) => (
                  <div key={i} className={styles.resultadoErrorItem}>• {e}</div>
                ))}
              </div>
            )}

            <button className={styles.btnPrimary} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : !filas ? (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={styles.dropIcon}>↓</div>
            <div className={styles.dropTitle}>Arrastrá tu archivo Excel aquí</div>
            <div className={styles.dropSub}>o hacé click para seleccionarlo</div>
            <div className={styles.dropFormats}>.xlsx · .xls · .csv</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <span className={styles.summaryOk}>✓ {validas.length} válido{validas.length !== 1 ? 's' : ''}</span>
              {invalidas.length > 0 && (
                <span className={styles.summaryError}>
                  ✗ {invalidas.length} con error{invalidas.length !== 1 ? 'es' : ''}
                </span>
              )}
              <button className={styles.btnSecondary} onClick={() => setFilas(null)} type="button">
                Cambiar archivo
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                    <th>Grupo</th>
                    <th style={{ textAlign: 'right' }}>Renta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.index} className={fila.form ? '' : styles.rowError}>
                      <td className={styles.numCell}>{fila.index + 2}</td>
                      <td>{fila.descripcionRaw || <em className={styles.muted}>—</em>}</td>
                      <td>{fila.form?.tipo_costo || <em className={styles.muted}>—</em>}</td>
                      <td className={styles.numCell}>
                        {fila.form ? `$${fila.form.costo.toFixed(2)}` : <em className={styles.muted}>—</em>}
                      </td>
                      <td>{fila.form?.grupo || <em className={styles.muted}>—</em>}</td>
                      <td className={styles.numCell}>
                        {fila.form ? `${fila.form.renta}%` : <em className={styles.muted}>—</em>}
                      </td>
                      <td>
                        {fila.form ? (
                          <span className={styles.badgeOk}>Válido</span>
                        ) : (
                          <div className={styles.errorList}>
                            {fila.errores.map((err, i) => (
                              <div key={i} className={styles.errorItem}>• {err}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.footer}>
              <button className={styles.btnCancel} onClick={onCerrar} type="button">
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleImportar}
                disabled={importing || validas.length === 0}
                type="button"
              >
                {importing
                  ? 'Importando...'
                  : `Importar ${validas.length} producto${validas.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
