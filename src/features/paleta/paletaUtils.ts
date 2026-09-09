/**
 * Color-palette assistant pure utilities — hex↔HSL conversion, color
 * distance, harmony target generation, product ranking, and the WhatsApp
 * share text formatter.
 *
 * `hexToHsl` MUST stay numerically aligned with the SQL `hex_to_hsl()`
 * helper added in `supabase/migrations/20260908000000_color_palette_hsl.sql`
 * (same algorithm, same integer rounding) so that products' stored
 * `color_h/s/l` and any client-computed HSL are directly comparable.
 */
import { resolveStockStatus, type StockStatus } from '../catalogo/catalogoUtils'
import type { Product } from '../catalogo/catalogoTypes'

export type HarmonyRule = 'analogous' | 'complementary' | 'triadic'

export interface Hsl {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export interface SuggestedProduct {
  product: Product
  distance: number
  targetIndex: number
  /** Stock badge for this suggestion — out-of-stock items are still
   *  returned (never hidden) so the UI can show them disabled (D-open-1). */
  stockStatus: StockStatus
}

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

/** Convert a `#RRGGBB` hex color to HSL, rounded to integers. Mirrors the
 * SQL `hex_to_hsl()` function bit for bit. */
export function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const delta = max - min

  let h = 0
  let s = 0

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) {
      h = 60 * ((g - b) / delta)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** Convert HSL back to a `#RRGGBB` hex color (inverse of `hexToHsl`). */
export function hslToHex(hsl: Hsl): string {
  const h = normalizeHue(hsl.h)
  const s = hsl.s / 100
  const l = hsl.l / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** Rotate a color's hue by the given degrees, keeping saturation and
 * lightness. Wraps around the 0-360 circle. */
export function rotateHue(hsl: Hsl, degrees: number): Hsl {
  return { h: normalizeHue(hsl.h + degrees), s: hsl.s, l: hsl.l }
}

function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff)
}

/** Euclidean distance in HSL space, with hue treated as circular (e.g. hue
 * 350 vs 10 is 20 apart, not 340). */
export function colorDistance(a: Hsl, b: Hsl): number {
  const dh = hueDistance(a.h, b.h)
  const ds = a.s - b.s
  const dl = a.l - b.l
  return Math.sqrt(dh * dh + ds * ds + dl * dl)
}

/**
 * Generate theoretical target colors for a harmony rule (REQ-CPA-3).
 * - analogous: two neighbors ±30° from the seed.
 * - complementary: one color opposite the seed (+180°).
 * - triadic: the other two vertices of the seed's triad (+120°, +240°).
 */
export function generateTargets(seed: Hsl, rule: HarmonyRule): Hsl[] {
  switch (rule) {
    case 'analogous':
      return [rotateHue(seed, -30), rotateHue(seed, 30)]
    case 'complementary':
      return [rotateHue(seed, 180)]
    case 'triadic':
      return [rotateHue(seed, 120), rotateHue(seed, 240)]
  }
}

function hasStoredHsl(
  product: Product
): product is Product & { color_h: number; color_s: number; color_l: number } {
  return product.color_h != null && product.color_s != null && product.color_l != null
}

/**
 * Rank products by color distance to a single target, closest first
 * (REQ-CPA-4). Products without a stored HSL are excluded (nothing to rank
 * against). Out-of-stock products are NOT filtered out — they are flagged
 * via `stockStatus` so the UI can show them disabled instead of hiding them.
 */
export function rankProductsForTarget(
  target: Hsl,
  products: Product[],
  targetIndex = 0
): SuggestedProduct[] {
  return products
    .filter(hasStoredHsl)
    .map((product) => ({
      product,
      distance: colorDistance(target, {
        h: product.color_h,
        s: product.color_s,
        l: product.color_l,
      }),
      targetIndex,
      stockStatus: resolveStockStatus(product.stock, product.stock_minimo),
    }))
    .sort((a, b) => a.distance - b.distance)
}

/** Rank products against every target, tagging each suggestion with the
 * index of the target it was matched against. */
export function findClosestYarns(targets: Hsl[], products: Product[]): SuggestedProduct[] {
  return targets.flatMap((target, targetIndex) =>
    rankProductsForTarget(target, products, targetIndex)
  )
}

/**
 * Plain-text palette summary for sharing (REQ-CPA-7). Lists product names
 * and color names only — no prices, kept advisory per the design's open
 * question resolution.
 */
export function buildPaletteShareText(products: Product[]): string {
  const lines = products.map((product) =>
    product.color_nombre ? `- ${product.nombre} (${product.color_nombre})` : `- ${product.nombre}`
  )
  return ['Paleta de colores Antimahue:', ...lines].join('\n')
}

/** Build a `wa.me` share link carrying the URL-encoded palette text. */
export function buildWhatsappShareUrl(products: Product[]): string {
  return `https://wa.me/?text=${encodeURIComponent(buildPaletteShareText(products))}`
}
