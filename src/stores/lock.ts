/**
 * PIN lockout store — DD-2 (nanostores).
 *
 * Tracks the CLIENT-SIDE lockout state for PIN unlock attempts. This is the
 * reactive UI projection of the same counters persisted durably in the vault
 * record (`src/lib/vault.ts` `VaultRecord.failCount`/`lockedUntil`) — the
 * vault is the source of truth (a reload must not reset the counter, or a
 * shared/borrowed phone could bypass lockout by refreshing the page).
 *
 * Backoff table (`failCount` = consecutive AES-GCM auth-tag failures; a
 * successful decrypt resets it to 0):
 *
 *   1-4  → retry immediately (fat-finger tolerance)
 *   5    → 30 s cooldown
 *   6    → 2 min
 *   7    → 10 min
 *   8    → 1 h
 *   9    → WIPE the local encrypted blob; re-pairing (email+password + a new
 *          PIN) is required — this is a terminal client-side event, not an
 *          account ban (that is admin revocation, D5/DD-6).
 *
 * IMPORTANT — this replaces a previous, INCORRECT version of this comment
 * that claimed lockout state is "mirrored to the server" (`auth_attempts`)
 * as defense in depth. That is false: the daily PIN unlock is OFFLINE and
 * has no authenticated session yet (the refresh token is still encrypted),
 * so an anon client has zero grants to write `auth_attempts` (deny-by-default
 * RLS) — there is nothing to mirror to during an offline failure.
 * `auth_attempts` only records AUTHENTICATED events (successful unlocks,
 * enrollment/re-pair logins) as telemetry; it is NOT an offline gate. The
 * real backstop against an exfiltrated blob is PBKDF2 at 600,000 iterations
 * (`src/lib/crypto.ts`) — this lockout is casual/UI defense only.
 */
import { atom } from 'nanostores'

export interface LockState {
  failCount: number
  lockedUntil: number | null // Unix ms timestamp; null = not locked
  requiresRelogin: boolean // true when failCount >= 9 (terminal — blob wiped)
}

export const $lock = atom<LockState>({
  failCount: 0,
  lockedUntil: null,
  requiresRelogin: false,
})

/** Consecutive-failure count at which the vault is wiped instead of cooling down. */
const WIPE_THRESHOLD = 9

/** Cooldown duration in ms for a given (post-increment) failCount. 0 = no cooldown. */
function cooldownMsFor(failCount: number): number {
  switch (failCount) {
    case 5:
      return 30 * 1_000
    case 6:
      return 2 * 60 * 1_000
    case 7:
      return 10 * 60 * 1_000
    case 8:
      return 60 * 60 * 1_000
    default:
      return 0
  }
}

/**
 * Compute the LockState that follows one more PIN failure, per the DD-2
 * backoff table above. `previousFailCount` is the count BEFORE this failure
 * (i.e. the current `$lock.get().failCount`); `now` defaults to `Date.now()`
 * and is only overridable for deterministic tests.
 *
 * Callers (Phase 4's `usePinUnlock`) are responsible for persisting the
 * result into the vault record and, when `requiresRelogin` is true, calling
 * `deleteRecord(userId)` and routing to re-pairing — this function only
 * computes the pure state transition.
 */
export function nextLockState(previousFailCount: number, now: number = Date.now()): LockState {
  const failCount = previousFailCount + 1

  if (failCount >= WIPE_THRESHOLD) {
    return { failCount, lockedUntil: null, requiresRelogin: true }
  }

  const cooldown = cooldownMsFor(failCount)
  return {
    failCount,
    lockedUntil: cooldown > 0 ? now + cooldown : null,
    requiresRelogin: false,
  }
}

/** Returns true if the current time is before lockedUntil. */
export function isLocked(state: LockState): boolean {
  if (state.lockedUntil === null) return false
  return Date.now() < state.lockedUntil
}
