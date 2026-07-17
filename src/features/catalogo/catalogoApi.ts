import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Product, ProductFilters, ProductInput } from './catalogoTypes'

const PRODUCT_SELECT = '*, producto_costos(costo, proveedor_id)'

function buildProductQuery() {
  return supabase.from('productos').select(PRODUCT_SELECT)
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<Product[]> {
  let query = buildProductQuery().order('nombre', { ascending: true })

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  if (filters.search) {
    query = query.or(`nombre.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
  }

  if (filters.tipo && filters.tipo !== 'todos') {
    query = query.eq('tipo', filters.tipo)
  }

  const { data, error } = await query
  if (error) throw new Error('No se pudo cargar el catálogo')
  return (data as Product[]) ?? []
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await buildProductQuery().eq('id', id).single()
  if (error) return null
  return data as Product
}

export async function findProductBySku(sku: string): Promise<Product | null> {
  const { data, error } = await buildProductQuery().eq('sku', sku).single()
  if (error) return null
  return data as Product
}

function toRpcProduct(input: ProductInput): Record<string, Json | undefined> {
  return {
    sku: input.sku ?? null,
    nombre: input.nombre,
    tipo: input.tipo ?? null,
    marca: input.marca ?? null,
    grosor: input.grosor ?? null,
    peso_metraje: input.peso_metraje ?? null,
    color_nombre: input.color_nombre ?? null,
    color_hex: input.color_hex ?? null,
    precio_venta: input.precio_venta,
    stock: input.stock ?? 0,
    stock_minimo: input.stock_minimo ?? null,
    imagen_url: input.imagen_url ?? null,
  }
}

function toRpcProductPatch(input: Partial<ProductInput>): Record<string, Json | undefined> {
  const payload: Record<string, Json | undefined> = {}
  const fields: (keyof ProductInput)[] = [
    'sku',
    'nombre',
    'tipo',
    'marca',
    'grosor',
    'peso_metraje',
    'color_nombre',
    'color_hex',
    'precio_venta',
    'stock',
    'stock_minimo',
    'imagen_url',
  ]
  for (const key of fields) {
    if (key in input) {
      payload[key] = input[key] ?? null
    }
  }
  return payload
}

export async function createProduct(input: ProductInput): Promise<string> {
  const { data, error } = await supabase.rpc('crear_producto', {
    p_producto: toRpcProduct(input),
    p_costo: input.costo ?? undefined,
    p_proveedor_id: input.proveedor_id ?? undefined,
  })
  if (error || !data) throw new Error('No se pudo crear el producto')
  return data as string
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const { error } = await supabase.rpc('actualizar_producto', {
    p_id: id,
    p_producto: toRpcProductPatch(input),
    p_costo: input.costo ?? undefined,
    p_proveedor_id: input.proveedor_id ?? undefined,
    p_stock_delta: undefined,
  })
  if (error) throw new Error('No se pudo actualizar el producto')
}
