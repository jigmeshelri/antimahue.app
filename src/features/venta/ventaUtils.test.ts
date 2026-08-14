import { describe, expect, it } from 'vitest'
import {
  MEDIO_PAGO_LABELS,
  buildWhatsAppText,
  draftTotal,
  formatTicketDate,
  parseRpcError,
  shortRef,
} from './ventaUtils'
import type { SaleLine } from '@/stores/saleDraft'
import type { Venta, VentaItem } from './ventaTypes'

function line(overrides: Partial<SaleLine> = {}): SaleLine {
  return {
    productId: 'p1',
    sku: 'S1',
    name: 'Lana',
    quantity: 1,
    unitPrice: 1000,
    stockSnapshot: null,
    ...overrides,
  }
}

function item(overrides: Partial<VentaItem> = {}): VentaItem {
  return {
    id: 'p1',
    cantidad: 1,
    precio_unitario: 1000,
    nombre: 'Lana',
    ...overrides,
  }
}

function venta(overrides: Partial<Venta> = {}): Venta {
  return {
    id: 'a1b2c3d4-1111-2222-3333-444444444444',
    created_at: '2026-08-11T12:30:00.000Z',
    medio_pago: 'efectivo',
    total: 3000,
    estado: 'confirmada',
    actor_id: 'u1',
    items: [item({ cantidad: 3, precio_unitario: 1000 })],
    ...overrides,
  }
}

describe('parseRpcError', () => {
  it('parses_stock_insuficiente_with_uuid_and_quantities', () => {
    const uuid = 'a1b2c3d4-1111-2222-3333-444444444444'
    const result = parseRpcError(`stock insuficiente ${uuid} (hay 3, pide 5)`)
    expect(result).toEqual({
      kind: 'stock_insuficiente',
      productId: uuid,
      available: 3,
      requested: 5,
    })
  })

  it('parses_not_last_sale_prefix', () => {
    expect(parseRpcError('solo se puede deshacer la última venta confirmada')).toEqual({
      kind: 'not_last_sale',
    })
  })

  it('parses_not_confirmed_prefix', () => {
    expect(parseRpcError('la venta no está confirmada')).toEqual({ kind: 'not_confirmed' })
  })

  it('maps_usuario_inactivo_prefix', () => {
    expect(parseRpcError('usuario inactivo')).toEqual({ kind: 'usuario_inactivo' })
  })

  it('maps_no_autenticado_to_usuario_inactivo', () => {
    expect(parseRpcError('no autenticado')).toEqual({ kind: 'usuario_inactivo' })
  })

  it('returns_unknown_for_unmatched_message', () => {
    expect(parseRpcError('medio de pago inválido')).toEqual({
      kind: 'unknown',
      message: 'medio de pago inválido',
    })
  })

  it('returns_unknown_for_empty_message', () => {
    expect(parseRpcError('')).toEqual({ kind: 'unknown', message: '' })
  })
})

describe('draftTotal', () => {
  it('returns_zero_for_empty_draft', () => {
    expect(draftTotal([])).toBe(0)
  })

  it('sums_line_totals', () => {
    expect(
      draftTotal([line({ quantity: 2, unitPrice: 1500 }), line({ quantity: 1, unitPrice: 500 })])
    ).toBe(3500)
  })
})

describe('shortRef', () => {
  it('returns_first_eight_characters', () => {
    expect(shortRef('a1b2c3d4-1111-2222-3333-444444444444')).toBe('a1b2c3d4')
  })
})

describe('formatTicketDate', () => {
  it('formats_iso_to_es_CL_short_datetime', () => {
    const iso = '2026-08-11T12:30:00.000Z'
    const expected = new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
    expect(formatTicketDate(iso)).toBe(expected)
  })
})

describe('MEDIO_PAGO_LABELS', () => {
  it('has_expected_labels', () => {
    expect(MEDIO_PAGO_LABELS).toEqual({
      efectivo: 'Efectivo',
      transferencia: 'Transfer',
      debito: 'Débito',
      credito: 'Crédito',
    })
  })
})

describe('buildWhatsAppText', () => {
  it('includes_store_date_ticket_ref_items_total_medio_and_thanks', () => {
    const text = buildWhatsAppText(venta(), 'Antimahue Test')
    expect(text).toContain('Antimahue Test')
    expect(text).toContain('Ticket #a1b2c3d4')
    expect(text).toContain('Lana')
    expect(text).toContain('3 × $1.000 = $3.000')
    expect(text).toContain('TOTAL $3.000')
    expect(text).toContain('Efectivo')
    expect(text).toContain('¡Gracias por tu compra!')
  })

  it('includes_seller_when_passed', () => {
    const text = buildWhatsAppText(venta(), 'Antimahue Test', 'Cata')
    expect(text).toContain('Atiende: Cata')
  })

  it('omits_seller_when_not_passed', () => {
    const text = buildWhatsAppText(venta(), 'Antimahue Test')
    expect(text).not.toContain('Atiende:')
  })

  it('omits_seller_when_empty_string', () => {
    const text = buildWhatsAppText(venta(), 'Antimahue Test', '')
    expect(text).not.toContain('Atiende:')
  })
})
