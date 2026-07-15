---
change: data-model
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domain: seguridad
closes: [REQ-SETUP-7, V-7]
functions: [is_admin]
---

# Seguridad — Specification

## Purpose

RLS policies, `is_admin()`, and least-privilege GRANTs for every domain table
(D7). Closes `openspec/specs/setup-stack/spec.md` REQ-SETUP-7 / V-7 — the GRANTs
+ `auth.uid()` policies deferred there are delivered here.

> **Extended by `auth-pin` (archived 2026-07-15)**: REQ-AP-SEG-1 through
> REQ-AP-SEG-5 below add the `profiles.activo` revocation gate, the
> `enroll-empleado`/revocation Edge Function contracts, the self-revoke guard,
> and the multi-role JWT verification matrix that closes this domain's own
> REQ-DM-SEG-3 embedding note (see the corrected scenario below) and
> data-model's deferred T-5.1–T-5.5 battery.

## Requirements

### Requirement: REQ-DM-SEG-1 — `is_admin()`, SECURITY DEFINER, no RLS recursion

The system MUST create `is_admin() RETURNS boolean`, `SECURITY DEFINER`, `SET search_path = ''`, reading `profiles.rol` bypassing `profiles`' own RLS (recursion risk R2). `EXECUTE` MUST be granted to `authenticated` — unlike trigger-only `handle_new_user()`, a function used inside a `USING` clause must be executable by the invoking role.

#### Scenario: `is_admin()` usable inside a policy without recursion
- GIVEN a policy `USING (is_admin())` on `producto_costos`
- WHEN an authenticated user queries the table
- THEN the policy evaluates without a recursive RLS error, and no permission-denied error occurs on `is_admin()` itself (EXECUTE granted)

### Requirement: REQ-DM-SEG-2 — RLS + GRANT on every domain table (closes REQ-SETUP-7 / V-7)

Every table in `catalogo`, `venta`, `configuracion` MUST have RLS enabled AND at least one policy — no domain table stays deny-by-default. `authenticated` MUST get `GRANT SELECT` (+ scoped writes via RPC), least-privilege. `anon` MUST get no domain-table grants (PIN-based app auth over an authenticated session, per `setup-stack`).

| Table | authenticated |
|---|---|
| productos, ventas, venta_items, movimientos_stock, configuracion | SELECT (+ scoped writes via RPC) |
| producto_costos, proveedores | admin-only via `is_admin()` — REQ-DM-SEG-3 |

#### Scenario: REQ-SETUP-7 / V-7 closed
- GIVEN this change is applied
- WHEN `GET /productos` is requested by `authenticated`
- THEN response is `200` with rows — RLS enabled + policy present, not the `setup-stack` baseline `401`

### Requirement: REQ-DM-SEG-3 — cost & supplier isolation: `[]`, never 403 (D2)

`producto_costos` and `proveedores` MUST have RLS policies `USING (is_admin()) WITH CHECK (is_admin())` on every operation. A non-admin `authenticated` user querying these tables — directly or via PostgREST embedding — MUST receive an empty result (`[]`), never an HTTP error.

#### Scenario: vendedor cannot read producto_costos nor proveedores
- GIVEN an authenticated user with `profiles.rol != 'admin'`
- WHEN they `SELECT * FROM producto_costos` or `SELECT * FROM proveedores`
- THEN both return `[]` — zero rows, not a 403/permission error

#### Scenario: embedded query degrades gracefully

- GIVEN `GET /productos?select=*,producto_costos(costo)` as a non-admin
- WHEN executed
- THEN `productos` rows return normally; the embedded `producto_costos` comes back `null` (PostgREST infers a TO-ONE embed because `producto_costos.producto_id` is both PK and FK — a genuine 1:1 — so RLS-filtered access degrades to an object-or-null, not an array), never a request-level error

> **Corrected 2026-07-15 (`auth-pin` verify, Discovery D3).** The original wording said the embed comes back `[]`. Empirically confirmed against a real JWT in `auth-pin`'s RLS battery (SEG-5.5): a to-one embed degrades to `null`, not `[]` — a to-many embed (e.g. `proveedores` off a table where the FK sits on the "many" side) would still degrade to `[]`. The property both this requirement and REQ-AP-SEG-5 actually care about — the request succeeds (`error === null`) and never surfaces as an HTTP error — holds regardless of shape.

### Requirement: REQ-DM-SEG-4 — every write policy has USING + WITH CHECK

Every RLS policy allowing `INSERT`/`UPDATE` MUST define both `USING` and `WITH CHECK`. A `USING`-only `UPDATE` policy MUST NOT exist — it lets a row be mutated into a state the writer could not have inserted.

#### Scenario: UPDATE without a matching WITH CHECK is rejected
- GIVEN an `UPDATE` policy on `productos` scoped to `authenticated`
- WHEN a request updates a row into a state violating the policy's `WITH CHECK` condition
- THEN Postgres rejects the `UPDATE`; an update within the allowed state space still succeeds

### Requirement: REQ-DM-SEG-5 — money/stock integrity never trusted from the client

Stock non-negativity, server-computed totals, and `medio_pago` validation MUST be enforced in RPC + CHECK constraints, never in JS alone (governing principle, D7).

#### Scenario: a raw RPC call bypassing the UI still enforces stock >= 0
- GIVEN a direct request to `confirmar_venta`, not via the app UI
- WHEN it requests more stock than available
- THEN it is rejected identically to a UI-driven call (see `venta` domain, REQ-DM-VENTA-3)

### Requirement: REQ-AP-SEG-1 — `profiles.activo` revocation-gate column

> Added by `auth-pin` (archived 2026-07-15).

The system MUST add `profiles.activo boolean NOT NULL DEFAULT true`. Existing rows
MUST resolve to `true` on migration (additive, no backfill required beyond the
default). This column is the substrate for REQ-AP-SEG-2 — it carries no behavior
by itself.

#### Scenario: existing profiles remain active after migration
- GIVEN the admin's pre-existing `profiles` row
- WHEN the `activo` column is added
- THEN it reads `true` without any explicit UPDATE

### Requirement: REQ-AP-SEG-2 — `activo` gate on every authorization path (D5)

> Added by `auth-pin` (archived 2026-07-15).

Every RLS policy and RPC gating on `authenticated` or on `is_admin()` — including
`is_admin()` itself — MUST additionally require the calling profile's
`activo = true`. A profile with `activo = false` MUST be denied on the very next
request, independent of access-token expiry (closes the documented ≤1h
revoked-session window, D5), uniformly for both roles: a deactivated `'admin'`
loses admin-only access exactly like a deactivated `'empleado'` loses baseline
access. An active profile of either role MUST see no change in behavior.

#### Scenario: deactivated empleado denied on next request despite a valid JWT
- GIVEN an empleado profile with `activo = false`, holding an unexpired access token
- WHEN that token is used for any authenticated read (e.g. `productos`) or RPC call (e.g. `confirmar_venta`)
- THEN the request is denied (RLS returns zero rows, or the RPC raises) — not merely rate-limited

#### Scenario: deactivated admin loses admin-only access too
- GIVEN a profile with `rol = 'admin'` and `activo = false`
- WHEN `is_admin()` is evaluated for that caller inside any policy
- THEN it returns `false`

### Requirement: REQ-AP-SEG-3 — `enroll-empleado` Edge Function contract (D4)

> Added by `auth-pin` (archived 2026-07-15).

The system MUST expose `enroll-empleado` running with `service_role`, callable only
by a caller that is authenticated, `is_admin()`, and `activo = true` — checked
BEFORE any write. On success it creates the `auth.users` row (admin-set initial
password) and ensures the resulting `profiles` row has `rol = 'empleado'`
**regardless of `handle_new_user()`'s admin-default** (setup-stack REQ-SETUP-8) —
the trigger MUST NOT leak an admin profile for a new employee. It MUST insert one
`audit_log` row (`action='enroll_empleado'`, `actor_id`=admin's id,
`entity_id`=new user id). Rejection MUST leave zero side effects.

#### Scenario: admin enrolls an employee
- GIVEN an authenticated, active admin calls `enroll-empleado` with email + initial password
- WHEN the function completes
- THEN `auth.users` and `profiles` (`rol='empleado'`) rows exist for the new staff member, and one `audit_log` row records the action

#### Scenario: non-admin or inactive-admin caller is rejected
- GIVEN a caller that is not `is_admin()`, or is admin but `activo = false`
- WHEN `enroll-empleado` is invoked
- THEN it is rejected and no `auth.users`, `profiles`, or `audit_log` row is created

### Requirement: REQ-AP-SEG-4 — Revocation action (D5)

> Added by `auth-pin` (archived 2026-07-15).

Revoking a profile MUST execute via a `service_role`-privileged server-side path
(never the anon/authenticated client key — REQ-SETUP-9), gated identically to
REQ-AP-SEG-3. It MUST set `profiles.activo = false` (deterministic, immediate) and
MUST also call `auth.admin.updateUserById(id, {ban_duration:'876000h'})` (durable
refresh-block, defense-in-depth) — the `activo` write MUST NOT depend on the ban
call succeeding. It MUST insert one `audit_log` row (`action='revoke_empleado'`).

#### Scenario: revoked employee is denied immediately, banned durably
- GIVEN an admin revokes an active empleado
- WHEN the action completes
- THEN `profiles.activo = false` takes effect immediately (REQ-AP-SEG-2 denies the next request) and the `auth.users` row is banned for future logins/refreshes
- AND one `audit_log` row records the revocation

### Requirement: REQ-AP-SEG-4a — Self-revoke guard: an admin MUST NOT deactivate their own account

> Added by `auth-pin` (archived 2026-07-15).

Rationale — sole-admin lockout prevention: this project has one admin (Angélica)
and no designed recovery path for a locked-out sole admin (no support console, no
secondary admin, no restore-via-SQL runbook). A successful self-revoke would durably
lock the store out of its only administrative account. An active admin attempting to
deactivate their OWN profile (`p_perfil_id == auth.uid()`, or Edge-Function
`userId === actorId`) MUST be rejected with ZERO side effects: no `activo` flip, no
`ban_duration` call, no `audit_log` row. The guard MUST hold at BOTH layers (defense
in depth): the `enroll-empleado` Edge Function rejects a self-target (`400
cannot_self_target`) before any write, AND the `actualizar_activo_perfil` RPC
independently re-raises for a direct-bypass caller (the RPC is EXECUTE-granted to
`authenticated`, so it is directly callable without the Edge Function). This guard
applies regardless of the target's own role or activo state — it keys on identity,
not role.

#### Scenario: admin self-deactivation via the Edge Function is rejected
- GIVEN an active admin whose id is `A`
- WHEN they PATCH `enroll-empleado` with `userId = A`, `activo = false`
- THEN it is rejected (`400 cannot_self_target`) before any write — `profiles.activo` for `A` is unchanged, no ban is issued, and no `audit_log` row is inserted

#### Scenario: admin self-deactivation via a direct RPC bypass is still rejected
- GIVEN an active admin whose `auth.uid()` is `A`, calling the RPC directly (bypassing the Edge Function)
- WHEN they invoke `actualizar_activo_perfil(p_perfil_id = A, p_activo = false)`
- THEN the RPC raises and no row is updated — the guard does not depend on the Edge Function being in the path

> **Confirmed against live prod** (`auth-pin` verify §2a, 2026-07-15): Angélica attempting to self-revoke via the deployed Edge Function returned `400 cannot_self_target`, with prod state unchanged.

### Requirement: REQ-AP-SEG-5 — Multi-role RLS/RPC verification matrix (closes data-model T-5.1–T-5.5)

> Added by `auth-pin` (archived 2026-07-15). Executed for real, 7/7 rows passing,
> against a disposable local Supabase stack with genuine GoTrue-issued JWTs
> (`auth-pin` verify §1) — not merely designed.

The runtime JWT suite data-model deferred MUST execute against a real `'empleado'`
row, now possible once REQ-SETUP-8/REQ-AP-SEG-1 ship, plus the new
`activo = false` dimension. Every row below is one testable case.

| Case | Actor | Target | Expected |
|---|---|---|---|
| T-5.1 | active empleado | `producto_costos`, `proveedores` SELECT | `[]`, never 403 |
| T-5.2 | active admin vs. active empleado | `configuracion_update_admin` / `proveedores_all_admin` (`is_admin()` on USING + WITH CHECK) | admin's UPDATE commits; empleado's UPDATE is filtered to 0 rows (`[]`-not-403 idiom), not an exception |
| T-5.3 | active admin/empleado | `deshacer_venta` on a non-last sale | RPC error, zero partial effect |
| T-5.4 | active admin/empleado | `confirmar_venta` over available stock | rejected, stock unchanged |
| T-5.5 | active empleado | `productos?select=*,producto_costos(costo)` embed | embed degrades to `null` (to-one, see REQ-DM-SEG-3's corrected scenario), not a request-level error |
| new | anon | any domain table/RPC | `401`/`42501` (no grant) |
| new | inactive empleado (`activo=false`) | every T-5.1–T-5.4 target, incl. plain `productos` SELECT | denied per REQ-AP-SEG-2 |

> **Corrected 2026-07-15 (`auth-pin` verify, Discovery D2).** T-5.2's original wording
> described a hypothetical value-range boundary inherited verbatim from data-model's
> illustrative text; no `productos` UPDATE policy was ever implemented that way (writes
> only go through RPCs). The row above describes the REAL boundary the live
> `is_admin()`-gated WITH CHECK enforces.

## Cross-domain security scenarios (traceability)

| Mandatory scenario | Owning requirement |
|---|---|
| Vendedor cannot read `producto_costos`/`proveedores` → `[]` | REQ-DM-SEG-3 |
| UPDATE without correct WITH CHECK rejected | REQ-DM-SEG-4 |
| Undo a non-last sale → RPC error | REQ-DM-VENTA-4 (`venta`) |
| Stock never negative | REQ-DM-VENTA-3 (`venta`) + REQ-DM-CAT-1 (`catalogo`) |
| Deactivated profile denied on the very next request, either role | REQ-AP-SEG-2 |
| Admin cannot self-revoke, at either layer | REQ-AP-SEG-4a |
| Multi-role JWT battery (data-model T-5.1–T-5.5 + activo dimension) | REQ-AP-SEG-5 |
