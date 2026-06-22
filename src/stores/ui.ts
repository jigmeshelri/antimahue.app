/**
 * Global UI flags store — D2 (nanostores).
 *
 * Holds presentation-only state that doesn't belong in any feature slice.
 */
import { atom } from 'nanostores'

export interface UiState {
  sidebarOpen: boolean
  toastMessage: string | null
  toastType: 'info' | 'success' | 'error' | null
}

export const $ui = atom<UiState>({
  sidebarOpen: false,
  toastMessage: null,
  toastType: null,
})
