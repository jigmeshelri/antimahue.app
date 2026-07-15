/**
 * Daily PIN-unlock orchestration — Phase 4 (T-4.8; REQ-AUTH-1, REQ-AUTH-2,
 * REQ-AUTH-4; DD-2, DD-7).
 *
 * Mirrors the `pairDevice.ts` / `PairDeviceScreen.tsx` split (T-3.1): this
 * module is plain orchestration (no React), unit-testable without a
 * rendering harness by mocking ONLY the supabase auth/profiles network
 * boundary — `@/lib/crypto` (PBKDF2 600k + AES-GCM) and `@/lib/vault`
 * (fake-indexeddb) run for real. `usePinUnlock.ts` wraps this with the
 * digit-accumulation React state machine. Writing directly to the
 * `$auth`/`$lock` nanostores from here is safe and fully testable — a
 * nanostore atom is a plain object with `.get()`/`.set()`, it needs no
 * React rendering to exercise.
 *
 * Sequence (design.md §5): getRecord → deriveKey → decryptToken →
 * refreshSession({refresh_token}) → RE-ENCRYPT the rotated refresh token
 * (supabase-js rotates it on every refresh; the OLD token in the vault is
 * spent the instant refreshSession succeeds — persisting the new one is
 * not optional, or the very next unlock attempt decrypts a dead token) →
 * reset failCount → fresh `profiles` read for rol/activo (REQ-AUTH-4).
 *
 * Token rotation happens BEFORE the `activo` gate below, deliberately: the
 * PIN was correct and the old vault token is already consumed either way,
 * so persisting the new one is what keeps "vault intact" meaningful for a
 * later admin restore (Phase 7) — if we skipped rotation for an inactive
 * user, restoring them would strand the vault with an already-rotated,
 * useless token and force an unnecessary re-pairing.
 */
import { supabase } from '@/lib/supabase'
import { decryptToken, deriveKey, encryptToken } from '@/lib/crypto'
import { deleteRecord, getRecord, putRecord, type Rol } from '@/lib/vault'
import { $lock, isLocked, nextLockState, type LockState } from '@/stores/lock'
import { $auth } from '@/stores/auth'

export type PinUnlockErrorKind =
  | 'not-paired' // no vault record for this userId at all
  | 'locked' // cooldown window still active — no decrypt attempted
  | 'wrong-pin' // GCM auth-tag failure — wrong PIN
  | 'wiped' // 9th consecutive failure — vault record deleted
  | 'session-invalid' // decrypted fine, but refreshSession rejected the token
  | 'inactive' // decrypted fine, session valid, but profiles.activo = false

/** Thrown for any unlock failure meant to surface as a user-facing message. */
export class PinUnlockError extends Error {
  constructor(
    message: string,
    readonly kind: PinUnlockErrorKind
  ) {
    super(message)
  }
}

export interface UnlockResult {
  rol: Rol
}

function isRol(value: unknown): value is Rol {
  return value === 'admin' || value === 'empleado'
}

const NEUTRAL_LOCK: LockState = { failCount: 0, lockedUntil: null, requiresRelogin: false }

/**
 * Reads the durable lockout counters straight from the vault record (the
 * source of truth per DD-2) and mirrors them into `$lock` for reactive UI
 * reads. Callers (the hook, on mount / on user-selection change) use this
 * to prime the countdown display without waiting for a failed attempt.
 */
export async function syncLockFromVault(userId: string): Promise<void> {
  const record = await getRecord(userId)
  $lock.set(
    record
      ? { failCount: record.failCount, lockedUntil: record.lockedUntil, requiresRelogin: false }
      : NEUTRAL_LOCK
  )
}

/**
 * Attempts to unlock `userId`'s session with `pin`. Zero network calls
 * happen until the PIN decrypts correctly (REQ-AUTH-1) — a wrong PIN, or an
 * attempt made during an active cooldown, never reaches `refreshSession`.
 */
export async function attemptUnlock(userId: string, pin: string): Promise<UnlockResult> {
  const record = await getRecord(userId)
  if (!record) {
    throw new PinUnlockError('Este dispositivo no está vinculado a esta cuenta.', 'not-paired')
  }

  const currentLock: LockState = {
    failCount: record.failCount,
    lockedUntil: record.lockedUntil,
    requiresRelogin: false,
  }
  if (isLocked(currentLock)) {
    $lock.set(currentLock)
    throw new PinUnlockError('Espera antes de volver a intentar.', 'locked')
  }

  let refreshToken: string
  try {
    const key = await deriveKey(pin, record.salt)
    refreshToken = await decryptToken({ ciphertext: record.ciphertext, iv: record.iv }, key)
  } catch {
    // AES-GCM auth-tag failure — wrong PIN. Apply the DD-2 backoff curve.
    const next = nextLockState(record.failCount)
    $lock.set(next)
    if (next.requiresRelogin) {
      await deleteRecord(userId)
      throw new PinUnlockError('Demasiados intentos. Vuelve a vincular este dispositivo.', 'wiped')
    }
    await putRecord({ ...record, failCount: next.failCount, lockedUntil: next.lockedUntil })
    throw new PinUnlockError('PIN incorrecto.', 'wrong-pin')
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  })
  if (refreshError || !refreshData.session) {
    // The blob decrypted fine, but the token itself is no longer valid
    // server-side (rotated elsewhere, account deleted, etc.) — the stale
    // blob is worthless, so re-pairing is the only way forward.
    await deleteRecord(userId)
    $lock.set({ ...NEUTRAL_LOCK, requiresRelogin: true })
    throw new PinUnlockError(
      'La sesión venció. Vuelve a vincular este dispositivo.',
      'session-invalid'
    )
  }

  const newSession = refreshData.session

  // Token rotation (design.md §5) — see module header for why this MUST
  // happen before the activo gate below.
  const rotationKey = await deriveKey(pin, record.salt)
  const { ciphertext, iv } = await encryptToken(newSession.refresh_token, rotationKey)
  await putRecord({ ...record, ciphertext, iv, failCount: 0, lockedUntil: null })
  $lock.set(NEUTRAL_LOCK)

  // REQ-AUTH-4: resolve rol/activo from a FRESH profiles read, never from
  // the vault's cached `rol` hint — that hint is UI-shaping only (DD-8).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', newSession.user.id)
    .single()

  if (profileError || !profile || !isRol(profile.rol)) {
    throw new PinUnlockError('No se pudo confirmar tu perfil. Intenta de nuevo.', 'session-invalid')
  }

  if (!profile.activo) {
    // Correct PIN, valid rotated session — but the account was revoked
    // (Phase 7). This is an authorization refusal, not a PIN failure: the
    // vault record stays (already rotated above, failCount already reset),
    // and `refreshSession`'s own `onAuthStateChange` side effect (main.tsx)
    // must be corrected back to "locked" here — RLS/RPC remains the real
    // boundary (DD-8), this merely stops the UI from admitting a revoked
    // user for the remainder of this tab's lifetime.
    $auth.set({ session: null, user: null, rol: null, status: 'locked', loading: false })
    throw new PinUnlockError('Tu acceso fue desactivado. Consulta con Angélica.', 'inactive')
  }

  $auth.set({ ...$auth.get(), rol: profile.rol, status: 'unlocked' })
  return { rol: profile.rol }
}
