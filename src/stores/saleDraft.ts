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

/**
 * Add a product line to the current sale draft.
 * If the product is already present, increments its quantity.
 */
export function addLine(line: SaleLine): void {
  const draft = $saleDraft.get()
  const existingIndex = draft.lines.findIndex((l) => l.productId === line.productId)
  if (existingIndex >= 0) {
    const updated = [...draft.lines]
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + line.quantity,
    }
    $saleDraft.set({ ...draft, lines: updated })
  } else {
    $saleDraft.set({ ...draft, lines: [...draft.lines, line] })
  }
}
