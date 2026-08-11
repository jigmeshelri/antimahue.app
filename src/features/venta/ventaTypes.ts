export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export interface VentaItem {
  id: string
  cantidad: number
  precio_unitario: number
  nombre: string
}

export interface Venta {
  id: string
  created_at: string
  medio_pago: MedioPago
  total: number
  estado: 'confirmada' | 'deshecha'
  actor_id: string | null
  items: VentaItem[]
}

export type ParsedRpcError =
  | { kind: 'stock_insuficiente'; productId: string; available: number; requested: number }
  | { kind: 'not_last_sale' }
  | { kind: 'not_confirmed' }
  | { kind: 'usuario_inactivo' }
  | { kind: 'unknown'; message: string }
