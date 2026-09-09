/**
 * Color-palette assistant API layer — fetches catalog products that have a
 * stored color and persists out-of-stock customer notes to
 * `pedidos_pendientes` (REQ-CPA-1, REQ-CPA-8).
 */
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Product } from '../catalogo/catalogoTypes'

const PALETA_PRODUCT_SELECT = '*, producto_costos(costo, proveedor_id)'

/**
 * Fetch every catalog product with a non-null `color_hex`, ordered by name.
 * Includes `color_h/s/l` and `stock` so `paletaUtils` can rank and flag
 * suggestions without a second round-trip (REQ-CPA-1, REQ-CPA-4, REQ-CPA-5).
 */
export async function fetchColoredProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('productos')
    .select(PALETA_PRODUCT_SELECT)
    .not('color_hex', 'is', null)
    .order('nombre', { ascending: true })

  if (error) throw new Error('No se pudo cargar los colores del catálogo')
  return (data as Product[]) ?? []
}

export interface PedidoPendienteColor {
  color_hex: string
  color_h: number
  color_s: number
  color_l: number
}

export interface PedidoPendienteInput {
  nota: string
  colores: PedidoPendienteColor[]
}

/** Save a customer note for a color that had no matching stock (REQ-CPA-8). */
export async function savePedidoPendiente(input: PedidoPendienteInput): Promise<void> {
  const { error } = await supabase.from('pedidos_pendientes').insert({
    nota: input.nota,
    colores: input.colores as unknown as Json,
  })

  if (error) throw new Error('No se pudo guardar el encargo')
}
