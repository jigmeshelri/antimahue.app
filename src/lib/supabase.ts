/**
 * Supabase shared browser client — D3, DD-7.
 *
 * Single instance. Only the publishable key is used here.
 * service_role MUST NEVER appear in this file or anywhere under src/.
 * See design.md D3/D4/DD-7 and REQ-SETUP-9.
 *
 * Session token strategy (DD-7 — supersedes the earlier D4 draft):
 * - persistSession: false → supabase-js NEVER writes the session to its own
 *   storage adapter. The default (`localStorage`, `persistSession: true`)
 *   would leave the refresh token sitting in PLAINTEXT on disk, which
 *   defeats the entire point of the PIN-encrypted vault (DD-1) — anyone
 *   with filesystem/devtools access to the device could lift it directly.
 * - storage: an in-memory shim (below), belt-and-suspenders alongside
 *   `persistSession: false` — nothing supabase-js does here ever touches
 *   disk. The session lives only for the lifetime of this tab/SW instance.
 * - autoRefreshToken: true → keeps the access token warm in memory while
 *   the app is unlocked; a fresh tab/reload starts locked (no session to
 *   restore) and requires PIN unlock (usePinUnlock, Phase 4) to resume.
 * - The refresh token is separately encrypted by the PIN layer
 *   (src/lib/crypto.ts) and persisted to the vault (src/lib/vault.ts) by
 *   the pairing/unlock flows — that vault write is the ONLY place a
 *   refresh token reaches disk, and only in ciphertext.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabasePublishableKey) {
  // During development, missing env vars surface as a clear error rather than a
  // cryptic network failure at runtime.
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set. ' +
      'Copy .env.example to .env.local and fill in the values.'
  )
}

/**
 * In-memory-only storage adapter (DD-7). Backed by a plain `Map`, scoped to
 * this module — nothing here ever reaches `localStorage`/`sessionStorage`/
 * disk. Combined with `persistSession: false`, this guarantees the refresh
 * token cannot leak via supabase-js's own persistence path.
 */
const memoryStore = new Map<string, string>()

const memoryStorage = {
  getItem: (key: string): string | null => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    memoryStore.set(key, value)
  },
  removeItem: (key: string): void => {
    memoryStore.delete(key)
  },
}

// <Database> (T-0.5, regenerated T-1.4) types every table/RPC call against
// the live schema, including `profiles.activo` and `is_active()`.
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    storage: memoryStorage,
  },
})
