import { describe, expect, it } from 'vitest'
import {
  $saleDraft,
  addLine,
  clearDraft,
  removeLine,
  setMedioPago,
  setQuantity,
  type SaleLine,
} from './saleDraft'

function line(partial: Partial<SaleLine> = {}): SaleLine {
  return {
    productId: 'p1',
    sku: '123',
    name: 'Lana',
    quantity: 1,
    unitPrice: 1000,
    stockSnapshot: null,
    ...partial,
  }
}

function emptyDraft() {
  return { lines: [], note: '', medioPago: 'efectivo' as const }
}

describe('saleDraft', () => {
  it('should_default_to_empty_draft_with_efectivo', () => {
    clearDraft()
    expect($saleDraft.get()).toEqual(emptyDraft())
  })

  it('should_add_a_new_line', () => {
    $saleDraft.set(emptyDraft())
    addLine(line())
    expect($saleDraft.get().lines).toHaveLength(1)
    expect($saleDraft.get().lines[0]).toEqual(line())
  })

  it('should_store_stockSnapshot_for_new_line', () => {
    $saleDraft.set(emptyDraft())
    addLine(line({ stockSnapshot: 12 }))
    expect($saleDraft.get().lines[0].stockSnapshot).toBe(12)
  })

  it('should_increment_quantity_when_line_already_exists', () => {
    $saleDraft.set({ lines: [line({ quantity: 2 })], note: '', medioPago: 'efectivo' })
    addLine(line({ quantity: 3 }))
    expect($saleDraft.get().lines).toHaveLength(1)
    expect($saleDraft.get().lines[0].quantity).toBe(5)
  })

  it('should_preserve_original_stockSnapshot_when_merging_lines', () => {
    $saleDraft.set({
      lines: [line({ stockSnapshot: 7 })],
      note: '',
      medioPago: 'efectivo',
    })
    addLine(line({ stockSnapshot: 20, quantity: 2 }))
    expect($saleDraft.get().lines[0].stockSnapshot).toBe(7)
    expect($saleDraft.get().lines[0].quantity).toBe(3)
  })

  it('should_preserve_other_lines', () => {
    $saleDraft.set({ lines: [line({ productId: 'p2' })], note: '', medioPago: 'efectivo' })
    addLine(line({ productId: 'p1' }))
    expect($saleDraft.get().lines).toHaveLength(2)
  })

  it('should_update_quantity_with_setQuantity', () => {
    $saleDraft.set({ lines: [line({ quantity: 1 })], note: '', medioPago: 'efectivo' })
    setQuantity('p1', 5)
    expect($saleDraft.get().lines[0].quantity).toBe(5)
  })

  it('should_remove_line_when_setQuantity_is_zero', () => {
    $saleDraft.set({ lines: [line()], note: '', medioPago: 'efectivo' })
    setQuantity('p1', 0)
    expect($saleDraft.get().lines).toHaveLength(0)
  })

  it('should_remove_line_when_setQuantity_is_negative', () => {
    $saleDraft.set({ lines: [line()], note: '', medioPago: 'efectivo' })
    setQuantity('p1', -1)
    expect($saleDraft.get().lines).toHaveLength(0)
  })

  it('should_remove_line_with_removeLine', () => {
    $saleDraft.set({ lines: [line()], note: '', medioPago: 'efectivo' })
    removeLine('p1')
    expect($saleDraft.get().lines).toHaveLength(0)
  })

  it('should_be_noop_when_removing_unknown_product', () => {
    $saleDraft.set({ lines: [line()], note: '', medioPago: 'efectivo' })
    removeLine('unknown')
    expect($saleDraft.get().lines).toHaveLength(1)
  })

  it('should_reset_draft_with_clearDraft', () => {
    $saleDraft.set({
      lines: [line()],
      note: 'nota',
      medioPago: 'credito',
    })
    clearDraft()
    expect($saleDraft.get()).toEqual(emptyDraft())
  })

  it('should_update_medioPago_with_setMedioPago', () => {
    $saleDraft.set(emptyDraft())
    setMedioPago('transferencia')
    expect($saleDraft.get().medioPago).toBe('transferencia')
  })
})
