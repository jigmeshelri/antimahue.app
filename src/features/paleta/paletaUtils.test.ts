/**
 * paletaUtils tests — TDD for the color-palette assistant's pure logic.
 *
 * hexToHsl rounding MUST agree with the SQL `hex_to_hsl()` helper in
 * `supabase/migrations/20260908000000_color_palette_hsl.sql` (REQ-CPA-3/4).
 */
import { describe, expect, it } from 'vitest'
import {
  buildPaletteShareText,
  buildWhatsappShareUrl,
  colorDistance,
  findClosestYarns,
  generateTargets,
  hexToHsl,
  hslToHex,
  rankProductsForTarget,
  rotateHue,
} from './paletaUtils'
import type { Product } from '../catalogo/catalogoTypes'

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

describe('hexToHsl', () => {
  it('should_convert_pure_red', () => {
    expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 })
  })

  it('should_convert_pure_green', () => {
    expect(hexToHsl('#00FF00')).toEqual({ h: 120, s: 100, l: 50 })
  })

  it('should_convert_pure_blue', () => {
    expect(hexToHsl('#0000FF')).toEqual({ h: 240, s: 100, l: 50 })
  })

  it('should_convert_white_to_zero_saturation', () => {
    expect(hexToHsl('#FFFFFF')).toEqual({ h: 0, s: 0, l: 100 })
  })

  it('should_convert_black_to_zero_lightness', () => {
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 })
  })

  it('should_convert_gray_to_zero_saturation', () => {
    expect(hexToHsl('#808080')).toEqual({ h: 0, s: 0, l: 50 })
  })

  it('should_round_to_integers', () => {
    const hsl = hexToHsl('#C84A3A')
    expect(Number.isInteger(hsl.h)).toBe(true)
    expect(Number.isInteger(hsl.s)).toBe(true)
    expect(Number.isInteger(hsl.l)).toBe(true)
  })
})

describe('hslToHex', () => {
  it('should_convert_pure_red_back_to_hex', () => {
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#FF0000')
  })

  it('should_convert_pure_green_back_to_hex', () => {
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00FF00')
  })

  it('should_convert_pure_blue_back_to_hex', () => {
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000FF')
  })

  it('should_round_trip_through_hexToHsl', () => {
    expect(hslToHex(hexToHsl('#FF0000'))).toBe('#FF0000')
  })
})

describe('rotateHue', () => {
  it('should_add_degrees_and_keep_saturation_and_lightness', () => {
    expect(rotateHue({ h: 10, s: 70, l: 50 }, 30)).toEqual({ h: 40, s: 70, l: 50 })
  })

  it('should_wrap_around_past_360', () => {
    expect(rotateHue({ h: 350, s: 70, l: 50 }, 30)).toEqual({ h: 20, s: 70, l: 50 })
  })

  it('should_wrap_around_below_zero', () => {
    expect(rotateHue({ h: 10, s: 70, l: 50 }, -30)).toEqual({ h: 340, s: 70, l: 50 })
  })
})

describe('colorDistance', () => {
  it('should_return_zero_for_identical_colors', () => {
    expect(colorDistance({ h: 10, s: 50, l: 50 }, { h: 10, s: 50, l: 50 })).toBe(0)
  })

  it('should_compute_euclidean_distance_in_saturation_and_lightness', () => {
    expect(colorDistance({ h: 0, s: 0, l: 0 }, { h: 0, s: 3, l: 4 })).toBe(5)
  })

  it('should_treat_hue_as_circular_near_the_0_360_seam', () => {
    // 350 vs 10 is 20 apart on the wheel, not 340.
    const distance = colorDistance({ h: 350, s: 50, l: 50 }, { h: 10, s: 50, l: 50 })
    expect(distance).toBe(20)
  })

  it('should_use_the_short_way_around_for_hues_far_apart', () => {
    // 0 vs 200 -> short way is 160 (360-200), not 200.
    const distance = colorDistance({ h: 0, s: 0, l: 0 }, { h: 200, s: 0, l: 0 })
    expect(distance).toBe(160)
  })
})

describe('generateTargets', () => {
  const seed = { h: 0, s: 70, l: 50 }

  it('should_generate_two_neighbors_30_degrees_apart_for_analogous', () => {
    const targets = generateTargets(seed, 'analogous')
    const hues = targets.map((t) => t.h).sort((a, b) => a - b)
    expect(hues).toEqual([30, 330])
    for (const t of targets) {
      expect(t.s).toBe(70)
      expect(t.l).toBe(50)
    }
  })

  it('should_generate_one_opposite_hue_for_complementary', () => {
    const targets = generateTargets(seed, 'complementary')
    expect(targets).toHaveLength(1)
    expect(targets[0].h).toBe(180)
  })

  it('should_generate_two_hues_spaced_120_degrees_apart_for_triadic', () => {
    const targets = generateTargets(seed, 'triadic')
    expect(targets).toHaveLength(2)
    const hues = targets.map((t) => t.h).sort((a, b) => a - b)
    expect(hues).toEqual([120, 240])
    expect(colorDistance(targets[0], targets[1])).toBe(120)
  })

  it('should_preserve_saturation_and_lightness_from_the_seed', () => {
    const customSeed = { h: 200, s: 40, l: 60 }
    const targets = generateTargets(customSeed, 'complementary')
    expect(targets[0].s).toBe(40)
    expect(targets[0].l).toBe(60)
  })
})

describe('rankProductsForTarget', () => {
  it('should_rank_the_closest_product_first', () => {
    const closer = makeProduct({ id: 'close', color_h: 175, color_s: 68, color_l: 52 })
    const farther = makeProduct({ id: 'far', color_h: 90, color_s: 50, color_l: 50 })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [farther, closer])

    expect(ranked[0].product.id).toBe('close')
    expect(ranked[1].product.id).toBe('far')
    expect(ranked[0].distance).toBeLessThan(ranked[1].distance)
  })

  it('should_return_distance_zero_for_an_exact_match', () => {
    const exact = makeProduct({ id: 'exact', color_h: 180, color_s: 70, color_l: 50 })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [exact])

    expect(ranked[0].distance).toBe(0)
  })

  it('should_exclude_products_without_stored_hsl', () => {
    const noColor = makeProduct({ id: 'no-color', color_h: null, color_s: null, color_l: null })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [noColor])

    expect(ranked).toHaveLength(0)
  })

  it('should_include_out_of_stock_products_flagged_instead_of_hiding_them', () => {
    const outOfStock = makeProduct({ id: 'out', stock: 0, color_h: 180, color_s: 70, color_l: 50 })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [outOfStock])

    expect(ranked).toHaveLength(1)
    expect(ranked[0].stockStatus).toBe('out')
  })

  it('should_flag_low_stock_and_ok_stock_correctly', () => {
    const low = makeProduct({
      id: 'low',
      stock: 2,
      stock_minimo: 5,
      color_h: 180,
      color_s: 70,
      color_l: 50,
    })
    const ok = makeProduct({
      id: 'ok',
      stock: 20,
      stock_minimo: 5,
      color_h: 180,
      color_s: 70,
      color_l: 50,
    })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [low, ok])

    expect(ranked.find((r) => r.product.id === 'low')?.stockStatus).toBe('low')
    expect(ranked.find((r) => r.product.id === 'ok')?.stockStatus).toBe('ok')
  })

  it('should_tag_every_suggestion_with_the_given_target_index', () => {
    const product = makeProduct({ id: 'p', color_h: 180, color_s: 70, color_l: 50 })
    const target = { h: 180, s: 70, l: 50 }

    const ranked = rankProductsForTarget(target, [product], 2)

    expect(ranked[0].targetIndex).toBe(2)
  })
})

describe('findClosestYarns', () => {
  it('should_rank_products_per_target_and_tag_with_the_matching_target_index', () => {
    const forFirst = makeProduct({ id: 'first', color_h: 30, color_s: 70, color_l: 50 })
    const forSecond = makeProduct({ id: 'second', color_h: 330, color_s: 70, color_l: 50 })
    const targets = [
      { h: 30, s: 70, l: 50 },
      { h: 330, s: 70, l: 50 },
    ]

    const suggestions = findClosestYarns(targets, [forFirst, forSecond])

    const firstTargetMatches = suggestions.filter((s) => s.targetIndex === 0)
    const secondTargetMatches = suggestions.filter((s) => s.targetIndex === 1)
    expect(firstTargetMatches[0].product.id).toBe('first')
    expect(secondTargetMatches[0].product.id).toBe('second')
  })

  it('should_return_an_empty_array_when_there_are_no_targets', () => {
    expect(findClosestYarns([], [makeProduct()])).toEqual([])
  })
})

describe('buildPaletteShareText', () => {
  it('should_list_product_names_and_colors_without_prices', () => {
    const products = [
      makeProduct({ id: 'a', nombre: 'Lana Merino', color_nombre: 'Rojo Terracota' }),
      makeProduct({ id: 'b', nombre: 'Hilo Algodón', color_nombre: 'Azul Cielo' }),
    ]

    const text = buildPaletteShareText(products)

    expect(text).toContain('Lana Merino')
    expect(text).toContain('Rojo Terracota')
    expect(text).toContain('Hilo Algodón')
    expect(text).toContain('Azul Cielo')
    expect(text).not.toMatch(/\$/)
    expect(text).not.toContain(String(products[0].precio_venta))
  })

  it('should_fall_back_to_the_product_name_alone_when_color_name_is_missing', () => {
    const product = makeProduct({ nombre: 'Lana Sin Nombre De Color', color_nombre: null })
    const text = buildPaletteShareText([product])
    expect(text).toContain('Lana Sin Nombre De Color')
  })
})

describe('buildWhatsappShareUrl', () => {
  it('should_build_a_wa_me_link_with_the_encoded_share_text', () => {
    const products = [makeProduct({ nombre: 'Lana Merino', color_nombre: 'Rojo' })]
    const url = buildWhatsappShareUrl(products)
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    const encodedText = url.replace('https://wa.me/?text=', '')
    expect(decodeURIComponent(encodedText)).toBe(buildPaletteShareText(products))
  })
})
