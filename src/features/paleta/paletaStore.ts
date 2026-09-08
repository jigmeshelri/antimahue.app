/**
 * Color-palette assistant store — D3 (dedicated nanostore).
 *
 * Holds the in-progress palette being built in PaletaScreen: the seed
 * product, the chosen harmony rule, the selected products, and the
 * encargo note. Mirrors the `saleDraft` store's plain-atom + function-actions
 * pattern. Reorder is add/remove + tap-to-move (D6) — no drag-and-drop.
 */
import { atom } from 'nanostores'
import type { Product } from '../catalogo/catalogoTypes'
import type { HarmonyRule } from './paletaUtils'

export interface PaletteState {
  seedId: string | null
  rule: HarmonyRule
  selected: Product[]
  note: string
}

const EMPTY_STATE: PaletteState = {
  seedId: null,
  rule: 'analogous',
  selected: [],
  note: '',
}

export const $colorPalette = atom<PaletteState>({ ...EMPTY_STATE })

/** Select (or clear, with `null`) the seed product for palette generation. */
export function setSeed(productId: string | null): void {
  $colorPalette.set({ ...$colorPalette.get(), seedId: productId })
}

/** Choose the active harmony rule. */
export function setRule(rule: HarmonyRule): void {
  $colorPalette.set({ ...$colorPalette.get(), rule })
}

/** Add a product to the palette. No-op if it is already selected. */
export function addToPalette(product: Product): void {
  const state = $colorPalette.get()
  if (state.selected.some((p) => p.id === product.id)) return
  $colorPalette.set({ ...state, selected: [...state.selected, product] })
}

/** Remove a product from the palette by id. No-op if not present. */
export function removeFromPalette(productId: string): void {
  const state = $colorPalette.get()
  $colorPalette.set({ ...state, selected: state.selected.filter((p) => p.id !== productId) })
}

/**
 * Move a selected product one position up or down (tap-to-move, D6).
 * No-op at the boundaries (moving the first item up, or the last item down)
 * and for unknown product ids.
 */
export function moveSelected(productId: string, direction: 'up' | 'down'): void {
  const state = $colorPalette.get()
  const index = state.selected.findIndex((p) => p.id === productId)
  if (index < 0) return

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= state.selected.length) return

  const reordered = [...state.selected]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  $colorPalette.set({ ...state, selected: reordered })
}

/** Set the customer note for an out-of-stock encargo (REQ-CPA-8). */
export function setNote(note: string): void {
  $colorPalette.set({ ...$colorPalette.get(), note })
}

/** Reset the whole palette to its default empty state. */
export function clearPalette(): void {
  $colorPalette.set({ ...EMPTY_STATE })
}
