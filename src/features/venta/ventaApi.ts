/**
 * Venta API layer — wraps Supabase RPCs and queries for the sale flow.
 *
 * All functions throw RPC errors verbatim so callers can parse stable prefixes.
 */
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { SaleLine } from '@/stores/saleDraft'
import type { MedioPago, Venta } from './ventaTypes'

interface ConfirmarVentaItem {
  producto_id: string
  cantidad: number
}

interface RawVentaItem {
  cantidad: number
  precio_unitario: number
  producto_id: string
  productos: { nombre: string }
}

interface RawVenta {
  id: string
  created_at: string
  medio_pago: MedioPago
  total: number
  estado: 'confirmada' | 'deshecha'
  actor_id: string | null
  venta_items: RawVentaItem[]
}

/**
 * Confirm a sale from draft lines and payment method.
 * Sends only product ids and quantities; the server computes prices/total.
 */
export async function confirmSale(lines: SaleLine[], medioPago: MedioPago): Promise<string> {
  const p_items: ConfirmarVentaItem[] = lines.map(({ productId, quantity }) => ({
    producto_id: productId,
    cantidad: quantity,
  }))

  const { data, error } = await supabase.rpc('confirmar_venta', {
    p_items: p_items as unknown as Json,
    p_medio_pago: medioPago,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as string
}

/**
 * Undo the last confirmed sale for the given venta id.
 */
export async function undoSale(ventaId: string): Promise<void> {
  const { error } = await supabase.rpc('deshacer_venta', { p_venta_id: ventaId })

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Fetch a single venta with its items.
 * Returns null when the row is missing or unreadable.
 */
export async function fetchVenta(id: string): Promise<Venta | null> {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(cantidad, precio_unitario, productos(nombre))')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  const { venta_items, ...rest } = data as RawVenta

  return {
    ...rest,
    items: venta_items.map((item) => ({
      id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      nombre: item.productos.nombre,
    })),
  }
}

/**
 * Read the store name from the singleton configuracion row.
 */
export async function fetchStoreName(): Promise<string> {
  const { data, error } = await supabase.from('configuracion').select('nombre_tienda').single()

  if (error || !data) {
    return 'Antimahue'
  }

  return data.nombre_tienda ?? 'Antimahue'
}

/**
 * Fetch current stock for a list of product ids.
 */
export async function fetchStock(productIds: string[]): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('productos').select('id, stock').in('id', productIds)

  if (error || !data) {
    return {}
  }

  return data.reduce<Record<string, number>>((acc, row) => {
    acc[row.id] = row.stock
    return acc
  }, {})
}
