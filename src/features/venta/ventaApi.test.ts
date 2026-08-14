/**
 * ventaApi tests — TDD for the sale API layer.
 *
 * Mocks ONLY the Supabase client boundary; no real network calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mocks.supabase,
}))

import { supabase } from '@/lib/supabase'
import { confirmSale, fetchStock, fetchStoreName, fetchVenta, undoSale } from './ventaApi'
import type { SaleLine } from '@/stores/saleDraft'

function makeBuilder(returnValue: unknown) {
  const calls: Record<string, unknown[][]> = {}
  const builder: Record<string, unknown> = {}

  const addMethod = (name: string, returnsPromise = false) => {
    builder[name] = (...args: unknown[]) => {
      calls[name] = calls[name] ?? []
      calls[name].push(args)
      return returnsPromise ? Promise.resolve(returnValue) : builder
    }
  }

  addMethod('select')
  addMethod('order')
  addMethod('range')
  addMethod('or')
  addMethod('eq')
  addMethod('in')
  addMethod('single', true)

  builder.then = (resolve: (value: unknown) => unknown) => resolve(returnValue)

  return { builder, calls }
}

function line(overrides: Partial<SaleLine> = {}): SaleLine {
  return {
    productId: 'p1',
    sku: 'S1',
    name: 'Lana',
    quantity: 1,
    unitPrice: 1000,
    stockSnapshot: 10,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('confirmSale', () => {
  it('should_call_confirmar_venta_rpc_with_ids_and_quantities_only', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: 'new-sale-id', error: null })

    const id = await confirmSale(
      [line({ productId: 'p1', quantity: 2 }), line({ productId: 'p2', quantity: 3 })],
      'transferencia'
    )

    expect(id).toBe('new-sale-id')
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('confirmar_venta', {
      p_items: [
        { producto_id: 'p1', cantidad: 2 },
        { producto_id: 'p2', cantidad: 3 },
      ],
      p_medio_pago: 'transferencia',
    })
  })

  it('should_throw_verbatim_error_when_rpc_fails', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'stock insuficiente p1 (hay 1, pide 2)' },
    })

    await expect(confirmSale([line()], 'efectivo')).rejects.toThrow(
      'stock insuficiente p1 (hay 1, pide 2)'
    )
  })
})

describe('undoSale', () => {
  it('should_call_deshacer_venta_rpc_with_venta_id', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: null })

    await undoSale('sale-id')

    expect(mocks.supabase.rpc).toHaveBeenCalledWith('deshacer_venta', { p_venta_id: 'sale-id' })
  })

  it('should_throw_verbatim_error_when_rpc_fails', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'solo se puede deshacer la última venta confirmada' },
    })

    await expect(undoSale('sale-id')).rejects.toThrow(
      'solo se puede deshacer la última venta confirmada'
    )
  })
})

describe('fetchVenta', () => {
  it('should_return_mapped_venta_with_embedded_items', async () => {
    const raw = {
      id: 'v1',
      created_at: '2026-08-11T12:30:00.000Z',
      medio_pago: 'efectivo',
      total: 3000,
      estado: 'confirmada',
      actor_id: 'u1',
      venta_items: [
        { cantidad: 3, precio_unitario: 1000, producto_id: 'p1', productos: { nombre: 'Lana' } },
      ],
    }
    const { builder, calls } = makeBuilder({ data: raw, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchVenta('v1')

    expect(supabase.from).toHaveBeenCalledWith('ventas')
    expect(calls.select).toEqual([['*, venta_items(cantidad, precio_unitario, productos(nombre))']])
    expect(calls.eq).toContainEqual(['id', 'v1'])
    expect(result).toEqual({
      id: 'v1',
      created_at: '2026-08-11T12:30:00.000Z',
      medio_pago: 'efectivo',
      total: 3000,
      estado: 'confirmada',
      actor_id: 'u1',
      items: [{ id: 'p1', cantidad: 3, precio_unitario: 1000, nombre: 'Lana' }],
    })
  })

  it('should_return_null_when_supabase_returns_error', async () => {
    const { builder } = makeBuilder({ data: null, error: { message: 'not found' } })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchVenta('missing')

    expect(result).toBeNull()
  })
})

describe('fetchStoreName', () => {
  it('should_return_nombre_tienda_from_configuracion', async () => {
    const { builder, calls } = makeBuilder({
      data: { nombre_tienda: 'Tejiendo Sueños' },
      error: null,
    })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchStoreName()

    expect(supabase.from).toHaveBeenCalledWith('configuracion')
    expect(calls.select).toEqual([['nombre_tienda']])
    expect(calls.single).toHaveLength(1)
    expect(result).toBe('Tejiendo Sueños')
  })

  it('should_fallback_to_Antimahue_when_no_row', async () => {
    const { builder } = makeBuilder({ data: null, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchStoreName()

    expect(result).toBe('Antimahue')
  })
})

describe('fetchStock', () => {
  it('should_return_stock_record_for_given_product_ids', async () => {
    const { builder, calls } = makeBuilder({
      data: [
        { id: 'p1', stock: 10 },
        { id: 'p2', stock: 0 },
      ],
      error: null,
    })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchStock(['p1', 'p2'])

    expect(supabase.from).toHaveBeenCalledWith('productos')
    expect(calls.select).toEqual([['id, stock']])
    expect(calls.in).toContainEqual(['id', ['p1', 'p2']])
    expect(result).toEqual({ p1: 10, p2: 0 })
  })

  it('should_return_empty_record_when_data_is_null', async () => {
    const { builder } = makeBuilder({ data: null, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchStock(['p1'])

    expect(result).toEqual({})
  })
})
