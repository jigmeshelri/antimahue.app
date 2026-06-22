/**
 * Auth store — D2 (nanostores).
 *
 * Holds the current Supabase session state.
 * Populated by the onAuthStateChange listener in main.tsx.
 * Components read this atom via useStore() from @nanostores/react.
 */
import { atom } from 'nanostores'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

export const $auth = atom<AuthState>({
  session: null,
  user: null,
  loading: true,
})
