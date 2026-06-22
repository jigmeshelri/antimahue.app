/**
 * Sale draft store — D2 (nanostores).
 *
 * Holds the in-progress sale being built in SaleScreen.
 * Cleared when the sale is confirmed (atomic RPC — future data-model change).
 * Server data (catalog, sales history) is NOT stored here: it lives in Supabase.
 */
import { atom } from 'nanostores'

export interface SaleLine {
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
}

export interface SaleDraft {
  lines: SaleLine[]
  note: string
}

export const $saleDraft = atom<SaleDraft>({
  lines: [],
  note: '',
})
