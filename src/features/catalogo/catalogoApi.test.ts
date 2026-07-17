/**
 * catalogoApi tests — TDD for the catalog API layer.
 *
 * Mocks ONLY the Supabase client boundary; no real network calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    mockRpc: vi.fn(),
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
import {
  createProduct,
  fetchProductById,
  fetchProducts,
  findProductBySku,
  updateProduct,
} from './catalogoApi'
import type { Product } from './catalogoTypes'

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
  addMethod('single', true)

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
    precio_venta: 4800,
    stock: 10,
    stock_minimo: 5,
    imagen_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    producto_costos: { costo: 2400, proveedor_id: null },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchProducts', () => {
  it('should_return_products_ordered_by_name', async () => {
    const products = [makeProduct()]
    const { builder, calls } = makeBuilder({ data: products, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchProducts()

    expect(result).toEqual(products)
    expect(supabase.from).toHaveBeenCalledWith('productos')
    expect(calls.select).toEqual([['*, producto_costos(costo, proveedor_id)']])
    expect(calls.order).toEqual([['nombre', { ascending: true }]])
    expect(calls.range).toEqual([[0, 49]])
  })

  it('should_filter_by_search_term', async () => {
    const { builder, calls } = makeBuilder({ data: [], error: null })
    mocks.supabase.from.mockReturnValue(builder)

    await fetchProducts({ search: 'lana' })

    expect(calls.or).toEqual([['nombre.ilike.%lana%,sku.ilike.%lana%']])
  })

  it('should_filter_by_type', async () => {
    const { builder, calls } = makeBuilder({ data: [], error: null })
    mocks.supabase.from.mockReturnValue(builder)

    await fetchProducts({ tipo: 'hilo' })

    expect(calls.eq).toContainEqual(['tipo', 'hilo'])
  })

  it('should_return_empty_array_when_data_is_null', async () => {
    const { builder } = makeBuilder({ data: null, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchProducts()

    expect(result).toEqual([])
  })

  it('should_throw_when_supabase_returns_error', async () => {
    const { builder } = makeBuilder({ data: null, error: { message: 'db error' } })
    mocks.supabase.from.mockReturnValue(builder)

    await expect(fetchProducts()).rejects.toThrow('No se pudo cargar el catálogo')
  })
})

describe('fetchProductById', () => {
  it('should_return_a_product_when_found', async () => {
    const product = makeProduct()
    const { builder, calls } = makeBuilder({ data: product, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchProductById('p1')

    expect(result).toEqual(product)
    expect(calls.eq).toContainEqual(['id', 'p1'])
  })

  it('should_return_null_when_not_found', async () => {
    const { builder } = makeBuilder({ data: null, error: { code: 'PGRST116' } })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await fetchProductById('missing')

    expect(result).toBeNull()
  })
})

describe('findProductBySku', () => {
  it('should_return_product_matching_sku', async () => {
    const product = makeProduct()
    const { builder, calls } = makeBuilder({ data: product, error: null })
    mocks.supabase.from.mockReturnValue(builder)

    const result = await findProductBySku('123456')

    expect(result).toEqual(product)
    expect(calls.eq).toContainEqual(['sku', '123456'])
  })
})

describe('createProduct', () => {
  it('should_call_crear_producto_rpc_with_mapped_payload', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: 'new-id', error: null })

    const id = await createProduct({
      nombre: 'Lana Nueva',
      precio_venta: 5000,
      stock: 10,
      costo: 2500,
    })

    expect(id).toBe('new-id')
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('crear_producto', {
      p_producto: {
        sku: null,
        nombre: 'Lana Nueva',
        tipo: null,
        marca: null,
        grosor: null,
        peso_metraje: null,
        color_nombre: null,
        color_hex: null,
        precio_venta: 5000,
        stock: 10,
        stock_minimo: null,
        imagen_url: null,
      },
      p_costo: 2500,
      p_proveedor_id: undefined,
    })
  })

  it('should_throw_when_rpc_returns_error', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { message: 'solo admin' } })

    await expect(createProduct({ nombre: 'X', precio_venta: 1 })).rejects.toThrow(
      'No se pudo crear el producto'
    )
  })
})

describe('updateProduct', () => {
  it('should_call_actualizar_producto_rpc_with_mapped_payload', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: null })

    await updateProduct('p1', { nombre: 'Lana Editada', precio_venta: 6000, costo: 3000 })

    expect(mocks.supabase.rpc).toHaveBeenCalledWith('actualizar_producto', {
      p_id: 'p1',
      p_producto: {
        nombre: 'Lana Editada',
        precio_venta: 6000,
      },
      p_costo: 3000,
      p_proveedor_id: undefined,
      p_stock_delta: undefined,
    })
  })
})
