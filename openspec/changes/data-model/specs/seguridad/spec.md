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
- THEN `productos` rows return normally and embedded `producto_costos` comes back `[]`, not a request-level error

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

## Cross-domain security scenarios (traceability)

| Mandatory scenario | Owning requirement |
|---|---|
| Vendedor cannot read `producto_costos`/`proveedores` → `[]` | REQ-DM-SEG-3 |
| UPDATE without correct WITH CHECK rejected | REQ-DM-SEG-4 |
| Undo a non-last sale → RPC error | REQ-DM-VENTA-4 (`venta`) |
| Stock never negative | REQ-DM-VENTA-3 (`venta`) + REQ-DM-CAT-1 (`catalogo`) |
