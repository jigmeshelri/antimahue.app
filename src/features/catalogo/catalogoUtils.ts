/**
 * Catalog pure utilities — formatting, stock resolution, product metadata.
 */
import type { Product } from './catalogoTypes'

export type StockStatus = 'ok' | 'low' | 'out'

/**
 * Format a price in Chilean pesos (CLP).
 * Examples: 4800 → "$4.800", 1250000 → "$1.250.000".
 */
export function formatPrice(value: number): string {
  return `$${value.toLocaleString('es-CL')}`
}

/**
 * Resolve stock status against a minimum threshold.
 * A null/undefined minimum falls back to `defaultMinimo` (5 by default).
 */
export function resolveStockStatus(
  stock: number,
  minimo: number | null | undefined,
  defaultMinimo = 5
): StockStatus {
  const effectiveMinimo = minimo ?? defaultMinimo
  if (stock === 0) return 'out'
  if (stock < effectiveMinimo) return 'low'
  return 'ok'
}

/**
 * Build a concise subtitle for a product card from marca, grosor and color.
 * Falls back to the product type, then empty string.
 */
export function productSubtitle(product: Product): string {
  const parts = [product.marca, product.grosor, product.color_nombre].filter(Boolean)
  return parts.join(' · ') || (product.tipo ?? '')
}

/**
 * Compute gross margin percentage given sale price and cost.
 * Returns null when cost is missing (employee view or unsaved cost).
 */
export function computeMargin(
  precioVenta: number,
  costo: number | null | undefined
): number | null {
  if (costo == null) return null
  const margin = ((precioVenta - costo) / precioVenta) * 100
  return Math.round(margin * 10) / 10
}
