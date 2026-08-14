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

/**
 * Show a transient toast message.
 * The Toast organism reads $ui and auto-dismisses after ~4 seconds.
 */
export function showToast(
  message: string,
  type: Exclude<UiState['toastType'], null> = 'info'
): void {
  $ui.set({ ...$ui.get(), toastMessage: message, toastType: type })
}

/**
 * Clear the current toast manually.
 */
export function clearToast(): void {
  $ui.set({ ...$ui.get(), toastMessage: null, toastType: null })
}
