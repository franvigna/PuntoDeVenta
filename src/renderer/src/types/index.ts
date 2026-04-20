export type TipoCosto = 'unidad' | 'peso'
export type UnidadPeso = 'kg' | '100g'
export type GrupoProducto = string
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta'
export type PageName = 'ventas' | 'productos' | 'historial' | 'reportes' | 'configuracion'

export interface Producto {
  id: number
  cod: string
  codigo_barras: string | null
  descripcion: string
  tipo_costo: TipoCosto
  costo: number
  unidad_peso: UnidadPeso | null
  renta: number
  grupo: string
  marca: string | null
  vencimiento: string | null
  activo: number
}

export interface ProductoForm {
  cod: string
  descripcion: string
  tipo_costo: TipoCosto
  costo: number
  unidad_peso: UnidadPeso | null
  renta: number
  grupo: string
  marca: string | null
  vencimiento: string | null
}

export interface Categoria {
  id: number
  nombre: string
}

export interface Venta {
  id: number
  fecha: string
  total: number
  metodo_pago: MetodoPago
  descuento: number
  monto_recibido: number
  vuelto: number
}

export interface VentaItem {
  id: number
  venta_id: number
  producto_id: number | null
  cod: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface VentaDetalle extends Venta {
  items: VentaItem[]
}

export interface CrearVentaInput {
  items: Omit<VentaItem, 'id' | 'venta_id'>[]
  total: number
  descuento: number
  metodo_pago: MetodoPago
  monto_recibido: number
  vuelto: number
}

export interface ReportesKpis {
  totalVentas: number
  montoTotal: number
  ticketPromedio: number
  ganancia: number
}

export interface ReportesData {
  kpis: ReportesKpis
  evolucion: { periodo: string; count: number; monto: number; ganancia: number }[]
  granularidad: 'diaria' | 'mensual'
  porCategoria: { categoria: string; monto: number; ventas: number }[]
  porMetodo: { metodo_pago: string; count: number; monto: number }[]
  topProductos: { descripcion: string; cod: string | null; monto: number; cantidad: number; ganancia: number }[]
  años: number[]
}

export interface FiltrosHistorial {
  desde?: string
  hasta?: string
  metodo?: string
}

declare global {
  interface Window {
    electronAPI: {
      productos: {
        getAll: () => Promise<Producto[]>
        create: (data: ProductoForm) => Promise<Producto>
        update: (id: number, data: ProductoForm) => Promise<Producto>
        delete: (id: number) => Promise<{ success: boolean }>
        deleteAll: () => Promise<{ success: boolean }>
        getNextCod: () => Promise<string>
        importar: (rows: ProductoForm[]) => Promise<{ importados: number; actualizados: number; ignorados: number; errores: string[] }>
        buscar: (query: string) => Promise<Producto[]>
      }
      categorias: {
        getAll: () => Promise<Categoria[]>
        create: (nombre: string) => Promise<Categoria>
      }
      ventas: {
        crear: (data: CrearVentaInput) => Promise<{ id: number }>
        getAll: (filtros: FiltrosHistorial) => Promise<(Venta & { num_items: number })[]>
        getDetalle: (id: number) => Promise<VentaDetalle>
        getReportes: (filtros: { año?: number; mes?: number }) => Promise<ReportesData>
      }
    }
  }
}
