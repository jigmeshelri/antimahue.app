/**
 * Catalog domain types — productos, producto_costos and related filters.
 *
 * These mirror the Supabase generated types but are narrowed for the catalog
 * feature (e.g. ProductType union, Product shape with embedded costo).
 */

export type ProductType = 'lana' | 'algodon' | 'hilo' | 'palillo' | 'crochet' | 'accesorio'

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  lana: 'Lana',
  algodon: 'Algodón',
  hilo: 'Hilo',
  palillo: 'Palillo',
  crochet: 'Crochet',
  accesorio: 'Accesorio',
}

export interface Product {
  id: string
  sku: string | null
  nombre: string
  tipo: ProductType | null
  marca: string | null
  grosor: string | null
  peso_metraje: string | null
  color_nombre: string | null
  color_hex: string | null
  precio_venta: number
  stock: number
  stock_minimo: number | null
  imagen_url: string | null
  created_at: string
  updated_at: string
  producto_costos: {
    costo: number
    proveedor_id: string | null
  } | null
}

export interface ProductFilters {
  search?: string
  tipo?: ProductType | 'todos'
  limit?: number
  offset?: number
}

export interface ProductInput {
  sku?: string | null
  nombre: string
  tipo?: ProductType | null
  marca?: string | null
  grosor?: string | null
  peso_metraje?: string | null
  color_nombre?: string | null
  color_hex?: string | null
  precio_venta: number
  stock?: number
  stock_minimo?: number | null
  imagen_url?: string | null
  costo?: number | null
  proveedor_id?: string | null
}
