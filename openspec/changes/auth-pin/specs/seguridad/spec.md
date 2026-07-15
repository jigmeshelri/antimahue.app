---
change: auth-pin
phase: specs
status: completed
depends_on: [data-model]
supersedes: ~
persistence: openspec+engram
domain: seguridad
type: delta
columns: [profiles.activo]
functions: [enroll-empleado]
closes: [T-5.1, T-5.2, T-5.3, T-5.4, T-5.5]
oq_dependent: [OQ-2, OQ-4]
---

# Delta for Seguridad

Activates data-model's day-one-inert admin-only RLS for a real second role (D2);
closes its two undesigned flows, enrollment (D4) and revocation (D5). ID prefix
`REQ-AP-SEG`, continuing the `REQ-DM-SEG` family.

## ADDED Requirements

### Requirement: REQ-AP-SEG-1 — `profiles.activo` revocation-gate column

The system MUST add `profiles.activo boolean NOT NULL DEFAULT true`. Existing rows
MUST resolve to `true` on migration (additive, no backfill required beyond the
default). This column is the substrate for REQ-AP-SEG-2 — it carries no behavior
by itself.

#### Scenario: existing profiles remain active after migration
- GIVEN the admin's pre-existing `profiles` row
- WHEN the `activo` column is added
- THEN it reads `true` without any explicit UPDATE

### Requirement: REQ-AP-SEG-2 — `activo` gate on every authorization path (D5)

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

The system MUST expose `enroll-empleado` running with `service_role`, callable only
by a caller that is authenticated, `is_admin()`, and `activo = true` — checked
BEFORE any write. On success it creates the `auth.users` row (admin-set initial
password) and ensures the resulting `profiles` row has `rol = 'empleado'`
**regardless of `handle_new_user()`'s admin-default** (setup-stack delta,
REQ-SETUP-8) — the trigger MUST NOT leak an admin profile for a new employee. It
MUST insert one `audit_log` row (`action='enroll_empleado'`, `actor_id`=admin's id,
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

### Requirement: REQ-AP-SEG-5 — Multi-role RLS/RPC verification matrix (closes data-model T-5.1–T-5.5)

The runtime JWT suite data-model deferred MUST execute against a real `'empleado'`
row, now possible once REQ-SETUP-8/REQ-AP-SEG-1 ship, plus the new
`activo = false` dimension. Every row below is one testable case.

| Case | Actor | Target | Expected |
|---|---|---|---|
| T-5.1 | active empleado | `producto_costos`, `proveedores` SELECT | `[]`, never 403 |
| T-5.2 | active admin | a write policy's `WITH CHECK` (`configuracion`/`proveedores`) | out-of-bounds UPDATE rejected; in-bounds succeeds |
| T-5.3 | active admin/empleado | `deshacer_venta` on a non-last sale | RPC error, zero partial effect |
| T-5.4 | active admin/empleado | `confirmar_venta` over available stock | rejected, stock unchanged |
| T-5.5 | active empleado | `productos?select=*,producto_costos(costo)` embed | embed degrades to `[]`, not a request-level error |
| new | anon | any domain table/RPC | `401`/`42501` (no grant) |
| new | inactive empleado (`activo=false`) | every T-5.1–T-5.4 target, incl. plain `productos` SELECT | denied per REQ-AP-SEG-2 |
