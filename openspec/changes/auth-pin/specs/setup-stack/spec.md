---
change: auth-pin
phase: specs
status: completed
depends_on: [data-model]
supersedes: ~
persistence: openspec+engram
domain: setup-stack
type: delta
modifies: [REQ-SETUP-8]
---

# Delta for Setup-Stack

`profiles.rol` was scoped to a single-admin MVP (REQ-SETUP-8). auth-pin widens it
to a real two-role system (D2, D3) — this is the FIRST change to touch that CHECK.

## MODIFIED Requirements

### Requirement: REQ-SETUP-8 — Profiles table — multi-role (admin, empleado), least-privilege signup

(Previously: MVP scoped to exactly 1 row, `rol CHECK (rol IN ('admin'))`, default `'admin'`.
CORRECTED 2026-07-14: this delta's first draft required self-signup to keep defaulting to
`'admin'` — drafted against pre-hardening behavior. The approved design (design.md §3) wins:
the apply agent verified empirically that the pre-migration trigger + column DEFAULT `'admin'`
is a LIVE privilege-escalation hole — any anonymous `signUp()` minted a full admin.)

The `profiles` table MUST accept `rol IN ('admin', 'empleado')` (D3 — `'empleado'`, not
issue #3's `'seller'`, per data-model's es-domain/en-platform convention). The CHECK
MUST be widened via an additive migration (`DROP CONSTRAINT` + `ADD CONSTRAINT`, same
column), never a destructive table rewrite. `handle_new_user()` MUST derive the role
from tamper-proof `app_metadata` — `COALESCE(NEW.raw_app_meta_data->>'rol', 'empleado')`
— so a row created without service_role-set metadata defaults to LEAST privilege
(`'empleado'`), never `'admin'`. Only a service_role path (`enroll-empleado`, seguridad
domain REQ-AP-SEG-3 — never the client) can set `app_metadata.rol`; self-signup, if
ever enabled, MUST NOT yield an admin profile. Bootstrap consequence: on a FRESH
environment the first user no longer auto-becomes admin — first-admin provisioning
MUST be a deliberate manual/seed step (service_role or SQL), not a signup side effect.

#### Scenario: empleado role now accepted
- GIVEN the widened CHECK `rol IN ('admin', 'empleado')`
- WHEN a row is inserted with `rol = 'empleado'`
- THEN Postgres accepts it

#### Scenario: an undefined role value is still rejected
- GIVEN the widened CHECK
- WHEN a row is inserted with `rol = 'vendedor'` or any value outside `('admin','empleado')`
- THEN Postgres rejects it with a check constraint violation

#### Scenario: self-signup without app_metadata defaults to least privilege
- GIVEN `handle_new_user()` fires for a new `auth.users` row whose `raw_app_meta_data` carries no `rol` key
- WHEN the trigger creates the `profiles` row
- THEN `rol` is `'empleado'` — an anonymous `signUp()` can never mint an admin

#### Scenario: service_role-set app_metadata still yields admin
- GIVEN an `auth.users` row created with `app_metadata.rol = 'admin'` (settable only by service_role)
- WHEN the trigger runs
- THEN the `profiles` row has `rol = 'admin'`

#### Scenario: fresh environment has no automatic first admin
- GIVEN a fresh environment with zero users
- WHEN the first user signs up without service_role-set metadata
- THEN their profile is `'empleado'` — the first admin is provisioned by a deliberate seed/service_role step, not by signup order
