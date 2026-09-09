---
change: unpair-device
phase: proposal
status: completed
depends_on: [auth-pin]
supersedes: ~
persistence: openspec
domain: auth
updated_at: 2026-09-09
---

# Proposal: unpair-device — unpair this phone / switch profile from the PIN screen

## Intent

The PIN screen has no user-initiated exit. A vault record (`src/lib/vault.ts`, IndexedDB, keyed by
`userId`) is deleted only by machinery: the 9th consecutive PIN failure (DD-2 wipe) or a server-rejected
refresh token. Consequences today:

- A shared store phone keeps showing a departed employee's profile forever.
- Someone who forgot their PIN must fail 9 times on purpose to reach the pairing screen.
- The re-pairing entry point (`+ vincular`) lives in `UserSelector`, which `PinScreen` skips entirely
  when exactly one profile is paired — the most common case on Angélica's phone.

This change gives the PIN screen a discoverable, local, non-destructive-to-the-account way out.

## Scope

### In scope

- A text link in `PinUnlockPanel` under the `<displayName> · <rol>` line:
  `"¿No eres tú? Desvincular este teléfono"`.
- Inline confirm state replacing that link on tap: `"Sí, desvincular"` + `"Cancelar"` (no modal).
- On confirm: `deleteRecord(userId)`, reset the lockout state for that profile, then navigate to `/pair`
  (no profiles left) or back to `UserSelector` (other profiles remain).
- A second, non-destructive link `"Cambiar de usuario"` in the same spot, shown only when 2+ profiles are
  paired on the device; returns to the selector without deleting anything.
- Component tests for both actions, the confirm/cancel states, and the two post-unpair destinations.

### Out of scope

- Server-side revocation or session invalidation — that stays with `/empleadas` (auth-pin D5/DD-6).
- Any change to the DD-2 failure/wipe path, `usePinUnlock`, or `PairDeviceScreen`.
- Bulk "unpair all profiles" / device management from the admin screen.
- Migrations, RPCs, Edge Function, or `database.types.ts` changes — there are none.
- PIN reset or PIN change flows.

## Capabilities

### New capabilities
- None.

### Modified capabilities
- `auth`: adds a user-initiated local unpair and profile-switch requirement to the PIN unlock surface;
  clarifies that unpairing is a local-access removal, not an account or session revocation.

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Affordance placement | **Text link under the `<displayName> · <rol>` line** in `PinUnlockPanel` | Padlock button in the empty pad cell left of `0`; leaving the exit only inside `UserSelector` |
| D2 | Confirmation pattern | **Inline two-button confirm** replacing the link: `"Sí, desvincular"` / `"Cancelar"` | Modal dialog; no confirmation + undo toast |
| D3 | Credential required | **None** — no PIN, no password, no network call | Require the PIN before unpairing; require re-authentication |
| D4 | Post-unpair destination | **`/pair` when no records remain; `UserSelector` when others remain** | Always `/pair`; stay on the panel with an empty profile |
| D5 | Profile switch | **Separate `"Cambiar de usuario"` link, only when 2+ profiles are paired**; non-destructive | Reuse the unpair flow with a "keep data" checkbox |
| D6 | Lockout state | **Reset `$lock` for that profile after `deleteRecord`** | Leave `$lock` as-is after unpairing |

### D1 — Link, not a pad button (MUST)
The empty cell left of `0` is fixed by the design handoff (screen 1 grid order). An open padlock icon there
reads as "unlock", the opposite of the action, and a destructive control at a 44 px target adjacent to
digit `0` invites mis-taps during daily PIN entry. Placing the exit only in `UserSelector` reproduces the
current gap: that component is not rendered when exactly one profile is paired.

### D2 — Confirmation is justified here (MUST)
The product principle prefers undo over confirm dialogs, but undo is impossible: re-pairing requires the
account email + password (DD-3), which an employee does not hold. A modal is heavier than the action
deserves on a phone-first screen, so the link mutates in place into two buttons.

### D3 — No credential, no network (MUST)
A forgotten PIN is a primary reason to unpair, so gating unpair behind the PIN would deadlock the exact
user who needs it. Unpairing removes local access only; server-side session validity keeps being governed
by `/empleadas` revocation and `profiles.activo`. Security posture is unchanged: the attacker gains
nothing by deleting a blob they cannot decrypt.

### D6 — Lockout must not leak (MUST)
`$lock` is global reactive state (`failCount`, `lockedUntil`, `requiresRelogin`). Without a reset, a
profile unpaired mid-cooldown would leave the next selected profile visibly locked.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/organisms/PinUnlockPanel.tsx` | Modified | Link, inline confirm state, new callback props + `canSwitchUser` flag. |
| `src/features/auth/PinScreen.tsx` | Modified | Unpair/switch handlers, `deleteRecord` + `$lock` reset, navigation. |
| `src/components/organisms/PinUnlockPanel.test.tsx` | New/Modified | States: idle link, confirm, cancel, switch link visibility. |
| `src/features/auth/PinScreen.test.tsx` | New/Modified | Record deletion, both destinations, lock reset. |
| `openspec/changes/unpair-device/` | New | SDD artifacts. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | Accidental unpair on a shared phone | Med | D2 inline confirm; small text link placed away from the pad. |
| R2 | The only admin profile is unpaired and the account password is unknown → cannot re-pair | Low | OQ-1: consider a one-line consequence note in the confirm state; unaffected data lives server-side. |
| R3 | Net-new UI element without a handoff mock | Med | Derive styling from the Terraza palette and existing `UserSelector`/link treatments. |
| R4 | Stale `$lock` or stale `records` after deletion causes a broken empty panel | Low | D4 + D6; tests cover both destinations and the reset. |
| R5 | Scope creeps into PIN reset / device management | Med | Explicit out-of-scope list. |

## Open Questions

- **OQ-1**: Should the confirm state show a one-line consequence note (for example
  `"Necesitarás el correo y la contraseña para volver a vincular."`)? Approved copy did not include it;
  resolve in `specs` or `design`.
- **OQ-2**: When other profiles remain, should the unpaired profile's row disappear immediately from the
  selector without an IDB re-read (optimistic) or after re-running `listRecords()`? Resolve in `design`.

## Rollback Plan

Revert the PR. No migrations, no server state, no persisted schema change: `PinUnlockPanel` returns to a
display-only panel. Vault records already deleted by users stay deleted — re-pairing via `/pair` is the
existing recovery path, identical to the DD-2 wipe outcome.

## Dependencies

- `auth-pin` (archived 2026-07-15, LIVE) — `src/lib/vault.ts` (`deleteRecord`, `listRecords`),
  `src/stores/lock.ts`, `src/features/auth/{PinScreen,usePinUnlock,pinUnlock}.ts(x)`, `/pair` route,
  DD-2 (wipe), DD-3 (pairing), DD-10 (atomic decomposition).
- `setup-stack` (archived, LIVE) — React Router v7 routes and the Terraza design tokens.

## Success Criteria

- [ ] With exactly one profile paired, the PIN screen shows a discoverable way to unpair the device.
- [ ] Confirming deletes only that profile's vault record and lands on `/pair` (none left) or the selector
      (others remain).
- [ ] Cancelling restores the link and changes nothing.
- [ ] With 2+ profiles paired, `"Cambiar de usuario"` returns to the selector without deleting anything.
- [ ] Unpair performs zero network requests and requires no PIN.
- [ ] CI green: lint, format:check, typecheck, test, build.
- [ ] Change documented and archived in `openspec/`.
