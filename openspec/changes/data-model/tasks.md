---
change: data-model
phase: tasks
status: pending_apply
depends_on: [proposal, spec, design]
persistence: openspec
scope: schema + RLS + RPC only, NO UI
migration_prefixes: ["20260705000100", "20260705000200", "20260705000300"]
prior_migration: "20260621000000_initial_scaffold.sql"
deploy_method: git push (schema-as-code, GitHub integration auto-deploy) — MCP `apply_migration` PROHIBITED for these 3 files
updated_at: "2026-07-05T23:30:00Z"
---

# Tasks: data-model — domain schema, RLS policies & domain RPC

All SQL bodies already exist verbatim in `design.md` — tasks reference line ranges, they do not restate DDL.

> **Apply-phase note (spec/design conflict, reported per orchestrator instruction — "specs win, don't
> improvise"):** the `specs/catalogo/spec.md` and `specs/venta/spec.md` requirement tables describe money
> columns (`precio_venta`, `costo`, `total`, `precio_unitario`) as `numeric`, while `design.md`'s "Technical
> Approach" and its full DDL consistently use `integer` CLP with an explicit rationale (Chilean peso has no
> cents; avoids float rounding). The implementation follows `design.md` (`integer`) — the spec's `numeric`
> reads as an informal type hint in prose (it also calls `cantidad`/`stock` "int" elsewhere, matching
> design), not a deliberate requirement for decimal precision. Flagging here instead of silently picking one.

## Phase 1 — `supabase/migrations/20260705000100_domain_tables.sql` (tables)

- [x] T-1.1 `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;` (design.md L90, DD4). AC: extension lives in `extensions`, not `public` — no `extension_in_public` advisor.
- [x] T-1.2 `proveedores` (design.md L92-101) + `ENABLE RLS`. REQ-DM-CAT-3.
- [x] T-1.3 `productos` (design.md L104-122) incl. `color_hex CHECK (~ '^#[0-9A-Fa-f]{6}$')` (REQ-DM-CAT-4), `stock >= 0` CHECK (REQ-DM-CAT-1), nullable `stock_minimo` (REQ-DM-CFG-2), `idx_productos_nombre_trgm` GIN + `ENABLE RLS`. AC: `color_hex='blue'` rejected; NULL color succeeds.
- [x] T-1.4 `producto_costos` (design.md L125-132): PK=FK `productos.id`, `costo >= 0` CHECK, `proveedor_id` FK `ON DELETE SET NULL`, index + `ENABLE RLS`. REQ-DM-CAT-2. AC: 2nd row same `producto_id` → PK violation.
- [x] T-1.5 `ventas` (design.md L135-144) + `idx_ventas_confirmada_created` partial index + `ENABLE RLS`. REQ-DM-VENTA-1. AC: `estado` CHECK rejects values outside `('confirmada','deshecha')`.
- [x] T-1.6 `venta_items` (design.md L147-155), `precio_unitario` frozen snapshot, index + `ENABLE RLS`. REQ-DM-VENTA-1.
- [x] T-1.7 `movimientos_stock` (design.md L158-168), `tipo CHECK` includes `'compra'` reserved for future `dte-import`, index + `ENABLE RLS`. REQ-DM-VENTA-2.
- [x] T-1.8 `configuracion` singleton (design.md L171-178): `CHECK (id=1)`, seed `INSERT ... ON CONFLICT (id) DO NOTHING` + `ENABLE RLS`. REQ-DM-CFG-1/OQ-4. AC: 2nd row `id=2` rejected; re-running the migration does not error or duplicate the seed.
- [x] T-1.9 Confirm all 7 new tables carry `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` inline (no table left RLS-disabled even transiently within the file).

## Phase 2 — `supabase/migrations/20260705000200_domain_rls.sql` (helper, triggers, policies, GRANTs)

Depends on Phase 1 (tables must exist first).

- [x] T-2.1 `is_admin()` (design.md L187-196): `SECURITY DEFINER`, `SET search_path=''`, `STABLE`; `REVOKE EXECUTE FROM PUBLIC` then `GRANT TO authenticated`. REQ-DM-SEG-1. AC: callable by `authenticated`; `anon` → permission denied.
- [x] T-2.2 `touch_updated_at()` (design.md L198-202) + `BEFORE UPDATE` triggers on `productos`, `producto_costos`, `proveedores`, `configuracion`; `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. DD5.
- [x] T-2.3 `productos`: `GRANT SELECT`; policy `USING (true)` (design.md L224-225). REQ-DM-SEG-2.
- [x] T-2.4 `producto_costos`: `GRANT SELECT`; policy `USING ((select is_admin()))` (design.md L229-231). REQ-DM-SEG-3/D2. AC: non-admin embed `productos?select=*,producto_costos(costo)` → nested `[]`.
- [x] T-2.5 `proveedores`: `GRANT SELECT,INSERT,UPDATE,DELETE`; `FOR ALL USING(is_admin()) WITH CHECK(is_admin())` (design.md L233-236). REQ-DM-SEG-2/3/4.
- [x] T-2.6 `ventas` + `venta_items`: `GRANT SELECT`; policy `USING(true)` each (design.md L239-242). REQ-DM-SEG-2.
- [x] T-2.7 `movimientos_stock`: `GRANT SELECT`; policy `USING(is_admin())` (design.md L244-247). REQ-DM-SEG-2.
- [x] T-2.8 `configuracion`: `GRANT SELECT,UPDATE`; SELECT `USING(true)`, UPDATE `USING(is_admin()) WITH CHECK(is_admin())` (design.md L249-254). REQ-DM-SEG-2/4.
- [x] T-2.9 `profiles_select_own` (design.md L256-259) — **closes REQ-SETUP-7/V-7**: `GRANT SELECT`; policy `USING(id=(select auth.uid()))`. AC: `GET /profiles` as `authenticated` → 200 (replaces setup-stack's baseline 401).
- [x] T-2.10 Static audit: every INSERT/UPDATE policy from T-2.3–T-2.9 has BOTH `USING` and `WITH CHECK` (REQ-DM-SEG-4) — no USING-only UPDATE policy exists anywhere in this file.

## Phase 3 — `supabase/migrations/20260705000300_domain_rpc.sql` (RPC)

Depends on Phase 1+2 (tables + `is_admin()` must exist).

- [x] T-3.1 `confirmar_venta(p_items jsonb, p_medio_pago text)` verbatim (design.md L272-310): `FOR UPDATE` row lock, server-authoritative price, total recompute, `movimientos_stock('venta')` same txn. REQ-DM-VENTA-3. AC: 3 spec scenarios — atomic all-or-nothing; insufficient stock rejected (stock unchanged); forged client `total` ignored.
- [x] T-3.2 `deshacer_venta(p_venta_id uuid)` verbatim (design.md L313-336): `FOR UPDATE`, last-confirmed-only check, compensating ledger, soft-cancel (`estado='deshecha'`). REQ-DM-VENTA-4. AC: 3 spec scenarios — undo last OK; undo non-last rejected, no partial effect; undo already-cancelled rejected, no duplicate ledger row.
- [x] T-3.3 `crear_producto(p_producto jsonb, p_costo integer DEFAULT NULL, p_proveedor_id uuid DEFAULT NULL)` verbatim (design.md L340-368): `is_admin()` gate first statement; atomic INSERT into `productos`+`producto_costos`; opening `stock>0` → `movimientos_stock('ajuste')` entry. REQ-DM-CAT-5. AC: negative `costo` rolls back the whole txn, no orphan `productos` row.
- [x] T-3.4 **`actualizar_producto` — CONTRACT DECIDED HERE, closes design.md's residual open question (L472-473):** signature `actualizar_producto(p_id uuid, p_producto jsonb, p_costo integer DEFAULT NULL, p_proveedor_id uuid DEFAULT NULL, p_stock_delta integer DEFAULT NULL)`.
  - `is_admin()` gate, same as T-3.3.
  - **`IF p_producto ? 'stock' THEN RAISE EXCEPTION`** — a `stock` key in the payload is a hard error, not a silently-ignored field. Every stock change MUST go through `p_stock_delta`.
  - `UPDATE productos` on employee-safe columns only (never `stock`); `UPSERT producto_costos` via `INSERT ... ON CONFLICT (producto_id) DO UPDATE`.
  - `IF p_stock_delta IS NOT NULL AND p_stock_delta <> 0`: `UPDATE productos SET stock = stock + p_stock_delta`; `INSERT INTO movimientos_stock(producto_id,'ajuste',p_stock_delta,actor_id)` — same txn, mirrors D3/R1. `CHECK(stock>=0)` is the non-bypassable backstop if a delta underflows (txn aborts, column and ledger stay in sync — never desynced).
  - REQ-DM-CAT-5. AC: payload `{"stock": 999}` → RPC raises before any write; `p_stock_delta=-3` against `stock=2` → CHECK aborts the txn, `productos.stock` AND `movimientos_stock` both unchanged (no partial write).
  - IMPLEMENTATION NOTE: `UPDATE productos` uses `CASE WHEN p_producto ? 'field' THEN ... ELSE field END` per column (PATCH semantics via the jsonb `?` existence operator) — a key absent from the payload leaves the column untouched; a key present with JSON `null` clears it. `producto_costos` UPSERT via `INSERT ... ON CONFLICT (producto_id) DO UPDATE ... COALESCE(p_costo, producto_costos.costo)` — a `NULL` `p_costo`/`p_proveedor_id` on an existing row means "no change", not "clear". Return type `void` (no new id to hand back, unlike `crear_producto`). None of this contradicts design/specs — design explicitly left the exact UPDATE semantics open (L472-473) for this phase to decide.
- [x] T-3.5 `REVOKE EXECUTE FROM PUBLIC` then `GRANT TO authenticated` on all 4 RPCs, `anon` excluded (design.md L373-378). OQ-3.

## Phase 4 — Deploy & structural verification

- [ ] T-4.1 **[HUMAN]** Commit the 3 migration files on a short-lived branch → PR → merge (repo convention: PR-only, no direct push to `main`). Merge triggers the GitHub integration's auto-deploy of `supabase/migrations/*.sql`. **PROHIBITED**: `mcp__supabase__apply_migration` for these files (schema-as-code discipline, design.md L24-26/L397-398).
- [ ] T-4.2 **[post-merge, agent via MCP or human]** `list_migrations` shows all 3 new files applied; `list_tables` shows the 7 domain tables with `rls_enabled: true`; `get_advisors(type='security')` shows only the pre-accepted WARNs/INFOs (design.md L436-443) — no NEW `rls_enabled_no_policy` on any domain table.

## Phase 5 — Mandatory security scenario verification (seguridad spec traceability table)

- [ ] T-5.1 Non-admin `authenticated` JWT: `SELECT * FROM producto_costos` / `proveedores` → `[]`, never 403. REQ-DM-SEG-3.
- [ ] T-5.2 UPDATE violating a policy's `WITH CHECK` → rejected; an in-bounds UPDATE on the same row still succeeds. REQ-DM-SEG-4.
- [ ] T-5.3 `deshacer_venta` on a non-last confirmed sale → RPC error, zero partial effect (`estado` unchanged, no ledger row). REQ-DM-VENTA-4.
- [ ] T-5.4 Direct `confirmar_venta` call bypassing the UI, requesting more stock than available → rejected identically to a UI-driven call, `stock` unchanged. REQ-DM-VENTA-3/SEG-5.
- [ ] T-5.5 **[FLAG for verify phase — real JWT required, design.md R5/L474-475]** Empirically confirm `GET /productos?select=*,producto_costos(costo)` under a seeded non-admin `authenticated` JWT degrades the embedded `producto_costos` to `[]`, NOT a request-level 403/error. Design *asserts* this from PostgREST embedding semantics; it is UNVERIFIED against the live project. Needs a second seeded user with `profiles.rol <> 'admin'` (today only `'admin'` exists in the CHECK — may need a temporary test row or a mocked JWT claim, scoped and reverted after the test). **Fallback if it 403s**: split into a dedicated read RPC that pre-filters, per design's stated fallback.

## Phase 6 — Optional follow-up (not mandated by design)

- [ ] T-6.1 (optional, NOT a blocker for archive) Regenerate Supabase TS types (`mcp__supabase__generate_typescript_types`) into `src/lib/database.types.ts` post-deploy. Design.md's File changes table (L447-453) does not list this file — no `src/` code consumes it yet (out of scope, "SIN UI"). Recommended low-cost follow-up for the next UI-facing change.

## Human-required tasks summary

| Task | Why human |
|---|---|
| T-4.1 | Git push/PR/merge is the only deploy path (schema-as-code); agent must not use `apply_migration` |
| T-5.5 | Needs a real seeded non-admin JWT against the live/linked project — flagged like `setup-stack`'s V-7, resolved empirically in verify, not assumed in design |

All other tasks (T-1.x, T-2.x, T-3.x, T-4.2, T-5.1–T-5.4, T-6.1) are executable by the `sdd-apply` agent (T-4.2/T-5.x require the migrations already deployed via T-4.1).
