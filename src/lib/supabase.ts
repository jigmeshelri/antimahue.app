/**
 * Supabase shared browser client — D3.
 *
 * Single instance. Only the publishable key is used here.
 * service_role MUST NEVER appear in this file or anywhere under src/.
 * See design.md D3/D4 and REQ-SETUP-9.
 *
 * Session token strategy (D4):
 * - persistSession: true  → supabase-js manages token refresh in memory
 * - autoRefreshToken: true → keeps access token alive while tab is open
 * - The refresh token is encrypted by the PIN layer (D5, src/lib/crypto.ts)
 *   before being persisted to IndexedDB. The default sessionStorage is NOT used
 *   for the refresh token — the PIN unlock flow calls supabase.setSession()
 *   directly after decryption.
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

// <Database> (T-0.5) types every table/RPC call against the live schema.
// Regenerated at T-1.4 once the auth-pin migration adds `profiles.activo`.
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Storage defaults to localStorage in supabase-js. The PIN encryption
    // layer (D5) wraps the refresh token; the access token stays in memory.
    // A future hardening step can replace storage with an encrypted adapter.
  },
})
