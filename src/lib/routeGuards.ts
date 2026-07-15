/**
 * Route-guard decision logic — Phase 8 (T-8.3/T-8.4; DD-8).
 *
 * Pure functions, no router/React — mirrors the `pinUnlock.ts`/`idleLock.ts`
 * split so the actual gating rules are unit-testable without a rendering or
 * routing harness. `router.tsx`'s `<RequireSession>`/`<RequireAdmin>`
 * components are thin wrappers that call these and render `<Navigate>` or
 * `children` accordingly.
 *
 * DD-8: this is a UX concealment layer ONLY. The real authorization
 * boundary is Postgres (RLS policies + the `is_admin()`/`is_active()`
 * SECURITY DEFINER functions) — a user who reaches a guarded route anyway
 * (a stale tab, a typed-in URL racing the redirect) still gets `[]` from
 * every read and a `RAISE EXCEPTION` from every write, never real data.
 * These functions exist to avoid flashing protected UI for a frame, not to
 * secure anything.
 */
import type { AuthState } from '@/stores/auth'

export type GuardDecision = { kind: 'allow' } | { kind: 'redirect'; to: string; from?: string }

const ALLOW: GuardDecision = { kind: 'allow' }

/**
 * T-8.3 — any route requiring an unlocked session. Applies to every route
 * except `/` (PinScreen itself) and `/pair` (the one-time pairing flow),
 * which must always render regardless of `$auth.status`.
 *
 * `currentPath` is threaded through as the redirect's `from` so the PIN
 * screen can navigate back to the originally-intended route after a
 * successful unlock, instead of always landing on `/dashboard` (the
 * cold-load/deep-link case tasks.md's Gaps flag: a hard reload while
 * `status==='locked'`, e.g. a bookmarked `/empleadas` link, must show the
 * PIN screen first, then ideally resume the intended destination).
 */
export function decideSessionGuard(
  auth: Pick<AuthState, 'status'>,
  currentPath: string
): GuardDecision {
  if (auth.status === 'unlocked') return ALLOW
  return { kind: 'redirect', to: '/', from: currentPath }
}

/**
 * T-8.4 — admin-only routes (`/proveedor`, `/dte`, `/empleadas`). Composes
 * the session check first (an admin-only route obviously also requires an
 * unlocked session) so route definitions only need to wrap once with
 * `<RequireAdmin>`, never both guards separately.
 *
 * Gap #8 (tasks.md): a freshly-paired admin's `$auth.rol` stays `null`
 * until their FIRST PIN unlock (pairing itself never resolves `rol` from a
 * fresh `profiles` read — that is `usePinUnlock`'s job, REQ-AUTH-4). This
 * is a non-issue here: pairing always routes back to `/` and never sets
 * `status` to `'unlocked'` on its own, so the session check below already
 * redirects a not-yet-unlocked freshly-paired user before the role check
 * ever runs — there is no window where a `null`-rol admin reaches this
 * function with `status === 'unlocked'`.
 */
export function decideAdminGuard(
  auth: Pick<AuthState, 'status' | 'rol'>,
  currentPath: string
): GuardDecision {
  const sessionDecision = decideSessionGuard(auth, currentPath)
  if (sessionDecision.kind === 'redirect') return sessionDecision

  if (auth.rol !== 'admin') return { kind: 'redirect', to: '/dashboard' }
  return ALLOW
}
