---
change: auth-pin
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domain: auth
---

# Auth (PIN unlock / session) — Specification

## Purpose

Client-side session behavior around `src/lib/crypto.ts` (D1): local PIN unlock,
lockout, idle auto-lock, and how the SPA learns its own `rol`/`activo`. ID prefix
`REQ-AUTH`. First delivered by `auth-pin` (archived 2026-07-15) — verify verdict
PASS WITH WARNINGS, 0 CRITICAL (see `openspec/changes/archive/2026-07-15-auth-pin/verify-report.md`).
REQ-AUTH-1 and Success Criterion #1 (proposal.md) shipped as PARTIAL: the
mechanism is confirmed by architecture, code inspection, and unit tests, but no
live HAR/network-trace capture nor an employee-specific end-to-end PIN pairing
in prod was performed this cycle (residual W-1, non-blocking, carried forward).

## Requirements

### Requirement: REQ-AUTH-1 — PIN unlock is local-only, zero network (D1)

Unlocking — deriving the AES-GCM key via PBKDF2(SHA-256, 600,000 iterations) and
decrypting the stored refresh-token blob — MUST NOT perform any network request.
Only the one-time enrollment/device-pairing login (email + password, D4) authenticates
over the wire; every subsequent daily unlock is local.

#### Scenario: successful unlock makes no network call
- GIVEN a device already paired (encrypted blob + salt present)
- WHEN the correct PIN is entered
- THEN the unlock completes with zero network requests, and the existing session resumes

#### Scenario: wrong PIN surfaces as a local decrypt failure, never a token
- GIVEN the same paired device
- WHEN an incorrect PIN is entered
- THEN `decryptToken` throws (AES-GCM auth-tag failure) locally — no PIN or token is ever transmitted, and the failure is treated as a lockout-counted attempt (REQ-AUTH-2)

> **Verify status (2026-07-15): PARTIAL.** Confirmed by architecture (DD-7
> in-memory storage), direct code inspection (`pinUnlock.ts`'s `attemptUnlock`,
> no network call in the decrypt/wrong-PIN path), and unit tests
> (`pinUnlock.test.ts`). No live HAR/devtools network-trace capture was made —
> residual W-1, non-blocking, recommended before the next change that touches auth.

### Requirement: REQ-AUTH-2 — Lockout mechanism, parameterized

Repeated PIN failures for a profile MUST trigger a progressive client-side
backoff, mirrored server-side in one `auth_attempts` row per attempt (defense in
depth — a wipe-local-storage attacker still faces the server throttle). Beyond a
configurable failure threshold, the system MUST require full re-login (wipe the
local encrypted blob) instead of accepting further PIN attempts. Exact attempt
counts and durations are parameterized — set by design, not fixed here.

#### Scenario: failures short of the threshold lock temporarily
- GIVEN N consecutive PIN failures below the configured full-relogin threshold
- WHEN a further attempt is made before the backoff window elapses
- THEN it is blocked client-side until the window expires; no `decryptToken` call is made

#### Scenario: reaching the threshold forces full re-login
- GIVEN failures reach the configured threshold
- WHEN the next attempt would occur
- THEN the local encrypted blob is wiped and a full email+password login is required

> **Verify status: PASS.** `lock.test.ts` (10 cases) + code inspection of
> `nextLockState`/`attemptUnlock`'s catch path.

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

> **Verify status: PASS.** `idleLock.test.ts` (15 cases, pure logic w/ injected
> clock) + `useIdleLock.ts`/`main.tsx` wiring inspected. The idle threshold's
> exact value (5 min default) is a still-open, non-blocking parameter (Gap 4,
> pending user confirmation) — does not affect the mechanism's correctness.

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

> **Verify status: PASS.** `pinUnlock.ts`'s `attemptUnlock` reads
> `profiles.rol/activo` fresh on every unlock (code confirmed directly), never
> trusts the vault's cached `rol` hint, gates on `activo` before setting `$auth`.
> Route guards (`routeGuards.ts`) are explicitly UX-only (DD-8), not an
> authorization boundary — all real authz lives in Postgres (RLS/RPC), per
> `seguridad` domain REQ-AP-SEG-2.

### Requirement: REQ-AUTH-5 — Unpair affordance is discoverable on the PIN screen (D1)

`PinUnlockPanel` MUST show a text link, `"¿No eres tú? Desvincular este
teléfono"`, directly under the `<displayName> · <rol>` line, for every profile
rendered on the PIN screen — whether that profile was auto-selected (exactly one
profile paired) or chosen from `UserSelector` (2+ profiles paired). The link MUST
NOT be placed on the pad grid.

#### Scenario: link visible with a single paired profile
- GIVEN exactly one profile is paired on the device
- WHEN `PinScreen` auto-selects it and renders `PinUnlockPanel`
- THEN the panel shows `"¿No eres tú? Desvincular este teléfono"` under the name/role line

#### Scenario: link visible after choosing from the selector
- GIVEN 2+ profiles are paired
- WHEN the user picks one from `UserSelector`
- THEN `PinUnlockPanel` renders the same unpair link for the chosen profile

### Requirement: REQ-AUTH-6 — Inline confirm with consequence note, no credential (D2, D3, OQ-1)

Tapping the unpair link MUST replace it in place (no modal) with a one-line
consequence note, `"Necesitarás el correo y la contraseña para volver a
vincular."`, followed by two buttons: `"Sí, desvincular"` and `"Cancelar"`.
Reaching or leaving this confirm state MUST NOT require entering the PIN and
MUST NOT perform any network request.

#### Scenario: tapping the link shows the inline confirm
- GIVEN the unpair link is visible
- WHEN the user taps it
- THEN the link is replaced by the consequence note and the `"Sí, desvincular"`/`"Cancelar"` buttons, with no PIN entry and no network request

#### Scenario: cancel restores the link and changes nothing
- GIVEN the inline confirm state is showing
- WHEN the user taps `"Cancelar"`
- THEN the panel returns to showing the unpair link, no vault record is deleted, and `$lock` is unchanged

### Requirement: REQ-AUTH-7 — Confirmed unpair deletes only the local vault record, zero network (D3, D6)

Confirming unpair (`"Sí, desvincular"`) MUST call `deleteRecord(userId)` for only
that profile and reset that profile's lockout state (`$lock`) so it cannot leak
to whichever profile is shown next. The confirmed action MUST perform zero
network requests and MUST NOT require a PIN or password.

#### Scenario: confirm deletes the record with no network call
- GIVEN the inline confirm state for profile X
- WHEN the user taps `"Sí, desvincular"`
- THEN `deleteRecord(X.userId)` is called, zero network requests are made, and no PIN was required at any point in the flow

#### Scenario: lockout state does not leak to the next profile
- GIVEN profile X was mid-cooldown (`$lock.lockedUntil` in the future) when unpaired
- WHEN the unpair completes
- THEN `$lock` is reset before any other profile's PIN screen is shown

### Requirement: REQ-AUTH-8 — Post-unpair destination is derived from a fresh vault read (D4, OQ-2)

After a confirmed unpair, the system MUST re-run `listRecords()` and derive the
next screen from that fresh result — never from an optimistic local mutation of
the previously loaded records. A zero-record result MUST navigate to `/pair`. A
result with one or more remaining records MUST show `UserSelector` (or
auto-select when exactly one remains, per existing `PinScreen` behavior).

#### Scenario: last profile unpaired navigates to /pair
- GIVEN exactly one profile is paired
- WHEN the user confirms unpair
- THEN `listRecords()` re-reads zero records and the app navigates to `/pair`

#### Scenario: unpairing one of two profiles returns to the selector
- GIVEN two profiles, A and B, are paired
- WHEN the user unpairs A
- THEN `listRecords()` re-reads and returns only B, and the app shows `UserSelector` (or auto-selects B) — never a stale reference to A

### Requirement: REQ-AUTH-9 — Non-destructive profile switch, only with 2+ profiles (D5)

When 2+ profiles are paired on the device, `PinUnlockPanel` MUST show a second
link, `"Cambiar de usuario"`, in the same location as the unpair link. Tapping it
MUST return to `UserSelector` without deleting any vault record or altering
`$lock` for any profile. This link MUST NOT be shown when exactly one profile is
paired.

#### Scenario: switch link shown with two profiles
- GIVEN two profiles are paired and one is selected in `PinUnlockPanel`
- WHEN the panel renders
- THEN `"Cambiar de usuario"` is visible alongside the unpair link

#### Scenario: switch link hidden with a single profile
- GIVEN exactly one profile is paired
- WHEN `PinUnlockPanel` renders
- THEN `"Cambiar de usuario"` is not shown

#### Scenario: switching preserves both records
- GIVEN two profiles are paired, A currently selected
- WHEN the user taps `"Cambiar de usuario"`
- THEN the app returns to `UserSelector`, and neither A's nor B's vault record nor `$lock` state changed

### Requirement: REQ-AUTH-10 — Unpair is a local-access removal only, not a security action (D3, non-goals)

Unpairing MUST NOT perform any server-side revocation, session invalidation, or
PIN reset. Server-side access control remains exclusively governed by
`/empleadas` revocation (`profiles.activo`), and the existing DD-2
consecutive-failure wipe path MUST NOT be altered, reused, or bypassed by the
unpair flow.

#### Scenario: unpair does not touch server-side session validity
- GIVEN a profile is unpaired from this device
- WHEN the same account later signs in from another device or re-pairs this one
- THEN server-side `profiles.activo` and session validity are exactly as they were before the unpair — unaffected by the local deletion

#### Scenario: DD-2 wipe path is untouched
- GIVEN the existing 9-consecutive-failure wipe mechanism (DD-2, REQ-AUTH-2)
- WHEN a user reaches that threshold on a different, still-paired profile
- THEN the wipe behaves exactly as specified in REQ-AUTH-2, independent of any unpair-link code path

> **Verify status (2026-09-09): PASS WITH WARNINGS.** 0 CRITICAL, 3 WARNING, 2 SUGGESTION.
> All 14 requirement scenarios COMPLIANT (REQ-AUTH-5..10); all 9 design decisions (DD-1..DD-9) show no drift;
> all 9 tasks complete with manual on-device T-8 verified on 2026-09-09.
> See `openspec/changes/archive/2026-09-09-unpair-device/verify-report.md` for full details.
> Residual warnings (W-1, W-2) are architecture/inspection-based patterns, consistent with prior SDD cycles.
> W-3 (tasks.md frontmatter stale) is cosmetic only — no scope gap.
