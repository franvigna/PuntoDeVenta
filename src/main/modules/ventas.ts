import { ipcMain } from 'electron'
import { queryAll, queryOne, executeRaw, runInTransaction } from '../database'

interface ItemInput {
  producto_id: number | null
  cod: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface CrearVentaInput {
  items: ItemInput[]
  total: number
  descuento: number
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta'
  monto_recibido: number
  vuelto: number
}

export function registerVentasHandlers(): void {
  ipcMain.handle('ventas:crear', (_, data: CrearVentaInput) => {
    const fecha = new Date().toISOString()
    let ventaId = 0

    runInTransaction(() => {
      executeRaw(
        `INSERT INTO ventas (fecha, total, metodo_pago, descuento, monto_recibido, vuelto)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fecha, data.total, data.metodo_pago, data.descuento ?? 0, data.monto_recibido ?? 0, data.vuelto ?? 0]
      )
      const row = queryOne<{ id: number }>(`SELECT last_insert_rowid() as id`)
      ventaId = row?.id ?? 0

      for (const item of data.items) {
        executeRaw(
          `INSERT INTO venta_items (venta_id, producto_id, cod, descripcion, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ventaId, item.producto_id, item.cod, item.descripcion, item.cantidad, item.precio_unitario, item.subtotal]
        )
      }
    })

    return { id: ventaId }
  })

  ipcMain.handle('ventas:getAll', (_, filtros: { desde?: string; hasta?: string; metodo?: string } = {}) => {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filtros.desde) {
      conditions.push(`DATE(v.fecha) >= DATE(?)`)
      params.push(filtros.desde)
    }
    if (filtros.hasta) {
      conditions.push(`DATE(v.fecha) <= DATE(?)`)
      params.push(filtros.hasta)
    }
    if (filtros.metodo && filtros.metodo !== 'todos') {
      conditions.push(`v.metodo_pago = ?`)
      params.push(filtros.metodo)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return queryAll(
      `SELECT v.*, COUNT(vi.id) as num_items
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.fecha DESC`,
      params
    )
  })

  ipcMain.handle('ventas:getReportes', (_, filtros: { año?: number; mes?: number } = {}) => {
    const { año, mes } = filtros ?? {}

    const conds: string[] = []
    const params: unknown[] = []
    if (año) { conds.push(`strftime('%Y', v.fecha) = ?`); params.push(String(año)) }
    if (mes)  { conds.push(`strftime('%m', v.fecha) = ?`); params.push(String(mes).padStart(2, '0')) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const kpisRow = queryOne<any>(`
      SELECT COUNT(v.id) as total_ventas,
             COALESCE(SUM(v.total), 0) as monto_total,
             COALESCE(AVG(v.total), 0) as ticket_promedio
      FROM ventas v ${where}
    `, params)

    const gananciaRow = queryOne<any>(`
      SELECT COALESCE(SUM(vi.subtotal - vi.cantidad * COALESCE(p.costo, 0)), 0) as ganancia
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      ${where}
    `, params)

    const granularidad = mes ? 'diaria' : 'mensual'
    const periodoExpr = mes ? `DATE(v.fecha)` : `strftime('%Y-%m', v.fecha)`

    const evolucion = queryAll<any>(`
      SELECT ${periodoExpr} as periodo,
             COUNT(v.id) as count,
             ROUND(SUM(v.total), 2) as monto,
             ROUND(COALESCE(SUM(ic.ganancia), 0), 2) as ganancia
      FROM ventas v
      LEFT JOIN (
        SELECT vi.venta_id, SUM(vi.subtotal - vi.cantidad * COALESCE(p.costo, 0)) as ganancia
        FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
        GROUP BY vi.venta_id
      ) ic ON ic.venta_id = v.id
      ${where}
      GROUP BY periodo ORDER BY periodo
    `, params)

    const porCategoria = queryAll<any>(`
      SELECT COALESCE(c.nombre, '_manual') as categoria,
             ROUND(SUM(vi.subtotal), 2) as monto,
             COUNT(DISTINCT v.id) as ventas
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      ${where}
      GROUP BY categoria ORDER BY monto DESC
    `, params)

    const porMetodo = queryAll<any>(`
      SELECT v.metodo_pago, COUNT(v.id) as count, ROUND(SUM(v.total), 2) as monto
      FROM ventas v ${where}
      GROUP BY v.metodo_pago
    `, params)

    const topProductos = queryAll<any>(`
      SELECT vi.descripcion, vi.cod,
             ROUND(SUM(vi.subtotal), 2) as monto,
             ROUND(SUM(vi.cantidad), 3) as cantidad,
             ROUND(SUM(vi.subtotal - vi.cantidad * COALESCE(p.costo, 0)), 2) as ganancia
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      ${where}
      GROUP BY LOWER(TRIM(vi.descripcion))
      ORDER BY monto DESC LIMIT 10
    `, params)

    const años = queryAll<{ año: string }>(
      `SELECT DISTINCT strftime('%Y', fecha) as año FROM ventas ORDER BY año DESC`
    ).map(r => Number(r.año))

    return {
      kpis: {
        totalVentas: Number(kpisRow?.total_ventas ?? 0),
        montoTotal:  Number(kpisRow?.monto_total ?? 0),
        ticketPromedio: Number(kpisRow?.ticket_promedio ?? 0),
        ganancia:    Number(gananciaRow?.ganancia ?? 0),
      },
      evolucion: evolucion.map(r => ({
        periodo: r.periodo as string,
        count: Number(r.count), monto: Number(r.monto), ganancia: Number(r.ganancia),
      })),
      granularidad: granularidad as 'diaria' | 'mensual',
      porCategoria: porCategoria.map(r => ({
        categoria: r.categoria as string, monto: Number(r.monto), ventas: Number(r.ventas),
      })),
      porMetodo: porMetodo.map(r => ({
        metodo_pago: r.metodo_pago as string, count: Number(r.count), monto: Number(r.monto),
      })),
      topProductos: topProductos.map(r => ({
        descripcion: r.descripcion as string, cod: r.cod as string | null,
        monto: Number(r.monto), cantidad: Number(r.cantidad), ganancia: Number(r.ganancia),
      })),
      años,
    }
  })

  ipcMain.handle('ventas:getDetalle', (_, id: number) => {
    const venta = queryOne(`SELECT * FROM ventas WHERE id = ?`, [id])
    if (!venta) return null

    const items = queryAll(
      `SELECT vi.*
       FROM venta_items vi
       WHERE vi.venta_id = ?
       ORDER BY vi.id`,
      [id]
    )

    return { ...venta, items }
  })
}
