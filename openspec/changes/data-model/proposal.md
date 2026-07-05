---
change: data-model
phase: proposal
status: completed
depends_on: setup-stack
supersedes: ~
persistence: openspec
updated_at: 2026-07-05
---

# Proposal: data-model — domain schema, RLS policies & domain RPC (Antimahue MVP)

## Intent

`setup-stack` shipped the security scaffold (`profiles`, `auth_attempts`, `audit_log`) with RLS
deny-by-default and **zero** policies/GRANTs — no business table exists yet. This change defines the
**business domain schema** (catalog, sale, stock ledger, config), the **RLS policies + GRANTs** that
expose those tables to the client under least-privilege, and the **domain RPC functions** that enforce
money/stock integrity server-side. It closes the work explicitly deferred by `setup-stack` REQ-SETUP-7 /
V-7 (GRANTs + `auth.uid()` policies) in `openspec/specs/setup-stack/spec.md`.

No UI. This is the first real data layer that later screen changes (catálogo, venta, escáner, ticket,
proveedor) build on. Governing principle inherited from `setup-stack`: **the client bundle is UNTRUSTED —
authorization lives in Postgres, never in JS.**

## Scope

### In scope
- Domain tables: `productos`, `producto_costos`, `proveedores`, `ventas`, `venta_items`,
  `movimientos_stock`, `configuracion`.
- Enums / CHECK constraints for `medio_pago`, `ventas.estado`, `movimientos_stock.tipo`, `color_hex`.
- RLS policies (USING + WITH CHECK) + `GRANT` to `authenticated` on every exposed table — closes
  REQ-SETUP-7 / V-7.
- Domain RPC (SECURITY DEFINER, `SET search_path = ''`): `confirmar_venta`, `deshacer_venta`,
  `crear_producto`, `actualizar_producto`; platform helper `is_admin()`.
- New versioned SQL under `supabase/migrations/`.

### Out of scope
- Any UI / React screen — feature dirs stay skeletons (`src/features/{catalogo,venta,proveedor,dte}/*.tsx`).
- `compras` / `compra_items` tables **and** DTE XML parsing → deferred to a future `dte-import` change.
  `movimientos_stock.tipo` MUST reserve a `'compra'` value now so that change adds tables without
  touching the ledger contract (forward-compat).
- Relaxing `profiles.rol` beyond `'admin'` (employee provisioning) → future multi-role change.
  This change writes `is_admin()` + admin-only policies so the separation is **structural and ready**
  the day an `'empleado'` role is added (setup-stack §6 "prepare cheap, don't build").
- Installing `vector` / `cube` extensions — color distance stays in the frontend (per
  `openspec/changes/color-palette-assistant/proposal.md` §2). YAGNI.
- Audit-log triggers / population — the typed ledger `movimientos_stock` covers money/stock; generic
  `audit_log` triggers remain a later concern.

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Table/column/function naming | **Spanish for the domain layer; English kept for the existing platform layer** | All-English schema; all-Spanish (incl. renaming infra) |
| D2 | Hide cost + supplier from employees | **Separate `producto_costos` table (admin-only RLS); `proveedor_id` moves there too; `proveedores` admin-only** | Per-column GRANT (impossible); `security_invoker` view + CASE mask |
| D3 | Stock model | **Hybrid: mutable `productos.stock` + `movimientos_stock` ledger, written in the SAME RPC** | Mutable column only; pure ledger (derived stock) |
| D4 | Sale + undo | **`ventas`/`venta_items`, frozen `precio_unitario`, soft-cancel via `estado`, "only the last sale" enforced in RPC** | Hard delete; "only last" enforced in UI only |
| D5 | Color attribute | **Structured from day 1: `color_nombre text` NULL + `color_hex text CHECK (~ '^#[0-9A-Fa-f]{6}$')` NULL** | Free-text only |
| D6 | Minimum stock | **Singleton `configuracion.stock_minimo_default` + nullable `productos.stock_minimo` override, resolved via `COALESCE` at read** | Column `DEFAULT` literal (freezes value, no retroactive edit) |
| D7 | Cross-cutting enforcement | **`is_admin()` SECURITY DEFINER in exposed schema; policies with USING+WITH CHECK; all money/stock integrity in RPC; GRANTs least-privilege** | Trust the client / enforce in JS |

### D1 — Naming: Spanish domain, English platform (MUST)
The domain is Chilean retail; its vocabulary is irreducibly Spanish — `boleta`, `folio`, `medio de pago`,
DTE have no faithful English equivalent (a "boleta" is a specific Chilean tax document, not a generic
"receipt"). DDD ubiquitous language + the already-written `color-palette-assistant` (`productos`,
`color_hex`) + the frontend already choosing `sku` in `src/stores/saleDraft.ts` all point Spanish.
Rules:
- **Domain tables, domain columns, domain RPC** → Spanish snake_case (`productos.precio_venta`,
  `confirmar_venta()`).
- **Platform layer** → English, NOT renamed retroactively: existing `profiles`, `auth_attempts`,
  `audit_log`, and technical helpers `is_admin()` / `handle_new_user()`.
- **Pan-technical columns** `id`, `created_at`, `updated_at` stay English in new tables too (universal
  SQL convention already in `20260621000000_initial_scaffold.sql` — do NOT translate to
  `identificador`/`creado_en`).
- **Actor FK** referencing `auth.users` → reuse `actor_id` (matches `audit_log.actor_id`).
- **`sku`** kept as the barcode field (retail-universal acronym; matches `SaleLine.sku`).
The English↔Spanish seam is a **principled platform-vs-domain boundary**, not accidental drift.
Transition rule: no retroactive rename of any existing object; the rule applies to new domain objects only.

### D2 — Cost & supplier isolation (MUST)
Per-column `GRANT` is impossible: Supabase maps every app user to the single Postgres role
`authenticated`; the admin/employee distinction lives in `profiles.rol`, not in a Postgres role.
Chosen: keep only employee-safe columns on `productos`; put `costo` **and** `proveedor_id` on a 1:1
`producto_costos(producto_id PK/FK, costo, proveedor_id FK, updated_at)` with RLS `USING (is_admin())
WITH CHECK (is_admin())`. `proveedores` is likewise admin-only (product def: employees have "sin acceso a
costos ni proveedores"). Preferred over a `security_invoker` view because the secret is **structural** (a
column in `producto_costos` is sensitive by construction — no per-column `CASE` to forget) and PostgREST
embedding `productos?select=*,producto_costos(costo)` **degrades to `[]`, not 403**, for non-admins —
coherent with "tolerant to errors, no error dialogs". Writes to both tables go through one RPC
(`crear_producto`/`actualizar_producto`) so a new product is atomic.

### D3 — Stock: hybrid column + ledger, single writer (MUST)
`productos.stock` stays the fast read source (dashboard low-stock alerts, catalog, scanner).
`movimientos_stock(producto_id, tipo, cantidad, referencia_id, actor_id, created_at)` records every
change. **MUST** be written in the same RPC/transaction that mutates `productos.stock` — never from two
entry points (see Risk R1: silent desync, no DB mechanism detects it). This ledger is the *typed*
audit trail for stock (setup-stack threat model A4/T7), separate from generic `audit_log`.

### D4 — Sale + undo (MUST)
`ventas(id, actor_id, medio_pago, total, estado, created_at)` + `venta_items(id, venta_id, producto_id,
cantidad, precio_unitario)`. `precio_unitario` is a **frozen snapshot** — a later price edit MUST NOT
change a past ticket. Undo = **soft-cancel** (`estado='deshecha'`, rows kept, compensating
`movimientos_stock` inserted) not hard delete — preserves the audit trail (T7) and matches design
principle #5 ("undo ≠ never happened"). The rule "only the LAST confirmed sale may be undone" **MUST** be
enforced inside `deshacer_venta(venta_id)` (verify it is the most-recent `confirmada`), not only in the UI
— untrusted client.

### D5 — Structured color from day 1 (SHOULD)
Add both `color_nombre text` NULL (search/display in Angélica's words) and `color_hex text CHECK
(color_hex ~ '^#[0-9A-Fa-f]{6}$')` NULL. Both nullable — color tagging MUST NOT block product creation.
Distance math stays in the frontend (per `color-palette-assistant`). Only option with **zero rework
migration** later; marginal cost ≈ one column + one CHECK.

### D6 — Minimum stock: singleton + override (MUST)
`configuracion` singleton (`CHECK (id = 1)`) with `stock_minimo_default int` + nullable
`productos.stock_minimo`. Effective value resolved at read: `COALESCE(productos.stock_minimo, (SELECT
stock_minimo_default FROM configuracion WHERE id = 1))`. A column `DEFAULT` literal freezes the value at
INSERT and would NOT propagate a later global change — breaks the required "global default, editable,
retroactive" semantics.

### D7 — Cross-cutting security (MUST)
- `is_admin()` → `boolean`, **SECURITY DEFINER** + `SET search_path = ''`, reads `profiles.rol` bypassing
  its own RLS (avoids recursion — Risk R2). EXECUTE granted to `authenticated` (unlike trigger-only
  `handle_new_user()` which revokes it).
- Every write policy MUST have **both** `USING` and `WITH CHECK` (a USING-only UPDATE policy lets a row be
  mutated into a state the writer could not have inserted).
- All money/stock integrity (stock never negative, total recomputed server-side, medio_pago validated)
  lives in RPC + CHECK constraints, never in JS.
- GRANTs least-privilege per table: `authenticated` gets SELECT on `productos`/`ventas`/…, NO direct
  access to `producto_costos`/`proveedores` except via `is_admin()` policies. This closes REQ-SETUP-7 /
  V-7 (the deferred "GRANT + `auth.uid()` policy" note).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/*.sql` | New | Domain tables, enums, RLS policies, GRANTs, RPC functions. |
| `openspec/specs/setup-stack/spec.md` (REQ-SETUP-7, V-7) | Closes | This change adds the deferred GRANTs + `auth.uid()` policies. |
| `src/features/{catalogo,venta,proveedor,dte}/*.tsx` | Unblocked (not edited) | Schema is the data source later screens consume. |
| `src/stores/saleDraft.ts` | Aligned (not edited) | `confirmar_venta` RPC is the atomic close its comment anticipates; `sku` naming adopted. |
| `openspec/project.yaml` → `active_changes` | Modified | `data-model` added. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | `productos.stock` and `movimientos_stock` desync silently (no DB check detects it) | Med | Single-RPC-per-stock-op discipline; design defines each op as one function. |
| R2 | `is_admin()` causes RLS recursion if it reads an RLS-guarded table | Med | SECURITY DEFINER reads `profiles` bypassing policies; standard Supabase pattern, verify in design. |
| R3 | Admin-only RLS is inert while only `'admin'` exists (no employee to hide from) | High (by design) | Accepted — structural now, active the day `'empleado'` is added; no rework needed. |
| R4 | Mixed-language schema seam (`productos` next to `profiles`) confuses contributors | Low | D1 documents the platform-vs-domain boundary as the rule, not an accident. |
| R5 | PostgREST embedding assumed to degrade to `[]` (not 403) for non-admin | Low | Verify empirically in verify phase; fallback = split read endpoints. |

## Rollback Plan
Each migration is additive (new tables/functions/policies; no ALTER of existing infra). Rollback = a down
migration dropping the new objects in reverse dependency order; `profiles`/`auth_attempts`/`audit_log`
are untouched, so the `setup-stack` baseline is restored intact.

## Dependencies
- `setup-stack` (archived) — provides `profiles`, `auth_attempts`, `audit_log`, `pgcrypto`
  (`gen_random_uuid()`), and the SECURITY DEFINER + `search_path=''` pattern to replicate.

## Success Criteria
- [ ] All domain tables created with RLS enabled + explicit policies (no table left deny-by-default that
      should be readable).
- [ ] `grep`-level: no authorization logic in `src/**` — every rule is a Postgres policy/constraint/RPC.
- [ ] `confirmar_venta` is atomic (stock + venta + items + ledger all-or-nothing); `deshacer_venta`
      rejects any non-last sale.
- [ ] Non-admin (future employee) cannot read `producto_costos`/`proveedores`; embedding returns `[]`.
- [ ] REQ-SETUP-7 / V-7 satisfied: `authenticated` GRANTs + `auth.uid()` policies present.

## Open Questions for design
- OQ-1: Migration granularity — one big migration (like `setup-stack`) vs one per sub-domain (catálogo /
  venta / config). Design decides.
- OQ-2: Exact `is_admin()` placement — `public` (needs EXECUTE hygiene) vs a non-exposed schema. Verify no
  recursion path.
- OQ-3: Should `confirmar_venta` GRANT EXECUTE to `authenticated` now (forward-compat for employees) even
  though only admin exists? (Recommended yes.)
- OQ-4: `configuracion` seed — one seeded row (id=1) in the migration, or created on first admin write.
- OQ-5: Whether `productos.stock` needs a `CHECK (stock >= 0)` or if the RPC alone guards it (belt +
  suspenders vs single source of truth).
