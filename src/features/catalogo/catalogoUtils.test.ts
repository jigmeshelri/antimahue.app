/**
 * catalogoUtils tests — pure catalog helpers.
 */
import { describe, expect, it } from 'vitest'
import { computeMargin, formatPrice, productSubtitle, resolveStockStatus } from './catalogoUtils'
import type { Product } from './catalogoTypes'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: '123456',
    nombre: 'Lana Merino',
    tipo: 'lana',
    marca: 'Merino',
    grosor: 'Fino',
    peso_metraje: '50g',
    color_nombre: 'Rojo',
    color_hex: '#C84A3A',
    precio_venta: 4800,
    stock: 10,
    stock_minimo: 5,
    imagen_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    producto_costos: null,
    ...overrides,
  }
}

describe('formatPrice', () => {
  it('should_format_chilean_pesos', () => {
    expect(formatPrice(4800)).toBe('$4.800')
  })

  it('should_format_zero', () => {
    expect(formatPrice(0)).toBe('$0')
  })

  it('should_format_large_numbers', () => {
    expect(formatPrice(1250000)).toBe('$1.250.000')
  })
})

describe('resolveStockStatus', () => {
  it('should_return_ok_when_stock_equals_minimum', () => {
    expect(resolveStockStatus(5, 5)).toBe('ok')
  })

  it('should_return_ok_when_stock_above_minimum', () => {
    expect(resolveStockStatus(10, 5)).toBe('ok')
  })

  it('should_return_low_when_stock_below_minimum_but_positive', () => {
    expect(resolveStockStatus(3, 5)).toBe('low')
  })

  it('should_return_out_when_stock_is_zero', () => {
    expect(resolveStockStatus(0, 5)).toBe('out')
  })

  it('should_use_default_minimum_when_minimo_is_null', () => {
    expect(resolveStockStatus(3, null, 5)).toBe('low')
  })

  it('should_use_default_minimum_when_minimo_is_undefined', () => {
    expect(resolveStockStatus(3, undefined, 5)).toBe('low')
  })
})

describe('productSubtitle', () => {
  it('should_join_marca_grosor_and_color', () => {
    expect(productSubtitle(makeProduct())).toBe('Merino · Fino · Rojo')
  })

  it('should_skip_null_parts', () => {
    expect(productSubtitle(makeProduct({ marca: null, grosor: 'Grueso' }))).toBe('Grueso · Rojo')
  })

  it('should_fall_back_to_tipo_when_nothing_else', () => {
    expect(productSubtitle(makeProduct({ marca: null, grosor: null, color_nombre: null }))).toBe(
      'lana'
    )
  })

  it('should_return_empty_string_when_all_empty', () => {
    expect(
      productSubtitle(makeProduct({ marca: null, grosor: null, color_nombre: null, tipo: null }))
    ).toBe('')
  })
})

describe('computeMargin', () => {
  it('should_compute_margin_percentage', () => {
    expect(computeMargin(1000, 600)).toBe(40)
  })

  it('should_return_null_when_cost_is_null', () => {
    expect(computeMargin(1000, null)).toBeNull()
  })

  it('should_return_null_when_cost_is_undefined', () => {
    expect(computeMargin(1000, undefined)).toBeNull()
  })

  it('should_return_zero_when_price_equals_cost', () => {
    expect(computeMargin(1000, 1000)).toBe(0)
  })

  it('should_round_to_one_decimal', () => {
    expect(computeMargin(1000, 333)).toBe(66.7)
  })
})
