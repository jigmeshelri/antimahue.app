---
change: auth-pin
phase: specs
status: completed
depends_on: [data-model]
supersedes: ~
persistence: openspec+engram
domain: auth
type: new
oq_dependent: [OQ-1, OQ-2, OQ-3]
---

# Auth (PIN unlock / session) — Specification

## Purpose

Client-side session behavior around the already-complete `src/lib/crypto.ts`
(D1, carried forward — NOT reopened): local PIN unlock, lockout, idle auto-lock,
and how the SPA learns its own `rol`/`activo`. NEW territory. ID prefix `REQ-AUTH`.

## Requirements

### Requirement: REQ-AUTH-1 — PIN unlock is local-only, zero network (D1)

Unlocking — deriving the AES-GCM key via PBKDF2(SHA-256, 600,000 iterations) and
decrypting the stored refresh-token blob — MUST NOT perform any network request.
Only the one-time enrollment/device-pairing login (email + password, D4/OQ-3)
authenticates over the wire; every subsequent daily unlock is local.

#### Scenario: successful unlock makes no network call
- GIVEN a device already paired (encrypted blob + salt present)
- WHEN the correct PIN is entered
- THEN the unlock completes with zero network requests, and the existing session resumes

#### Scenario: wrong PIN surfaces as a local decrypt failure, never a token
- GIVEN the same paired device
- WHEN an incorrect PIN is entered
- THEN `decryptToken` throws (AES-GCM auth-tag failure) locally — no PIN or token is ever transmitted, and the failure is treated as a lockout-counted attempt (REQ-AUTH-2)

### Requirement: REQ-AUTH-2 — Lockout mechanism, parameterized (OQ-2)

Repeated PIN failures for a profile MUST trigger a progressive client-side
backoff, mirrored server-side in one `auth_attempts` row per attempt (defense in
depth — a wipe-local-storage attacker still faces the server throttle). Beyond a
configurable failure threshold, the system MUST require full re-login (wipe the
local encrypted blob) instead of accepting further PIN attempts. Exact attempt
counts and durations are parameterized — set by design (OQ-2), not fixed here.

#### Scenario: failures short of the threshold lock temporarily
- GIVEN N consecutive PIN failures below the configured full-relogin threshold
- WHEN a further attempt is made before the backoff window elapses
- THEN it is blocked client-side until the window expires; no `decryptToken` call is made

#### Scenario: reaching the threshold forces full re-login
- GIVEN failures reach the configured threshold
- WHEN the next attempt would occur
- THEN the local encrypted blob is wiped and a full email+password login is required

### Requirement: REQ-AUTH-3 — Client-side inactivity auto-lock (D6)

After a configurable idle period with no user interaction, the SPA MUST clear the
in-memory access token and require PIN re-entry to resume. This is a UX lock, not
a revocation: the encrypted refresh-token blob at rest MUST NOT be touched. This
MUST NOT depend on any Supabase Pro session feature — the project is on the FREE
plan.

#### Scenario: idle beyond threshold forces PIN re-entry
- GIVEN no user interaction for the configured idle period
- WHEN the threshold elapses
- THEN the in-memory access token is cleared and `PinScreen` is shown

#### Scenario: resuming after idle-lock uses the same local unlock path
- GIVEN the app is idle-locked
- WHEN the correct PIN is entered
- THEN the session resumes via the same zero-network unlock as REQ-AUTH-1 — no re-authentication over the wire

### Requirement: REQ-AUTH-4 — Role/`activo` claim resolution (client)

After establishing a session (fresh login or PIN unlock), the SPA MUST resolve
`rol`/`activo` by reading its own `profiles` row (`profiles_select_own`) — never
from a client-cached value for an authorization decision (UI-shaping cache is
fine; the boundary stays in Postgres). It MUST re-fetch on every unlock so a
same-day role change or revocation is reflected before role-gated UI renders.

#### Scenario: unlock triggers a fresh profile read before rendering
- GIVEN a successful PIN unlock
- WHEN the app resumes
- THEN it queries its own `profiles` row before rendering any role-gated screen

#### Scenario: a stale cached role is not trusted
- GIVEN a locally cached `rol` from a previous day
- WHEN the fresh `profiles` read returns a different value (or `activo=false`)
- THEN the fresh value wins for every rendering and access decision
