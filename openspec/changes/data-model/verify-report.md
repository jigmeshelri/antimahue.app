---
change: data-model
phase: verify
status: completed
verdict: PASS_WITH_WARNINGS
severity_count: { critical: 0, warning: 3, suggestion: 2 }
req_summary: { total: 17, verified: 9, verified_structural_runtime_pending: 8, failed: 0 }
scenario_summary: { total: 27, verified: 14, partial: 3, not_verifiable_yet: 10 }
depends_on: [proposal, spec, design, tasks]
persistence: openspec
project_ref: aruteznqhdaaxxvllvzm
merge_commit: 50373f3e7acbdb45aa533ab6a65a3602f5c64cb9
deploy_note: >
  GitHub-integration auto-deploy NEVER fired (confirmed inactive — a prior version of this
  report documented DEPLOY-PENDING with full evidence). Deploy completed manually via MCP
  execute_sql + schema_migrations registration, sanctioned by the user as a one-time
  exception on 2026-07-06. The durable deploy path is an OPEN user decision (see W-C).
verified_at: "2026-07-06T02:10Z–02:30Z"
updated_at: "2026-07-06T02:35:00Z"
---

# Verify report: data-model — domain schema, RLS policies & domain RPC

## Verdict

**PASS WITH WARNINGS.** All 3 migrations applied to prod with filename-matching versions.
Structure, privilege matrix, policies, RPC bodies (authz gates included) and anon REST plane
match design exactly. 0 CRITICAL. 3 WARNINGS (residual default-privilege grants; 5 new
by-design advisor WARNs to accept into baseline; deploy path unresolved). 10 scenarios remain
runtime-unverifiable in prod (JWT-bound or prod-mutating) — all covered by the local-stack
validation recorded in the apply phase (commit `b91648d`), except embed-degradation (T-5.5,
never validated anywhere; V1-blocked).

## 1. Deploy gate (T-4.2) — PASS

`list_migrations` (02:19Z):

```json
[{"version":"20260621000000","name":"initial_scaffold"},
 {"version":"20260705000100","name":"domain_tables"},
 {"version":"20260705000200","name":"domain_rls"},
 {"version":"20260705000300","name":"domain_rpc"}]
```

Versions match filename prefixes exactly (the 2026-06-22 lesson — no version/prefix mismatch).

## 2. Structural verification (T-4.2 detail) — PASS

- **Tables**: 10 in `public`, ALL `rls_enabled: true`. 7 new: `proveedores`, `productos`,
  `producto_costos`, `ventas`, `venta_items`, `movimientos_stock`, `configuracion` (1 row).
- **`productos` columns** (15): `id, sku, nombre, tipo, marca, grosor, peso_metraje,
  color_nombre, color_hex, precio_venta, stock, stock_minimo, imagen_url, created_at,
  updated_at` — **no `costo`, no `proveedor_id`** (REQ-DM-CAT-1/D2). `sku` UNIQUE
  (`productos_sku_key`). `color_nombre`/`color_hex`/`stock_minimo` nullable, **no column
  DEFAULT on `stock_minimo`** (REQ-DM-CFG-2 anti-pattern avoided).
- **Functions** (8 in `public`): 4 RPCs + `is_admin` + `touch_updated_at` + scaffold
  (`handle_new_user`, `rls_auto_enable`). All domain fns `search_path=''`; RPCs+`is_admin`
  SECURITY DEFINER; `is_admin` STABLE; `touch_updated_at` NOT definer (per design).
- **`actualizar_producto` signature** (T-3.4 contract): `(p_id uuid, p_producto jsonb,
  p_costo integer, p_proveedor_id uuid, p_stock_delta integer)` — confirmed in prod.
- **RPC bodies in prod** (regex over `pg_proc.prosrc`): `crear_producto`/`actualizar_producto`
  have the `is_admin()` gate; `confirmar_venta`/`deshacer_venta` have the `auth.uid() IS NULL`
  gate + `FOR UPDATE` row lock; `actualizar_producto` hard-rejects a `stock` key in
  `p_producto`; all 4 write `movimientos_stock`. `confirmar_venta` takes NO total parameter —
  a forged client total is impossible by signature (REQ-DM-VENTA-3).
- **Extensions**: `pg_trgm` AND `pgcrypto` in schema `extensions` (not `public`) — DD4, no
  `extension_in_public` advisor.
- **Indexes**: `idx_productos_nombre_trgm` GIN (`nombre gin_trgm_ops`);
  `idx_ventas_confirmada_created` partial `WHERE estado='confirmada'` (DESC,DESC);
  `idx_producto_costos_proveedor`; `idx_venta_items_venta`; `idx_movimientos_producto_created`.
- **CHECKs** (all present in `pg_constraint`): `stock>=0`, `precio_venta>=0`,
  `stock_minimo>=0`, `color_hex ~ '^#[0-9A-Fa-f]{6}$'`, `tipo IN (6 values)`, `costo>=0`,
  `cantidad>0` (venta_items), `cantidad<>0` (movimientos), `estado IN
  ('confirmada','deshecha')`, `medio_pago IN (4 values)`, `total>=0`, `configuracion id=1`,
  `stock_minimo_default>=0`, `movimientos_stock.tipo` includes reserved `'compra'`.
- **Money columns**: every one `integer` (CLP) — `precio_venta`, `stock`, `stock_minimo`,
  `costo`, `total`, `precio_unitario`, `cantidad`×2, `stock_minimo_default`.
- **FKs**: `producto_costos.producto_id` PK=FK → productos `ON DELETE CASCADE`;
  `proveedor_id` → `SET NULL`; `venta_items.producto_id` → `RESTRICT`, `venta_id` → `CASCADE`;
  `movimientos_stock.producto_id` → `RESTRICT`; all `actor_id` → auth.users `SET NULL`.
- **Seed**: `configuracion` = `{id:1, stock_minimo_default:5, nombre_tienda:'Antimahue'}` ✔.
- **Triggers**: `touch_updated_at_*` BEFORE UPDATE on `productos`, `producto_costos`,
  `proveedores`, `configuracion` (DD5).

## 3. V4 — real privilege matrix in prod

`information_schema.role_table_grants` (grantee ∈ anon, authenticated), literal:

| table | anon | authenticated |
|---|---|---|
| productos | — (zero) | REFERENCES,**SELECT**,TRIGGER,TRUNCATE |
| producto_costos | — (zero) | REFERENCES,**SELECT**,TRIGGER,TRUNCATE |
| ventas | — (zero) | REFERENCES,**SELECT**,TRIGGER,TRUNCATE |
| venta_items | — (zero) | REFERENCES,**SELECT**,TRIGGER,TRUNCATE |
| movimientos_stock | — (zero) | REFERENCES,**SELECT**,TRIGGER,TRUNCATE |
| proveedores | — (zero) | **DELETE,INSERT,SELECT,UPDATE**,REFERENCES,TRIGGER,TRUNCATE |
| configuracion | — (zero) | **SELECT,UPDATE**,REFERENCES,TRIGGER,TRUNCATE |
| profiles | REFERENCES,TRIGGER,TRUNCATE | **SELECT**,REFERENCES,TRIGGER,TRUNCATE |
| audit_log | REFERENCES,TRIGGER,TRUNCATE | REFERENCES,TRIGGER,TRUNCATE |
| auth_attempts | REFERENCES,TRIGGER,TRUNCATE | REFERENCES,TRIGGER,TRUNCATE |

**Design-matrix compliance**: `authenticated` has ZERO write DML (INSERT/UPDATE/DELETE) on the
5 RPC-only tables (W1 hardening effective); design exceptions intact (`proveedores` CRUD,
`configuracion` SELECT+UPDATE); `anon` has ZERO grants of any kind on all 7 domain tables. ✔

**Deviation → W-A (WARNING)**: residual `TRUNCATE, REFERENCES, TRIGGER` from Supabase's
`ALTER DEFAULT PRIVILEGES` survive for `authenticated` on all 10 tables and for `anon` on the
3 scaffold tables. **TRUNCATE is NOT gated by RLS** (row policies apply only to
SELECT/INSERT/UPDATE/DELETE). No exploit path today — PostgREST exposes no TRUNCATE verb and
API roles cannot run DDL — but it violates the design's "anon receives zero GRANTs" for the
scaffold tables and least-privilege generally. See Issues.

**EXECUTE ACLs** (`aclexplode(pg_proc.proacl)`), literal:

| function | EXECUTE |
|---|---|
| confirmar_venta / deshacer_venta / crear_producto / actualizar_producto | postgres, **authenticated** (anon: NO, PUBLIC: NO) |
| is_admin | postgres, **authenticated** (anon: NO) |
| handle_new_user / touch_updated_at | postgres only |
| rls_auto_enable | proacl NULL → PUBLIC default (platform event_trigger, uncallable — accepted FP) |

`anon` is outside EVERY function. OQ-3 / DD3 ✔.

## 4. Policies (`pg_policies`) — PASS

Exactly 9, all `TO {authenticated}`, all PERMISSIVE, zero references to `user_metadata`, no
unexpected policy, no policy for anon:

| table | policy | cmd | qual (USING) | WITH CHECK |
|---|---|---|---|---|
| productos | productos_select | SELECT | `true` | — |
| producto_costos | producto_costos_select_admin | SELECT | `(SELECT is_admin())` | — |
| proveedores | proveedores_all_admin | ALL | `(SELECT is_admin())` | `(SELECT is_admin())` |
| ventas | ventas_select | SELECT | `true` | — |
| venta_items | venta_items_select | SELECT | `true` | — |
| movimientos_stock | movimientos_select_admin | SELECT | `(SELECT is_admin())` | — |
| configuracion | configuracion_select | SELECT | `true` | — |
| configuracion | configuracion_update_admin | UPDATE | `(SELECT is_admin())` | `(SELECT is_admin())` |
| profiles | profiles_select_own | SELECT | `(id = (SELECT auth.uid()))` | — |

REQ-DM-SEG-4 static audit: both write-capable policies (`proveedores_all_admin` FOR ALL,
`configuracion_update_admin` FOR UPDATE) carry BOTH USING and WITH CHECK; **no USING-only
UPDATE policy exists**. ✔ `profiles_select_own` present → REQ-SETUP-7 / V-7 structurally
closed (runtime 200-with-JWT pending, see V1).

## 5. REST plane as anon (publishable key, no login) — PASS (runtime)

All requests against `https://aruteznqhdaaxxvllvzm.supabase.co` with
`sb_publishable_4lhFCmfixTx92Bu7DdnFmA_PUxYJiEw`, exact responses:

| request | HTTP | body (code/message) |
|---|---|---|
| GET `/rest/v1/productos?select=*` | **401** | `42501` "permission denied for table productos" |
| GET `/rest/v1/producto_costos?select=*` | **401** | `42501` "permission denied for table producto_costos" |
| POST `/rest/v1/rpc/confirmar_venta` | **401** | `42501` "permission denied for function confirmar_venta" |
| GET `/rest/v1/configuracion?select=*` | **401** | `42501` "permission denied for table configuracion" |
| GET `/rest/v1/profiles?select=*` | **401** | `42501` "permission denied for table profiles" |

anon is denied at the GRANT layer on every surface — error, not empty data. ✔

## 6. V1 — known limitation (documented, unchanged)

```
auth_users = 0, profiles = 0, profiles_rol_check = CHECK ((rol = 'admin'::text))
```

- Zero users exist → no JWT of ANY kind can be minted without creating users (prohibited in
  this phase). Every JWT-bound scenario is runtime-unverifiable today.
- `profiles.rol` CHECK admits only `'admin'` → the admin/non-admin boundary (SEG-3 `[]`-not-403,
  the T-5.5 embed degradation, SEG-2's authenticated-200) CANNOT be tested end-to-end until
  the multi-rol/auth-pin change widens the CHECK. **Recommendation stands**: execute T-5.1,
  T-5.2, T-5.5 (+ VENTA/CAT runtime scenarios) as the first verify item of that change.
  T-5.5 fallback if it 403s: split read RPC (design R5).

## 7. Residual grants on scaffold tables (apply observation follow-up)

`profiles` carries **no residual write DML** (no INSERT/UPDATE/DELETE for either role) — the
apply-phase worry is cleared. What remains on `profiles`/`audit_log`/`auth_attempts` (both
roles) is the same `TRUNCATE/REFERENCES/TRIGGER` residue as W-A. Single recommendation covers
all: one future hardening migration with
`REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`
plus `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;`
so future tables are born clean. NOT applied here (read-only phase).

## 8. Advisors (security) vs accepted baseline

- Pre-existing accepted (setup-stack): 2 WARN on `rls_auto_enable` (0028 anon + 0029
  authenticated) — still present, still accepted FP (platform event_trigger, uncallable).
- `rls_enabled_no_policy` INFO: now only `audit_log` + `auth_attempts` (intentional
  deny-by-default) — **`profiles` resolved** exactly as design predicted.
- **NEW: 5 WARN** `authenticated_security_definer_function_executable` (0029) on
  `confirmar_venta`, `deshacer_venta`, `crear_producto`, `actualizar_producto`, `is_admin`.
  These flag the INTENDED architecture (DD2/DD3: DEFINER RPCs as sole write path, EXECUTE to
  authenticated) and are safe because internal authz gates were verified in prod (§2). →
  **W-B**: accept into baseline; design.md's advisor-expectations section did not anticipate
  them — baseline goes from 2 to 7 accepted WARN. No 0028 (anon) hit on any domain function.

## 9. REQ compliance matrix (17 REQs / 27 scenarios)

Note: spec files contain 27 Given/When/Then scenarios (9 catalogo + 8 venta + 6 seguridad +
4 configuracion); the briefed "30" appears to count the seguridad traceability rows, which
overlap their owning REQs.

Legend: **V** = VERIFIED in prod (structural and/or runtime) · **V-s** = structurally verified
in prod, runtime pending JWT/mutation (covered by local-stack apply validation, commit
`b91648d`) · **NVY** = NOT-VERIFIABLE-YET.

| REQ | Scenario | Verdict | Evidence |
|---|---|---|---|
| CAT-1 | producto without cost columns | **V** | prod column list — no costo/proveedor_id |
| CAT-1 | negative stock rejected | **V** | `productos_stock_check` in pg_constraint |
| CAT-2 | one cost row per product | **V** | `producto_costos_pkey(producto_id)` PK=FK |
| CAT-3 | proveedor holds contact info | **V** | columns nombre/contacto/telefono |
| CAT-4 | producto without color | **V** | both columns nullable; NULL passes CHECK |
| CAT-4 | invalid hex rejected | **V** | `productos_color_hex_check` regex |
| CAT-4 | valid hex accepted | **V** | same CHECK; `#3A6E45` matches |
| CAT-5 | create writes both tables | **V-s** | RPC body atomic; runtime needs admin JWT |
| CAT-5 | negative cost rolls back | **NVY** | `costo>=0` CHECK + single-txn body; runtime needs admin JWT |
| VENTA-1 | price frozen after later change | **V** | `precio_unitario` snapshot col; RPC freezes at INSERT |
| VENTA-2 | ledger same txn as stock | **V** | single fn body = one txn; ledger INSERT verified |
| VENTA-3 | sale confirmed atomically | **NVY** | body verified; runtime needs JWT + prod mutation |
| VENTA-3 | insufficient stock rejected | **NVY** | guard + `FOR UPDATE` + CHECK verified; runtime pending |
| VENTA-3 | client total ignored | **V** | signature has NO total param — forgery impossible |
| VENTA-4 | undo last sale | **NVY** | body verified; runtime pending |
| VENTA-4 | undo non-last rejected | **NVY** | last-only guard verified in prosrc; runtime pending |
| VENTA-4 | undo already-cancelled rejected | **NVY** | `estado<>'confirmada'` guard verified; runtime pending |
| SEG-1 | is_admin usable in policy, no recursion | **V-s** (partial) | fn STABLE/DEFINER/`search_path=''`; EXECUTE→authenticated; profiles policy uses only auth.uid() (no recursion by construction); policy-eval runtime needs JWT |
| SEG-2 | REQ-SETUP-7/V-7 closed (GET 200) | **NVY** | policy+GRANT present (structural close); 200-response needs a JWT — 0 users exist |
| SEG-3 | non-admin reads → `[]` | **NVY** | V1: CHECK rol='admin', no non-admin user possible |
| SEG-3 | embed degrades to `[]` not 403 | **NVY** | T-5.5 — never validated anywhere; V1-blocked; fallback documented |
| SEG-4 | UPDATE outside WITH CHECK rejected | **V-s** (partial) | static audit PASS (no USING-only UPDATE); runtime needs JWT |
| SEG-5 | raw RPC call enforces stock | **V-s** (partial) | anon plane VERIFIED runtime (401/42501); authenticated plane pending JWT |
| CFG-1 | second singleton row rejected | **V** | `CHECK (id=1)` + PK; seed present |
| CFG-2 | NULL override follows global default | **V** | `stock_minimo` nullable, NO column DEFAULT |
| CFG-2 | global change propagates | **V** | COALESCE-at-read contract; no DEFAULT literal to freeze |
| CFG-3 | override beats global default | **V** | same structural basis |

**Scenario totals**: 14 V · 3 V-s partial · 10 NVY · 0 FAILED.
**REQ totals**: 9 fully VERIFIED (CAT-1..4, VENTA-1, VENTA-2, CFG-1..3) · 8 structurally
verified with runtime pending (CAT-5, VENTA-3, VENTA-4, SEG-1..5) · 0 FAILED.

## 10. Completeness (tasks.md)

Phases 1–3: 24/24 `[x]` (verified against prod in §2–§4). T-4.1 done (merged PR #18; deploy
completed via sanctioned manual exception). T-4.2 done (this report). T-5.1–T-5.5 remain
`[ ]` — JWT-bound, deferred to multi-rol change (V1). T-6.1 optional, open (suggestion S-A).

## Issues

**CRITICAL**: None.

**WARNING**:
- **W-A** — Residual `TRUNCATE, REFERENCES, TRIGGER` grants from default privileges:
  `authenticated` on all 10 public tables, `anon` on the 3 scaffold tables. TRUNCATE bypasses
  RLS by definition. No API-reachable exploit today; still a least-privilege violation vs the
  design matrix ("anon zero grants"). Fix in a future migration (REVOKE + ALTER DEFAULT
  PRIVILEGES; §7). Do NOT hotfix outside schema-as-code.
- **W-B** — 5 new advisor WARNs (0029) on the domain DEFINER functions are by-design and safe
  (gates verified) but MUST be recorded as accepted baseline (2 → 7 WARN) in the change docs /
  next design, or every future verify will re-flag them.
- **W-C** — Deploy path: the GitHub-integration auto-deploy assumed by tasks.md T-4.1 is
  INACTIVE (confirmed; it has never fired on this project). Today's manual MCP deploy was a
  user-sanctioned one-time exception. A durable path (activate the integration, or formalize
  `supabase db push`) is an OPEN user decision — blocking discipline issue for every future
  schema change, not a defect of this schema.

**SUGGESTION**:
- **S-A** — T-6.1: regenerate TS types (`generate_typescript_types` → `src/lib/database.types.ts`)
  before the first UI change consumes the schema.
- **S-B** — Fold the 10 NVY runtime scenarios (T-5.1–T-5.5 + RPC behavioral suite) into the
  multi-rol/auth-pin change's verify phase, with a seeded non-admin JWT; consider pgTAP on the
  local stack for repeatability (design testing strategy).

## Verdict

**PASS WITH WARNINGS** — implementation is structurally complete and faithful to spec+design
in prod; 0 critical; runtime behavioral suite deferred to the multi-rol change per V1; three
warnings, none blocking archive.
