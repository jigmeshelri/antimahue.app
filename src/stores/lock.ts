/**
 * PIN lockout store — D2, D5 (nanostores).
 *
 * Tracks the client-side lockout state for PIN unlock attempts.
 * The lockout thresholds mirror the backoff table in design.md D5:
 *
 *   1-4 attempts  → allow, increment counter
 *   5             → lock 30 s
 *   6             → lock 5 min
 *   7             → lock 1 h
 *   8+            → lock 24 h + require full re-login, wipe encrypted token
 *
 * NOTE: This state is also mirrored to the server (auth_attempts table, T5).
 * A wipe-IndexedDB attacker still faces server-side throttle — defense in depth.
 */
import { atom } from 'nanostores'

export interface LockState {
  failCount: number
  lockedUntil: number | null  // Unix ms timestamp; null = not locked
  requiresRelogin: boolean    // true when failCount >= 8
}

export const $lock = atom<LockState>({
  failCount: 0,
  lockedUntil: null,
  requiresRelogin: false,
})

/** Returns true if the current time is before lockedUntil. */
export function isLocked(state: LockState): boolean {
  if (state.lockedUntil === null) return false
  return Date.now() < state.lockedUntil
}
