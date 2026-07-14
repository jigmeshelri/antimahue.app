/**
 * REQ-AP-SEG-5 — multi-role RLS/RPC verification matrix (auth-pin, Phase 1).
 *
 * This is a SCAFFOLD, not a runnable suite yet. Every row below needs a real
 * 'empleado' JWT (Phase 5, enrollment) and, for the last row, a REVOKED
 * 'empleado' JWT (Phase 7, revocation) — neither actor exists until those
 * phases ship. `design.md` §8 slice 1 groups this battery with the
 * migration; `tasks.md`'s Gaps §1 documents why it cannot actually run
 * here and defers real execution to Phase 9 (T-9.3), which re-runs every
 * row against the live project with real sessions.
 *
 * Task-ID mapping (tasks.md Phase 1, `SEG-5.n` is this repo's own
 * disambiguated numbering — the spec's own labels are in parentheses):
 *   T-1.5  → SEG-5.1 (spec T-5.1)
 *   T-1.6  → SEG-5.2 (spec T-5.2)
 *   T-1.7  → SEG-5.3 (spec T-5.3)
 *   T-1.8  → SEG-5.4 (spec T-5.4)
 *   T-1.9  → SEG-5.5 (spec T-5.5)
 *   T-1.10 → SEG-5.6 (spec "new" row — anon)
 *   T-1.11 → SEG-5.7 (spec "new" row — inactive empleado)
 *
 * Each `it.skip` below documents the exact assertion it will make once
 * unblocked (see design.md §9's Verify strategy table for the same matrix).
 * Bodies are comment-only by design: `it.skip` still type-checks its
 * callback, so a real body referencing fixtures/clients that don't exist
 * yet would fail `pnpm typecheck` even though it never executes.
 */
import { describe, it } from 'vitest'

describe('REQ-AP-SEG-5 — multi-role RLS/RPC verification matrix', () => {
  it.skip('SEG-5.1 (T-1.5): active empleado — producto_costos/proveedores SELECT → [] (never 403)', () => {
    // BLOCKED until Phase 5 (enrollment) creates the first real 'empleado' row.
    // Assertion once unblocked: with an empleado session, both
    // `supabase.from('producto_costos').select()` and
    // `supabase.from('proveedores').select()` resolve `data === []` and
    // `error === null` — RLS-filtered rows, never an authorization error.
  })

  it.skip('SEG-5.2 (T-1.6): active admin — WITH CHECK boundary on a write policy', () => {
    // BLOCKED until Phase 5 ships (needs a live admin session against the
    // widened schema to exercise the boundary meaningfully alongside empleado).
    // Assertion once unblocked: an out-of-bounds UPDATE against
    // `configuracion`/`proveedores` is rejected by its WITH CHECK clause; an
    // in-bounds UPDATE by the same admin session succeeds.
  })

  it.skip('SEG-5.3 (T-1.7): deshacer_venta on a non-last confirmed sale → RPC error, zero partial effect', () => {
    // BLOCKED until Phase 5 (needs a real empleado/admin session to drive
    // confirmar_venta twice before attempting deshacer_venta on the older one).
    // Assertion once unblocked: `supabase.rpc('deshacer_venta', {...})` on any
    // sale that is not the most recent 'confirmada' one throws, and neither
    // `productos.stock` nor `movimientos_stock` reflect a partial rollback.
  })

  it.skip('SEG-5.4 (T-1.8): confirmar_venta over available stock → rejected, stock unchanged', () => {
    // BLOCKED until Phase 5 ships (needs a real session to call the RPC).
    // Assertion once unblocked: `supabase.rpc('confirmar_venta', { p_items: [...] })`
    // requesting more units than `productos.stock` throws 'stock insuficiente'
    // and leaves `productos.stock` untouched.
  })

  it.skip('SEG-5.5 (T-1.9): active empleado — productos embed with producto_costos degrades to [], not a request error', () => {
    // BLOCKED until Phase 5 ships.
    // Assertion once unblocked: `supabase.from('productos').select('*, producto_costos(costo)')`
    // with an empleado session returns rows where the `producto_costos` embed
    // is `[]` per row (RLS-filtered), and the overall request has `error === null`.
  })

  it.skip('SEG-5.6 (T-1.10): anon — any domain table/RPC → 401/42501', () => {
    // NOT blocked by Phase 5/7 (anon needs no enrolled actor) — deferred to
    // Phase 9 (T-9.3) anyway, to run the whole matrix together against the
    // live project in one verify pass rather than partially now.
    // Assertion once run: an anon-key client (no session) calling any of
    // `productos`/`ventas`/`venta_items`/`configuracion` SELECT or any of the
    // 4 domain RPCs gets `401` (no JWT) or Postgres `42501` (no grant) — never
    // a silent empty result.
  })

  it.skip('SEG-5.7 (T-1.11): inactive empleado (activo=false) — denied on every SEG-5.1–5.4 target, incl. plain productos SELECT', () => {
    // BLOCKED until Phase 7 (revocation) ships — needs a real empleado row
    // flipped to `activo = false` via the enroll-empleado PATCH action.
    // Assertion once unblocked: with a revoked empleado's (still unexpired)
    // JWT, every SEG-5.1–SEG-5.4 target is denied — including a PLAIN
    // `productos` SELECT (REQ-AP-SEG-2's `productos_select` policy now reads
    // `USING ((select public.is_active()))`), not just the admin-only tables.
  })
})
