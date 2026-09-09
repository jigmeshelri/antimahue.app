import { describe, expect, it } from 'vitest'
import {
  $colorPalette,
  addToPalette,
  clearPalette,
  moveSelected,
  removeFromPalette,
  setNote,
  setRule,
  setSeed,
} from './paletaStore'
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

function emptyState() {
  return { seedId: null, rule: 'analogous' as const, selected: [], note: '' }
}

describe('paletaStore', () => {
  it('should_default_to_an_empty_state_with_analogous_rule', () => {
    clearPalette()
    expect($colorPalette.get()).toEqual(emptyState())
  })

  it('should_set_the_seed_product_id', () => {
    clearPalette()
    setSeed('p1')
    expect($colorPalette.get().seedId).toBe('p1')
  })

  it('should_clear_the_seed_when_set_to_null', () => {
    $colorPalette.set({ ...emptyState(), seedId: 'p1' })
    setSeed(null)
    expect($colorPalette.get().seedId).toBeNull()
  })

  it('should_set_the_harmony_rule', () => {
    clearPalette()
    setRule('triadic')
    expect($colorPalette.get().rule).toBe('triadic')
  })

  it('should_add_a_product_to_the_selected_palette', () => {
    clearPalette()
    addToPalette(makeProduct({ id: 'p1' }))
    expect($colorPalette.get().selected).toHaveLength(1)
    expect($colorPalette.get().selected[0].id).toBe('p1')
  })

  it('should_not_duplicate_a_product_already_in_the_palette', () => {
    clearPalette()
    addToPalette(makeProduct({ id: 'p1' }))
    addToPalette(makeProduct({ id: 'p1' }))
    expect($colorPalette.get().selected).toHaveLength(1)
  })

  it('should_append_products_in_add_order', () => {
    clearPalette()
    addToPalette(makeProduct({ id: 'p1' }))
    addToPalette(makeProduct({ id: 'p2' }))
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('should_remove_a_product_from_the_palette', () => {
    $colorPalette.set({
      ...emptyState(),
      selected: [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })],
    })
    removeFromPalette('p1')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p2'])
  })

  it('should_be_a_noop_when_removing_a_product_not_in_the_palette', () => {
    $colorPalette.set({ ...emptyState(), selected: [makeProduct({ id: 'p1' })] })
    removeFromPalette('unknown')
    expect($colorPalette.get().selected).toHaveLength(1)
  })

  it('should_move_a_selected_product_up_by_one_position', () => {
    $colorPalette.set({
      ...emptyState(),
      selected: [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' }), makeProduct({ id: 'p3' })],
    })
    moveSelected('p2', 'up')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
  })

  it('should_move_a_selected_product_down_by_one_position', () => {
    $colorPalette.set({
      ...emptyState(),
      selected: [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' }), makeProduct({ id: 'p3' })],
    })
    moveSelected('p2', 'down')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p1', 'p3', 'p2'])
  })

  it('should_be_a_noop_when_moving_the_first_product_up', () => {
    $colorPalette.set({
      ...emptyState(),
      selected: [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })],
    })
    moveSelected('p1', 'up')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('should_be_a_noop_when_moving_the_last_product_down', () => {
    $colorPalette.set({
      ...emptyState(),
      selected: [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })],
    })
    moveSelected('p2', 'down')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('should_be_a_noop_when_moving_an_unknown_product', () => {
    $colorPalette.set({ ...emptyState(), selected: [makeProduct({ id: 'p1' })] })
    moveSelected('unknown', 'up')
    expect($colorPalette.get().selected.map((p) => p.id)).toEqual(['p1'])
  })

  it('should_set_the_encargo_note', () => {
    clearPalette()
    setNote('Cliente busca celeste cielo')
    expect($colorPalette.get().note).toBe('Cliente busca celeste cielo')
  })

  it('should_reset_everything_with_clearPalette', () => {
    $colorPalette.set({
      seedId: 'p1',
      rule: 'complementary',
      selected: [makeProduct({ id: 'p1' })],
      note: 'nota',
    })
    clearPalette()
    expect($colorPalette.get()).toEqual(emptyState())
  })
})
