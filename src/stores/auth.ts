/**
 * Auth store — D2, DD-7 (nanostores).
 *
 * Holds the current Supabase session state.
 * Populated by the onAuthStateChange listener in main.tsx.
 * Components read this atom via useStore() from @nanostores/react.
 *
 * `rol` (REQ-AUTH-4): resolved by reading the caller's own `profiles` row
 * after every session establishment (fresh login or PIN unlock) — never
 * trusted from a stale client cache for an authorization decision. `Rol` is
 * defined in `src/lib/vault.ts` (single source of truth for the union — the
 * generated DB type for `profiles.rol` is plain `string`).
 *
 * `status` (DD-7/DD-9): the local unlock state machine driving route guards
 * and the idle auto-lock. `'locked'` — no usable in-memory access token,
 * `PinScreen` shows. `'unlocking'` — a PIN attempt is being verified.
 * `'unlocked'` — a valid in-memory session exists.
 */
import { atom } from 'nanostores'
import type { Session, User } from '@supabase/supabase-js'
import type { Rol } from '@/lib/vault'

export interface AuthState {
  session: Session | null
  user: User | null
  rol: Rol | null
  status: 'locked' | 'unlocking' | 'unlocked'
  loading: boolean
}

export const $auth = atom<AuthState>({
  session: null,
  user: null,
  rol: null,
  status: 'locked',
  loading: true,
})
