import { describe, expect, it } from 'vitest'
import { $saleDraft, addLine, type SaleLine } from './saleDraft'

function line(partial: Partial<SaleLine> = {}): SaleLine {
  return {
    productId: 'p1',
    sku: '123',
    name: 'Lana',
    quantity: 1,
    unitPrice: 1000,
    ...partial,
  }
}

describe('saleDraft', () => {
  it('should_add_a_new_line', () => {
    $saleDraft.set({ lines: [], note: '' })
    addLine(line())
    expect($saleDraft.get().lines).toHaveLength(1)
    expect($saleDraft.get().lines[0]).toEqual(line())
  })

  it('should_increment_quantity_when_line_already_exists', () => {
    $saleDraft.set({ lines: [line({ quantity: 2 })], note: '' })
    addLine(line({ quantity: 3 }))
    expect($saleDraft.get().lines).toHaveLength(1)
    expect($saleDraft.get().lines[0].quantity).toBe(5)
  })

  it('should_preserve_other_lines', () => {
    $saleDraft.set({ lines: [line({ productId: 'p2' })], note: '' })
    addLine(line({ productId: 'p1' }))
    expect($saleDraft.get().lines).toHaveLength(2)
  })
})
