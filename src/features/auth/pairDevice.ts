/**
 * Device-pairing orchestration — DD-3, REQ-AUTH-1 (T-3.1).
 *
 * Split into two functions to mirror the UX exactly (design.md §2 DD-3):
 * pairing has ONE network request (the admin-set enrollment login), and
 * everything after that is local crypto + an IndexedDB write.
 *
 * `signInForPairing` — Step 1: email + password → a real Supabase login.
 * This is the ONE network call D1/REQ-AUTH-1 permits anywhere in the
 * pairing/unlock lifecycle; every subsequent daily unlock (Phase 4) is
 * local-only.
 *
 * `completePairing` — Step 2: takes the session `signInForPairing` returned
 * plus the PIN the employee just chose (entered twice, matched by the
 * caller — `PairDeviceScreen.tsx`) and does the LOCAL work: derive the
 * AES-GCM key from the PIN, encrypt the session's refresh token, and
 * persist the vault record. The plaintext password never reaches this
 * function at all; the plaintext PIN and refresh token are used only to
 * produce ciphertext and are never themselves written anywhere.
 *
 * Extracted out of `PairDeviceScreen.tsx` (a plain module, no React/DOM)
 * specifically so this security-critical sequence is unit-testable without
 * a component-rendering harness — the screen is a thin container that calls
 * these two functions from its two form submit handlers.
 *
 * `rol` sourcing note (documented gap, see tasks.md Gaps §8): design.md §2
 * DD-3 step 4's literal pseudocode is exactly 4 steps (generateSalt →
 * deriveKey → encryptToken → putRecord) with no extra network fetch. `rol`
 * here is read from the session's own `app_metadata` (JWT-embedded,
 * service-role-only settable — see `handle_new_user()` / `enroll-empleado`)
 * rather than a fresh `profiles` SELECT, to match that literal sequence.
 * This value is a UI-shaping hint only (the PIN selector's avatar/rol
 * display, Phase 4 T-4.6) — RLS/RPC remains the sole authorization boundary
 * (DD-8), so a stale hint here has no security consequence. REQ-AUTH-4's
 * "fresh `profiles` read on every session establishment" requirement is
 * fulfilled by Phase 4's `usePinUnlock`, whose own task description already
 * claims that responsibility.
 */
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { deriveKey, encryptToken, generateSalt } from '@/lib/crypto'
import { putRecord, type Rol, type VaultRecord } from '@/lib/vault'

/** Thrown for any pairing failure meant to surface as a user-facing message. */
export class PairingError extends Error {}

function isRol(value: unknown): value is Rol {
  return value === 'admin' || value === 'empleado'
}

/**
 * Step 1 — the one network request pairing requires. Throws `PairingError`
 * with a user-facing message on invalid credentials or a missing session;
 * never returns or logs the password.
 */
export async function signInForPairing(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    throw new PairingError(error?.message ?? 'No se pudo iniciar sesión.')
  }

  return data.session
}

/**
 * Step 2 — zero network calls. Derives the PIN key, encrypts the session's
 * refresh token, and persists the vault record so the profile appears in
 * the PIN selector (Phase 4). Returns the record that was written.
 */
export async function completePairing(session: Session, pin: string): Promise<VaultRecord> {
  const rol: Rol = isRol(session.user.app_metadata?.rol)
    ? session.user.app_metadata.rol
    : 'empleado'

  const salt = generateSalt()
  const key = await deriveKey(pin, salt)
  const { ciphertext, iv } = await encryptToken(session.refresh_token, key)

  const record: VaultRecord = {
    userId: session.user.id,
    displayName:
      (session.user.user_metadata?.display_name as string | undefined) ??
      session.user.email ??
      'Vendedora',
    rol,
    salt,
    iv,
    ciphertext,
    failCount: 0,
    lockedUntil: null,
    pairedAt: Date.now(),
  }

  await putRecord(record)

  return record
}
