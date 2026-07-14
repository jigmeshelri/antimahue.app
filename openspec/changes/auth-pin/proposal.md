---
change: auth-pin
phase: proposal
status: completed
depends_on: [data-model]
supersedes: ~
persistence: openspec+engram
updated_at: 2026-07-14
---

# Proposal: auth-pin — 4-digit PIN unlock + admin/empleado roles (Antimahue MVP)

## Intent

GH issue #3 asks for PIN login + two roles: admin (Angélica) sees everything; the seller sells only,
no costs/suppliers. The **core auth architecture is already decided** — `setup-stack` D5
(SECURITY-CRITICAL, CHOSEN 2026-06-21): the PIN is **never a credential** and never reaches the server.
Model = a real Supabase Auth login ONCE per staff member (email+password) → refresh token encrypted at
rest in IndexedDB under a `PBKDF2(pin, salt, 600_000, SHA-256)`-derived AES-GCM-256 key → daily "unlock"
= a local decrypt attempt; a wrong PIN surfaces as a GCM auth-tag failure, never a token. `src/lib/crypto.ts`
already implements this end-to-end; `src/features/auth/PinScreen.tsx` is a one-line skeleton.

This change is therefore **not** re-architecture. It is: (1) unblock the schema so a second role can exist,
(2) build the UI/state layer around the already-complete `crypto.ts`, (3) design the two flows that block a
working multi-role system and are undesigned anywhere — employee **enrollment** and **revocation** —, and
(4) run the JWT runtime-verification suite (T-5.1..T-5.5) that `data-model` deferred to this change.

Governing principle inherited: **the client bundle is UNTRUSTED — authorization lives in Postgres.** This
change gates access to money and third-party (supplier) data, so revocation of a fired employee is a
security requirement, not a nicety.

> **SCOPE-CREEP FLAG.** This is much more than "a PIN screen". Widening `profiles.rol` CHECK + activating
> multi-role RLS + a service_role enrollment Edge Function + an `activo` revocation gate + a net-new admin
> employee-management screen (absent from the 9-screen hi-fi handoff) + the deferred JWT verification suite
> together make this a LARGE change. The proposal keeps each piece MINIMAL and flags what is being invented
> vs replicated (Risk R1, R2).

Superseded intent: issue #3's own prose ("PIN almacenado como hash… localStorage", role "seller") predates
the SDD security design and is treated as superseded, NOT as a literal spec (see D1, D3).

## Scope

### In scope
- **Schema unblock**: widen `profiles.rol` CHECK from `('admin')` to `('admin','empleado')`; add
  `profiles.activo boolean NOT NULL DEFAULT true` (revocation gate). New versioned migration under
  `supabase/migrations/`.
- **Multi-role activation**: the admin-only RLS/RPC layer `data-model` already shipped becomes LIVE for a
  real second role (no rework — `is_admin()`, `producto_costos`/`proveedores` policies already exist). Add
  an `activo` check where revocation must bite immediately.
- **PIN unlock UI/state** around `src/lib/crypto.ts` (reused, not edited): real `PinScreen.tsx`, `PinPad`/
  `PinDot` atoms + user-selector molecule, `usePinUnlock` hook, lockout store backed by `auth_attempts`,
  IndexedDB storage layer for the encrypted blob + salt per enrolled profile. User selector sourced ENTIRELY
  from local IndexedDB (which profiles have an enrolled blob in THIS browser) — no anon-readable staff
  directory (none exists; `profiles` RLS is own-row-only).
- **Employee enrollment** (D4, minimal): admin-only `enroll-empleado` Edge Function (service_role, gated on
  `is_admin()`) creating the staff `auth.users` + `profiles` row; one-time device pairing (employee logs in
  email+password once → sets PIN → blob encrypted locally). Minimal admin employee-management screen.
- **Revocation** (D5): `activo` gate in RLS/RPC + admin-triggered `auth.admin.updateUserById(id,
  {ban_duration:'876000h'})` hard-lock.
- **Verify**: execute `data-model`'s deferred JWT runtime-verification suite T-5.1..T-5.5.

### Out of scope
- Invite-email / bulk enrollment flows — a store on ONE shared phone does not need email invites; `createUser`
  with an admin-set initial password fits the shared-device model (D4).
- Password-reset / email-verification UX, MFA, "remember this device" beyond the single encrypted blob.
- Any Supabase Pro session feature (native inactivity-timeout, time-box, single-session-per-user) — the
  project is on the FREE plan (verified 2026-07-14). Idle auto-lock is client-side (D6).
- Screens beyond PIN + the minimal employee-management form — catálogo/venta/dashboard remain later changes.
- Re-opening the D5 crypto model (D1: carried forward, not re-litigated).

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Core auth model | **Carry forward setup-stack D5: PIN never a credential; local AES-GCM refresh token unlocked by PBKDF2(pin). Do NOT reopen** | Re-architect: PIN-as-password `signInWithPassword` / server-side PBKDF2-hash Edge Function / anonymous sign-in |
| D2 | Multi-role enablement scope | **Bundle into auth-pin: widen `profiles.rol` CHECK + activate the already-written admin-only RLS/RPC** | Defer to a separate later multi-role change |
| D3 | Second role value | **`'empleado'`** (es-domain, per data-model D1 naming convention) | `'seller'` (issue #3 English text) |
| D4 | Employee enrollment | **In scope, minimal: admin-only `enroll-empleado` Edge Function (service_role + `is_admin()`) creates auth.users + profiles; one-time device pairing sets the PIN** | Defer (leaves multi-role non-functional — nobody can create staff); full invite-email / bulk flow |
| D5 | Revocation | **In scope: new `profiles.activo` gate in RLS/RPC (closes the ≤1h access-token window on the NEXT request) + admin `ban_duration` hard-lock** | Accepted risk (≤1h window); rely on refresh-token revocation alone |
| D6 | Session / idle controls | **Client-side idle auto-lock (clear in-memory access token → re-require PIN); zero dependency on Supabase Pro session features** | Assume native inactivity-timeout / time-box / single-session (Pro-gated; project is FREE) |

### D1 — Core auth model: carry forward setup-stack D5 (do NOT reopen)
setup-stack D5 already resolved "how does a 4-digit PIN map onto Supabase Auth". The four candidates were
weighed in the exploration: (a) PIN-as-password → PIN transits the wire every unlock, needs network every
unlock (bad for patchy store wifi), anti-pattern; (b) server-side PBKDF2-hash Edge Function → most moving
parts, still network every unlock, duplicates (d); (c) anonymous sign-in → dead end, an anonymous identity
is destroyed on sign-out/clear-data/new-device so you cannot revoke one real fireable employee; (d) the
CHOSEN model — real login ONCE, PIN unlocks a locally-encrypted refresh token. `crypto.ts` implements (d)
already (`deriveKey`, `generateSalt`, `encryptToken`, `decryptToken`). The PIN is a local unlock key, NOT
an authorization boundary — it only decrypts an already-authorized token; Postgres RLS/RPC remains the real
boundary. **MUST NOT** re-litigate D5; remaining work is UI + state + the two undesigned flows.

### D2 — Bundle multi-role enablement (MUST)
`data-model` deliberately shipped `is_admin()` and admin-only policies on `producto_costos`/`proveedores`
that are **inert while only `'admin'` exists** (data-model R3, "active the day `'empleado'` is added, no
rework"). The scaffold literally blocks a second role: `profiles.rol CHECK (rol IN ('admin'))` in
`supabase/migrations/20260621000000_initial_scaffold.sql`. Bundling the CHECK widening + RLS activation into
auth-pin is chosen because **a PIN with only one possible role has no product value** — the whole point of
issue #3 is "employees sell but don't see costs". Splitting the CHECK into a separate change would ship a
PIN screen that cannot demonstrate the security property it exists for. Cost of bundling is one additive
ALTER; benefit is a coherent, testable multi-role system.

### D3 — Role value `'empleado'` (MUST)
data-model D1 established the convention: **es-domain / en-platform**. `profiles.rol` is a domain concept
(this is a Chilean retail role), and the prose across data-model calls the person "vendedor/vendedora". The
CHECK value is `'empleado'`. Issue #3's `'seller'` is English platform-style naming inconsistent with the
established schema vocabulary → rejected. (Display label in the UI can still read "Vendedora" — the CHECK
value and the label are separate concerns.)

### D4 — Employee enrollment: in scope, minimal (MUST) — the scope-creep piece
No enrollment path exists today: `handle_new_user()` fires on ANY `auth.users` insert, which is fine for one
self-signed-up admin but WRONG as a public signup for employees. Without enrollment nobody can create a
second `auth.users` row, so a multi-role system is non-functional and issue #3's AC "Login muestra lista de
usuarios registrados" is unsatisfiable. Chosen: keep it MINIMAL.
- **Server side**: an admin-only Edge Function `enroll-empleado` (runs with service_role, gated on
  `is_admin()`) calls `supabase.auth.admin.createUser()` to create the staff `auth.users` row with
  `rol='empleado'` and an admin-set initial password. Path: `supabase/functions/enroll-empleado/`.
- **Client side (device pairing)**: the employee logs in ONCE with email+password on the shared phone and
  sets a 4-digit PIN; that pairing encrypts the refresh token into IndexedDB (this is the ONE-TIME real
  login D1 requires). Subsequent days = PIN unlock only.
- **UI**: a minimal admin employee-management screen (list + "add employee" form). This screen is **absent
  from the 9-screen hi-fi handoff** → it is being invented, not replicated (Risk R2).
Rejected: deferring enrollment (breaks the feature); `inviteUserByEmail` (needs employee email access —
friction on a one-shared-phone store).

### D5 — Revocation: `activo` gate + hard-lock (MUST)
Verified against current Supabase docs (2026-07-14): revoking a session revokes the refresh token, but
"Access Tokens of revoked sessions remain valid until their expiry" (default ≤1h). For a store gating money
+ supplier data, a fired employee retaining ≤1h of access is unacceptable under the governing security
principle. Chosen — two independent gates:
- **DB-side, immediate**: new column `profiles.activo boolean NOT NULL DEFAULT true`, checked inside the
  RLS policies / RPCs that must bite (SELECT on sensitive tables, `confirmar_venta`, etc.). A revoked user
  fails on the NEXT request regardless of JWT freshness.
- **Auth-side, durable**: admin triggers `supabase.auth.admin.updateUserById(id, {ban_duration:'876000h'})`
  (documented "ban 100 years") to hard-lock the `auth.users` row and block refresh.
Rejected: accepting the ≤1h window. The `activo` gate is cheap (one column + a few policy predicates) and
closes it deterministically.

### D6 — No Pro session features; client-side idle lock (MUST)
Project plan = **FREE** (org `Segudora Org`, verified via MCP 2026-07-14). Supabase native session controls
(inactivity timeout, time-box, single-session-per-user) are **Pro-plan-gated** and therefore unavailable —
the design MUST NOT assume them. Any "re-require PIN after N minutes idle" is implemented client-side: a
local idle timer clears the in-memory access token and forces PIN re-entry. This is a UX lock, not a
security boundary — the encrypted refresh-token blob stays at rest either way, so no authorization is lost
or gained. Cheap, offline, zero plan dependency.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/*.sql` | New | Widen `profiles.rol` CHECK to `('admin','empleado')`; add `profiles.activo`; add `activo` predicate to RLS/RPC where revocation bites. |
| `supabase/functions/enroll-empleado/` | New | service_role Edge Function, admin-gated, creates staff `auth.users` + `profiles` row. |
| `src/features/auth/PinScreen.tsx` | Modified | Skeleton → real container: unlock flow, user selector from local IndexedDB blobs. |
| `src/components/{atoms,molecules}/*` | New | `PinPad`, `PinDot` atoms + user-selector molecule. |
| `src/lib/crypto.ts` | Reused (not edited) | Already complete (PBKDF2 600k + AES-GCM-256). |
| `src/lib/` IndexedDB storage layer | New | Persist encrypted refresh-token blob + salt per enrolled profile (raw WebCrypto/IndexedDB or vetted helper — OQ-1). |
| `src/stores/auth.ts` | Modified | Add lockout + enrollment state (today: session/user/loading only). |
| lockout store (backed by `auth_attempts`) | New | Per-user attempt throttling; `auth_attempts` is already multi-user-shaped (nullable `user_id` FK). |
| Admin employee-management screen | New | Net-new UI — absent from the 9-screen hi-fi handoff. |
| data-model JWT verification suite (T-5.1..T-5.5) | Executes | Deferred from data-model; run in this change's verify phase. |
| `openspec/project.yaml` → `active_changes` | Modified | `auth-pin` added. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | Scope creep: CHECK + RLS activation + enrollment + revocation + UI + verify-suite ≫ "a PIN screen" — an oversized change | High | Each deliverable kept MUST-minimal; defer invite-email/bulk; design phase sequences it into small tasks. |
| R2 | Enrollment flow + admin employee-management screen are net-new, absent from the hi-fi handoff (no design reference to replicate) | High | Design phase produces the screen spec; keep to one form; explicitly flag to the user that this UI is being invented. |
| R3 | Revocation window: without the `activo` gate a fired employee keeps ≤1h access to costs/suppliers/sales | Med (high impact) | D5 `activo` gate bites on the next request; `ban_duration` blocks refresh. |
| R4 | `crypto.ts` never smoke-tested inside the INSTALLED PWA (service-worker context) — setup-stack task 7.10 status unknown | Med | Verify phase MUST run the PWA-context smoke test before the unlock path is trusted. |
| R5 | Adding an IndexedDB helper dep collides with pnpm secure-by-default (`minimumReleaseAge=1440`) + supply-chain posture | Low | OQ-1: prefer raw WebCrypto/IndexedDB (zero dep) unless design justifies a vetted, >24h-old helper. |
| R6 | Widening the CHECK / adding a column is a schema change on a LIVE prod DB (`data-model` is live) | Low | Additive ALTER (recreate CHECK to add a value; add nullable-with-default column); reversible down migration; deploy via the GitHub schema integration. |

## Rollback Plan
All migrations are additive: widen the CHECK, add `activo` (default true), add the Edge Function. Down
migration narrows the CHECK back to `('admin')` (safe only if no `'empleado'` rows exist — document the
precondition), drops `profiles.activo`, removes `enroll-empleado`. UI is new files (delete). No existing
infra (`profiles` base columns, `is_admin()` body semantics, `data-model` tables) is destructively altered.

## Dependencies
- **`data-model`** (archived, LIVE in prod) — provides `profiles`, `is_admin()`, `auth_attempts`, and the
  RLS/RPC layer this change activates for the second role.
- **`setup-stack`** (archived) — provides D5 crypto model, complete `src/lib/crypto.ts`, `PinScreen.tsx`
  skeleton, `src/stores/auth.ts` base atom.
- **APPLY GATE (session decision — do NOT skip)**: apply is BLOCKED until (a) a minimal toolchain exists —
  linter + formatter + test runner + CI — and (b) Supabase TypeScript types are generated
  (`supabase gen types typescript`). Planning phases (spec/design/tasks) proceed now; apply waits on this gate.
- **Supabase plan = FREE** (verified 2026-07-14): no Pro session features (D6).

## Success Criteria
- [ ] `profiles.rol` accepts `'empleado'`; an employee row exists and authenticates via PIN unlock.
- [ ] An employee cannot read `producto_costos` / `proveedores` — data-model's day-one-inert admin-only RLS
      now BITES for a real second role.
- [ ] Admin can enroll an employee (create `auth.users` + `profiles`) with NO public self-signup path.
- [ ] Admin can revoke an employee; the revoked user loses access on the NEXT request (`activo` gate), not
      after ≤1h.
- [ ] The PIN never travels to the server: a network trace shows no PIN and no token in any unlock request
      (only the one-time email+password enrollment login authenticates over the wire).
- [ ] A wrong PIN surfaces as a local decrypt failure with lockout backoff — never a token.
- [ ] `data-model` JWT runtime-verification suite T-5.1..T-5.5 executed and passing.
- [ ] No authorization logic in `src/**` — every rule is a Postgres policy / constraint / RPC.

## Open Questions for design
- **OQ-1** — IndexedDB access: raw WebCrypto/IndexedDB (zero dep, preferred under pnpm secure-by-default) vs
  a vetted helper (`idb-keyval`, MUST be >24h old per `minimumReleaseAge`). Design decides.
- **OQ-2** — Lockout policy numbers: max attempts before backoff, backoff curve, lockout duration — backed by
  `auth_attempts`. Spec/design sets the exact values.
- **OQ-3** — Device-pairing UX: does the employee set their own PIN on first email+password login on the
  shared phone (recommended), or does the admin pre-set a temporary PIN? Design decides the handshake.
- **OQ-4** — `enroll-empleado` primitive: `auth.admin.createUser()` (immediate, admin sets initial password —
  recommended for a shared-phone store) vs `inviteUserByEmail()` (needs employee email access). Design confirms.
