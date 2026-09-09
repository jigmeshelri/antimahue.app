# Auth (PIN unlock / session) — Delta Spec: unpair-device

Delta over `openspec/specs/auth/spec.md`. Adds a user-initiated, local-only way to
leave a paired profile from the PIN screen (unpair) and a non-destructive way to
switch between already-paired profiles, closing the gap where the only exit was
the machinery-triggered DD-2 wipe. ID prefix continues `REQ-AUTH` from REQ-AUTH-5.

## ADDED Requirements

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
