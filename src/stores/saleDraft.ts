/**
 * Sale draft store — D2 (nanostores).
 *
 * Holds the in-progress sale being built in SaleScreen.
 * Cleared when the sale is confirmed (atomic RPC — future data-model change).
 * Server data (catalog, sales history) is NOT stored here: it lives in Supabase.
 */
import { atom } from 'nanostores'

export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export interface SaleLine {
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
  stockSnapshot: number | null
}

export interface SaleDraft {
  lines: SaleLine[]
  note: string
  medioPago: MedioPago
}

export const $saleDraft = atom<SaleDraft>({
  lines: [],
  note: '',
  medioPago: 'efectivo',
})

const EMPTY_DRAFT: SaleDraft = {
  lines: [],
  note: '',
  medioPago: 'efectivo',
}

/**
 * Add a product line to the current sale draft.
 * If the product is already present, increments its quantity and keeps
 * the original stockSnapshot.
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

/**
 * Set the quantity for a line. Removes the line when quantity is zero or less.
 */
export function setQuantity(productId: string, qty: number): void {
  const draft = $saleDraft.get()
  if (qty <= 0) {
    $saleDraft.set({ ...draft, lines: draft.lines.filter((l) => l.productId !== productId) })
    return
  }
  const updated = draft.lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l))
  $saleDraft.set({ ...draft, lines: updated })
}

/**
 * Remove a product line from the current draft.
 */
export function removeLine(productId: string): void {
  const draft = $saleDraft.get()
  $saleDraft.set({ ...draft, lines: draft.lines.filter((l) => l.productId !== productId) })
}

/**
 * Reset the draft to its default empty state.
 */
export function clearDraft(): void {
  $saleDraft.set(EMPTY_DRAFT)
}

/**
 * Update the payment method for the current draft.
 */
export function setMedioPago(mp: MedioPago): void {
  const draft = $saleDraft.get()
  $saleDraft.set({ ...draft, medioPago: mp })
}
