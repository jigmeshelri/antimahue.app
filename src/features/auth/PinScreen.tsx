/**
 * PinScreen — auth feature (Screen 1).
 *
 * Container component: owns the PIN unlock flow (D5).
 * - Reads lockout state from $lock store
 * - Derives key via crypto.ts deriveKey, attempts decryptToken
 * - On success: calls supabase.setSession(), updates $auth store
 * - On failure: increments fail counter, applies backoff
 *
 * Business logic is deferred to the auth feature change.
 * This file is the skeleton per tasks.md 4.8.
 */
export default function PinScreen() {
  return <div>PinScreen</div>
}
