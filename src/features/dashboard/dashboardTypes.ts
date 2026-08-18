/**
 * Dashboard domain types.
 *
 * Mirrors the JSON returned by the `resumen_dashboard()` RPC.
 * `valor_inventario` is `null` for non-admin users by design (D2).
 */

export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export interface VentasHoy {
  total: number
  cantidad: number
  por_medio_pago: Partial<Record<MedioPago, number>>
}

export interface ValorInventario {
  a_costo: number
  a_venta: number
}

export interface StockAlert {
  id: string
  nombre: string
  stock: number
  stock_minimo: number
}

export interface DashboardSummary {
  ventas_hoy: VentasHoy
  valor_inventario: ValorInventario | null
  alertas_stock: StockAlert[]
}

export type AlertLevel = 'agotado' | 'bajo'
