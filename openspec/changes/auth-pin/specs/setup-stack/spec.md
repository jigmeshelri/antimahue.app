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

### Requirement: REQ-SETUP-8 — Profiles table — multi-role (admin, empleado)

(Previously: MVP scoped to exactly 1 row, `rol CHECK (rol IN ('admin'))`, default `'admin'`.)

The `profiles` table MUST accept `rol IN ('admin', 'empleado')` (D3 — `'empleado'`, not
issue #3's `'seller'`, per data-model's es-domain/en-platform convention). The CHECK
MUST be widened via an additive migration (`DROP CONSTRAINT` + `ADD CONSTRAINT`, same
column/default), never a destructive table rewrite. The default for new rows MUST
remain `'admin'` only for the signup trigger path (`handle_new_user()` — self-signup
stays admin-only); `'empleado'` rows MUST only be created via `enroll-empleado`
(seguridad domain, REQ-AP-SEG-3), never via self-signup.

#### Scenario: empleado role now accepted
- GIVEN the widened CHECK `rol IN ('admin', 'empleado')`
- WHEN a row is inserted with `rol = 'empleado'`
- THEN Postgres accepts it

#### Scenario: an undefined role value is still rejected
- GIVEN the widened CHECK
- WHEN a row is inserted with `rol = 'vendedor'` or any value outside `('admin','empleado')`
- THEN Postgres rejects it with a check constraint violation

#### Scenario: self-signup still defaults to admin, never empleado
- GIVEN `handle_new_user()` fires on a new `auth.users` insert via the public signup path
- WHEN the trigger creates the `profiles` row
- THEN `rol` is `'admin'` — the trigger MUST NOT be a path to create an `'empleado'` row
