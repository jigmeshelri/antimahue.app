/**
 * dashboardUtils tests — pure helpers for the dashboard feature.
 */
import { describe, expect, it } from 'vitest'
import { classifyAlert, completePaymentBreakdown, greetingForHour } from './dashboardUtils'
import type { StockAlert } from './dashboardTypes'

function alert(overrides: Partial<StockAlert> = {}): StockAlert {
  return {
    id: 'p1',
    nombre: 'Lana',
    stock: 2,
    stock_minimo: 5,
    ...overrides,
  }
}

describe('classifyAlert', () => {
  it('should_return_agotado_when_stock_is_zero', () => {
    expect(classifyAlert(alert({ stock: 0 }))).toBe('agotado')
  })

  it('should_return_bajo_when_stock_is_positive_but_at_or_below_minimum', () => {
    expect(classifyAlert(alert({ stock: 2 }))).toBe('bajo')
    expect(classifyAlert(alert({ stock: 5 }))).toBe('bajo')
  })

  it('should_return_bajo_even_when_stock_equals_minimum', () => {
    expect(classifyAlert(alert({ stock: 5, stock_minimo: 5 }))).toBe('bajo')
  })
})

describe('completePaymentBreakdown', () => {
  it('should_fill_all_four_payment_methods_with_zero_when_empty', () => {
    const result = completePaymentBreakdown({})

    expect(result).toEqual({
      efectivo: 0,
      transferencia: 0,
      debito: 0,
      credito: 0,
    })
  })

  it('should_preserve_existing_values_and_fill_the_rest', () => {
    const result = completePaymentBreakdown({ efectivo: 10000, debito: 5000 })

    expect(result).toEqual({
      efectivo: 10000,
      transferencia: 0,
      debito: 5000,
      credito: 0,
    })
  })
})

describe('greetingForHour', () => {
  it('should_return_buenos_dias_in_the_morning', () => {
    expect(greetingForHour(new Date('2026-08-18T08:00:00'))).toBe('Buenos días')
  })

  it('should_return_buenas_tardes_in_the_afternoon', () => {
    expect(greetingForHour(new Date('2026-08-18T14:00:00'))).toBe('Buenas tardes')
  })

  it('should_return_buenas_noches_at_night', () => {
    expect(greetingForHour(new Date('2026-08-18T22:00:00'))).toBe('Buenas noches')
  })

  it('should_return_buenas_noches_past_midnight', () => {
    expect(greetingForHour(new Date('2026-08-18T04:00:00'))).toBe('Buenas noches')
  })
})
