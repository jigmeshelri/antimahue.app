/**
 * paletaApi tests — TDD for the color-palette assistant's API layer.
 *
 * Mocks ONLY the Supabase client boundary; no real network calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mocks.supabase,
}))

import { supabase } from '@/lib/supabase'
import { fetchColoredProducts, savePedidoPendiente } from './paletaApi'
import type { Product } from '../catalogo/catalogoTypes'

function makeBuilder(returnValue: unknown) {
  const calls: Record<string, unknown[][]> = {}
  const builder: Record<string, unknown> = {}

  const addMethod = (name: string) => {
    builder[name] = (...args: unknown[]) => {
      calls[name] = calls[name] ?? []
      calls[name].push(args)
      return builder
    }
  }

  addMethod('select')
  addMethod('order')
  addMethod('not')
  addMethod('insert')

  // Allows `await builder` to resolve the final query result.
  builder.then = (resolve: (value: unknown) => unknown) => resolve(returnValue)

  return { builder, calls }
}

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
    color_h: 6,
    color_s: 61,
    color_l: 55,
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchColoredProducts', () => {
  it('should_return_products_with_a_color_ordered_by_name', async () => {
    const products = [makeProduct()]
    const { builder, calls } = makeBuilder({ data: products, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchColoredProducts()

    expect(result).toEqual(products)
    expect(supabase.from).toHaveBeenCalledWith('productos')
    expect(calls.not).toEqual([['color_hex', 'is', null]])
    expect(calls.order).toEqual([['nombre', { ascending: true }]])
  })

  it('should_return_empty_array_when_data_is_null', async () => {
    const { builder } = makeBuilder({ data: null, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchColoredProducts()

    expect(result).toEqual([])
  })

  it('should_throw_when_supabase_returns_error', async () => {
    const { builder } = makeBuilder({ data: null, error: { message: 'db error' } })
    mocks.supabase.from.mockReturnValue(builder)

    await expect(fetchColoredProducts()).rejects.toThrow(
      'No se pudo cargar los colores del catálogo'
    )
  })
})

describe('savePedidoPendiente', () => {
  it('should_insert_the_note_and_colors_into_pedidos_pendientes', async () => {
    const { builder, calls } = makeBuilder({ data: null, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    await savePedidoPendiente({
      nota: 'Cliente busca celeste cielo',
      colores: [{ color_hex: '#87CEEB', color_h: 197, color_s: 71, color_l: 73 }],
    })

    expect(supabase.from).toHaveBeenCalledWith('pedidos_pendientes')
    expect(calls.insert).toEqual([
      [
        {
          nota: 'Cliente busca celeste cielo',
          colores: [{ color_hex: '#87CEEB', color_h: 197, color_s: 71, color_l: 73 }],
        },
      ],
    ])
  })

  it('should_throw_when_supabase_returns_error', async () => {
    const { builder } = makeBuilder({ data: null, error: { message: 'solo admin' } })
    mocks.supabase.from.mockReturnValue(builder)

    await expect(savePedidoPendiente({ nota: 'x', colores: [] })).rejects.toThrow(
      'No se pudo guardar el encargo'
    )
  })
})
