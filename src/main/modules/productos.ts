import { ipcMain } from 'electron'
import { queryAll, queryOne, execute, lastInsertId, executeRaw, runInTransaction, persist } from '../database'

function normalizarCategoria(nombre: string): string {
  return (nombre || '').trim().toLowerCase()
}

function asegurarCategoria(nombre: string): number {
  const nombreNormalizado = normalizarCategoria(nombre)
  if (!nombreNormalizado) {
    throw new Error('La categoría es requerida')
  }

  const existente = queryOne<{ id: number }>(
    `SELECT id FROM categorias WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1`,
    [nombreNormalizado]
  )

  if (existente) return existente.id

  executeRaw(`INSERT INTO categorias (nombre) VALUES (?)`, [nombreNormalizado])
  const row = queryOne<{ id: number }>(`SELECT last_insert_rowid() as id`)
  return row?.id ?? 0
}

export function registerProductosHandlers(): void {
  ipcMain.handle('productos:getAll', () => {
    return queryAll(
      `SELECT
        p.*,
        COALESCE(c.nombre, p.grupo) as grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.activo = 1
       ORDER BY p.descripcion`
    )
  })
  ipcMain.handle('categorias:getAll', () => {
    return queryAll<{ id: number; nombre: string }>(
      `SELECT id, nombre
       FROM categorias
       WHERE activo = 1
       ORDER BY nombre`
    )
  })

  ipcMain.handle('categorias:create', (_, nombre: string) => {
    const categoriaId = asegurarCategoria(nombre)
    persist()
    return queryOne<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM categorias WHERE id = ?`,
      [categoriaId]
    )
  })
  ipcMain.handle('productos:create', (_, data) => {
    const categoriaId = asegurarCategoria(data.grupo)

    execute(
      `INSERT INTO productos
        (cod, descripcion, tipo_costo, costo, unidad_peso, renta, grupo, categoria_id, marca, vencimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.cod,
        data.descripcion,
        data.tipo_costo,
        data.costo,
        data.tipo_costo === 'peso' ? (data.unidad_peso || 'kg') : null,
        data.renta,
        normalizarCategoria(data.grupo),
        categoriaId,
        data.marca || null,
        data.vencimiento || null,
      ]
    )

    const id = lastInsertId()

    return queryOne(
      `SELECT
        p.*,
        COALESCE(c.nombre, p.grupo) as grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = ?`,
      [id]
    )
  })

  ipcMain.handle('productos:update', (_, id: number, data) => {
    const categoriaId = asegurarCategoria(data.grupo)

    execute(
      `UPDATE productos SET
        cod = ?, descripcion = ?, tipo_costo = ?,
        costo = ?, unidad_peso = ?, renta = ?, grupo = ?, categoria_id = ?, marca = ?, vencimiento = ?
       WHERE id = ? AND activo = 1`,
      [
        data.cod,
        data.descripcion,
        data.tipo_costo,
        data.costo,
        data.tipo_costo === 'peso' ? (data.unidad_peso || 'kg') : null,
        data.renta,
        normalizarCategoria(data.grupo),
        categoriaId,
        data.marca || null,
        data.vencimiento || null,
        id,
      ]
    )

    return queryOne(
      `SELECT
        p.*,
        COALESCE(c.nombre, p.grupo) as grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = ?`,
      [id]
    )
  })
  ipcMain.handle('productos:delete', (_, id: number) => {
    execute('UPDATE productos SET activo = 0 WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('productos:deleteAll', () => {
    execute('DELETE FROM productos')
    return { success: true }
  })

  ipcMain.handle('productos:buscar', (_, query: string) => {
    const q = (query || '').toLowerCase().trim()
    if (!q) return []
    const contains = '%' + q + '%'
    return queryAll(
      `SELECT p.*, COALESCE(c.nombre, p.grupo) as grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.activo = 1 AND (
         LOWER(TRIM(p.cod)) = ?
         OR LOWER(p.cod) LIKE ?
         OR LOWER(p.descripcion) LIKE ?
       )
       ORDER BY
         CASE
           WHEN LOWER(TRIM(p.cod)) = ? THEN 0
           WHEN LOWER(p.cod) LIKE ? THEN 1
           ELSE 2
         END,
         p.descripcion
       LIMIT 20`,
      [q, contains, contains, q, contains]
    )
  })

  ipcMain.handle('productos:getNextCod', () => {
    const row = queryOne<{ next_cod: number }>(
      `SELECT COALESCE(MAX(CAST(cod AS INTEGER)), 0) + 1 AS next_cod
       FROM productos WHERE cod GLOB '[0-9]*'`
    )
    return String(row?.next_cod ?? 1).padStart(4, '0')
  })

  type ImportRow = {
    cod: string
    descripcion: string
    tipo_costo: string
    costo: number
    unidad_peso: string | null
    renta: number
    grupo: string
    marca: string | null
    vencimiento: string | null
  }

  ipcMain.handle('productos:importar', (_, rows: ImportRow[]) => {
    const nextRow = queryOne<{ next_num: number }>(
      `SELECT COALESCE(MAX(CAST(cod AS INTEGER)), 0) + 1 AS next_num
     FROM productos WHERE cod GLOB '[0-9]*'`
    )

    let nextNum = nextRow?.next_num ?? 1
    let importados = 0
    let actualizados = 0
    let ignorados = 0
    const errores: string[] = []

    const round2 = (n: number) => Number(Number(n).toFixed(2))
    const calcPrecioVenta = (costo: number, renta: number) =>
      round2(costo * (1 + renta / 100))

    runInTransaction(() => {
      for (const data of rows) {
        const cod = data.cod || String(nextNum++).padStart(4, '0')

        try {
          const existente =
            queryOne<any>(
              `SELECT * FROM productos
             WHERE activo = 1 AND LOWER(TRIM(descripcion)) = LOWER(TRIM(?))
             LIMIT 1`,
              [data.descripcion]
            ) || null

          if (existente) {
            const costoActual = round2(Number(existente.costo ?? 0))
            const rentaActual = round2(Number(existente.renta ?? 0))
            const precioVentaActual = calcPrecioVenta(costoActual, rentaActual)

            const costoNuevo = round2(Number(data.costo ?? 0))
            const rentaNueva = round2(Number(data.renta ?? 0))
            const precioVentaNuevo = calcPrecioVenta(costoNuevo, rentaNueva)

            const cambioCosto = costoActual !== costoNuevo
            const cambioRenta = rentaActual !== rentaNueva
            const cambioPrecioVenta = precioVentaActual !== precioVentaNuevo

            const categoriaId = asegurarCategoria(data.grupo)

            if (cambioCosto || cambioRenta || cambioPrecioVenta) {
              executeRaw(
                `UPDATE productos
                 SET costo = ?, renta = ?, grupo = ?, categoria_id = ?
                 WHERE id = ?`,
                [
                  costoNuevo,
                  rentaNueva,
                  normalizarCategoria(data.grupo),
                  categoriaId,
                  existente.id
                ]
              )
              actualizados++
            } else {
              // aunque no cambie precio/costo/renta, aseguramos categoría
              executeRaw(
                `UPDATE productos
                 SET grupo = ?, categoria_id = ?
                 WHERE id = ?`,
                [
                  normalizarCategoria(data.grupo),
                  categoriaId,
                  existente.id
                ]
              )
              ignorados++
            }

            continue
          }

                    const categoriaId = asegurarCategoria(data.grupo)

          executeRaw(
            `INSERT INTO productos
             (cod, descripcion, tipo_costo, costo, unidad_peso, renta, grupo, categoria_id, marca, vencimiento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cod,
              data.descripcion,
              data.tipo_costo,
              data.costo,
              data.tipo_costo === 'peso' ? (data.unidad_peso || 'kg') : null,
              data.renta ?? 0,
              normalizarCategoria(data.grupo),
              categoriaId,
              data.marca || null,
              data.vencimiento || null,
            ]
          )
          importados++
        } catch (e) {
          errores.push(`"${data.descripcion}" (cod: ${cod}): ${(e as Error).message}`)
        }
      }
    })

    return { importados, actualizados, ignorados, errores }
  })
}
