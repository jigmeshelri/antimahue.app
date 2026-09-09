---
change: unpair-device
phase: verify
status: completed
depends_on: [proposal, specs, design, tasks, apply]
persistence: openspec
domain: auth
updated_at: 2026-09-09
verdict: "PASS WITH WARNINGS"
critical_count: 0
warning_count: 3
suggestion_count: 2
---

# Verification Report — unpair-device

## Change

**unpair-device** — user-initiated, local-only unpair and profile-switch affordance on the PIN
screen (`PinUnlockPanel`/`PinScreen`), closing the gap where the only exit from a paired profile
was the machinery-triggered DD-2 nine-failure wipe. Merged to `main` via PR #53 (planning + 4 code
commits), `size:exception` accepted (492 changed lines vs. the 400-line budget — 302 of them
tests). Code already on `main` @ `78bcf66`; this report verifies the merged state.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 9 |
| Tasks complete | 9 |
| Tasks incomplete | 0 |

All tasks in `tasks.md` (T-1..T-9) are marked `[x]`, including T-8 (manual on-device check),
appended with maintainer sign-off evidence dated 2026-09-09: single-profile unpair on Android
against production → `/pair`; `Cancelar` restores the link without deleting.

**Documentation drift (W-3, non-blocking)**: `tasks.md`'s YAML frontmatter still reads
`status: ready` / `progress: "8/9"`, stale relative to the table body where all 9 tasks are
`[x]`. Cosmetic only — does not reflect a missing task.

## Build & Tests Execution

**Lint**: ✅ Passed
```
$ pnpm lint
$ eslint .
```

**Format check**: ✅ Passed
```
$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

**Type check**: ✅ Passed
```
$ pnpm typecheck
$ tsc -p tsconfig.app.json --noEmit
```

**Tests**: ✅ 385 passed / ❌ 0 failed / ⚠️ 7 skipped
```
$ pnpm test
$ vitest run
 Test Files  47 passed | 1 skipped (48)
      Tests  385 passed | 7 skipped (392)
```
Matches the expected baseline (previous suite + 18 new tests for this change: 13 in
`lock.test.ts`, 12 in `PinUnlockPanel.test.tsx`, 4 in `PinScreen.test.tsx` — some overlap with
pre-existing cases in each file). The 7 skipped tests remain the RLS multi-role battery
(`RUN_LOCAL_RLS_BATTERY=1` gate), unrelated to this change.

**Build**: ✅ Passed
```
$ pnpm build
$ tsc -p tsconfig.app.json && vite build
✓ built in 7.34s
PWA v0.21.2 — 37 entries precached
```
Same pre-existing non-blocking warning as prior changes: the `index` chunk is ~509 kB after
minification (Vite's 500 kB default warning threshold). Pre-existing application-level bundling
behavior, unrelated to this change.

**Coverage**: ➖ Not configured (no `coverage_threshold` in `openspec/config.yaml`).

## DD-2 wipe path integrity check

`git log --oneline -3 -- src/features/auth/pinUnlock.ts` shows only two commits, both from
`auth-pin` (`268ec9e` Phase 4, `2c38a42` Phase 8) — zero commits from `unpair-device`. The file
is byte-untouched by this change, confirming the proposal's explicit non-goal ("Any change to the
DD-2 failure/wipe path, `usePinUnlock`, or `PairDeviceScreen`" is out of scope) held in practice.
`deleteRecord`/`listRecords` in `src/lib/vault.ts` are pure IndexedDB (`withDb`/`runInTransaction`)
— no `fetch`/Supabase call in either function, confirming REQ-AUTH-7's zero-network requirement
by direct code inspection.

## Spec Compliance Matrix

| Requirement | Scenario | Test / Evidence | Result |
|---|---|---|---|
| REQ-AUTH-5 — link discoverable | visible with a single paired profile | `PinUnlockPanel.test.tsx > should_show_the_unpair_link_when_a_profile_is_selected` | ✅ COMPLIANT |
| REQ-AUTH-5 | visible after choosing from the selector | `PinScreen.test.tsx > should_auto_select_the_remaining_profile_after_unpairing_one_of_two` (selects Angélica from a 2-profile selector, then finds the unpair link) | ✅ COMPLIANT |
| REQ-AUTH-6 — inline confirm, no credential | tapping the link shows the inline confirm | `PinUnlockPanel.test.tsx > should_show_the_consequence_note_and_confirm_buttons_after_tapping_the_link` | ✅ COMPLIANT |
| REQ-AUTH-6 | cancel restores the link, changes nothing | `PinUnlockPanel.test.tsx > should_restore_the_link_and_change_nothing_on_cancel` | ✅ COMPLIANT |
| REQ-AUTH-7 — confirmed unpair deletes + resets lock, zero network | confirm deletes the record, no network | `PinScreen.test.tsx > should_navigate_to_pair_when_the_last_profile_is_unpaired` (asserts `deleteRecord('a')`) + code inspection (`vault.ts` pure IDB) | ✅ COMPLIANT |
| REQ-AUTH-7 | lockout state does not leak | same test: `$lock` pre-set to a locked state, asserted `toEqual(NEUTRAL_LOCK)` after unpair | ✅ COMPLIANT |
| REQ-AUTH-8 — post-unpair destination from fresh read | 0 remaining → `/pair` | `PinScreen.test.tsx > should_navigate_to_pair_when_the_last_profile_is_unpaired` | ✅ COMPLIANT |
| REQ-AUTH-8 | 1 remaining → auto-select | `PinScreen.test.tsx > should_auto_select_the_remaining_profile_after_unpairing_one_of_two` | ✅ COMPLIANT |
| REQ-AUTH-8 | 2+ remaining → selector | `PinScreen.test.tsx > should_show_the_selector_after_unpairing_one_of_three_profiles` | ✅ COMPLIANT |
| REQ-AUTH-9 — non-destructive switch, 2+ only | switch link shown with two profiles | `PinUnlockPanel.test.tsx > should_show_the_switch_link_only_when_onSwitchUser_is_provided` | ✅ COMPLIANT |
| REQ-AUTH-9 | switch link hidden with a single profile | `PinScreen.test.tsx > should_auto_select_the_remaining_profile_after_unpairing_one_of_two` (asserts switch link absent with 1 remaining) + `PinScreen.tsx`'s `onSwitchUser={records.length >= 2 ? handleSwitchUser : null}` | ✅ COMPLIANT |
| REQ-AUTH-9 | switching preserves both records ($lock unchanged) | `PinScreen.test.tsx > should_return_to_the_selector_without_deleting_when_switch_is_tapped` asserts `deleteRecord` not called; **`$lock`-unchanged half of the scenario is not independently asserted** — verified only by code inspection (`handleSwitchUser` is `setSelectedUserId(null)` only, no vault/lock call) | ⚠️ COMPLIANT (W-1) |
| REQ-AUTH-10 — local-access removal only, not a security action | unpair does not touch server-side session validity | Architectural: `deleteRecord`/`resetLock` touch only IndexedDB/nanostores, no Supabase call anywhere in the diff | ⚠️ COMPLIANT (W-2, architecture-only, no dedicated test — same evidentiary pattern as REQ-AUTH-1's residual W-1 in the `auth-pin` verify report) |
| REQ-AUTH-10 | DD-2 wipe path is untouched | `git log` confirms zero commits from this change touch `pinUnlock.ts` (see above) | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios COMPLIANT (12 fully test-backed, 2 architecture/code-inspection-backed per W-1/W-2 below).

## Design Decision Drift Check (DD-1..DD-9)

| DD | Decision | Code state | Result |
|----|----------|-------------|--------|
| DD-1 | Action row in `PinUnlockPanel`; confirm is local component state | `unpairState` is `useState` inside `PinUnlockPanel`; `PinScreen` stays effect-only | ✅ No drift |
| DD-2 (design) | Switch-link visibility driven by `onSwitchUser: (() => void) \| null`, not a separate count prop | `PinUnlockPanel` renders the switch link only when `onSwitchUser` is truthy; `PinScreen` computes it inline from `records.length >= 2` | ✅ No drift |
| DD-3 | `NEUTRAL_LOCK` + `resetLock()` exported from `lock.ts`; `pinUnlock.ts`'s own constant untouched | Confirmed in `lock.ts`; `pinUnlock.ts` byte-untouched (git log above) | ✅ No drift |
| DD-4 | Re-read `listRecords()` after `deleteRecord`, no optimistic filter | `handleUnpair` calls `deleteRecord` → `resetLock` → `await listRecords()` and derives state from the fresh array | ✅ No drift |
| DD-5 | Post-delete selection reuses the mount rule (0→`/pair`, 1→auto-select, 2+→selector) | `autoSelectedUserId()` helper shared between the mount effect and `handleUnpair` | ✅ No drift |
| DD-6 | Confirm/link disabled while `filledCount === 4` | `pinAttemptInFlight = filledCount === 4`; both links and the confirm button carry `disabled={pinAttemptInFlight}` (confirm also ORs `submitting`) | ✅ No drift — tested (`should_disable_the_unpair_and_switch_links_while_a_pin_attempt_is_in_flight`, `should_disable_the_confirm_button_while_a_pin_attempt_is_in_flight`) |
| DD-7 | Focus → `Cancelar` on confirm entry; focus → link on cancel; note is `aria-describedby` | `useEffect` on `unpairState` moves focus via refs, skipped on first mount; `noteId` wired to the confirm group's `aria-describedby` | ✅ No drift — tested (3 dedicated tests) |
| DD-8 | Consequence note exact copy | `"Necesitarás el correo y la contraseña para volver a vincular."` matches the delta spec's REQ-AUTH-6 copy verbatim | ✅ No drift |
| DD-9 | Both links hidden when `selectedUser === null` | `{selectedUser && unpairState === 'idle' && (...)}` gates the whole idle block | ✅ No drift — tested (`should_hide_both_links_when_no_profile_is_selected`) |

## Documented Deviations from design.md (apply-progress.md, both reviewed, both benign)

1. **`PinUnlockPanel` keyed by `selectedUser.userId` in `PinScreen`.** Not in design.md's
   interfaces section, but necessary: without a `key`, React reuses the panel instance across a
   profile swap and its local `unpairState` would leak `'submitting'` into the next profile's
   screen. `PinUnlockPanelProps` contract is unchanged; this is a `PinScreen`-only detail.
   Verified correct by reading `PinScreen.tsx` line 101 (`key={selectedUser ? selectedUser.userId : 'no-user'}`).
2. **Action-row wrapper `div` always renders**, even when `selectedUser` is `null`, instead of
   being conditionally omitted. Keeps the pad's vertical rhythm stable; the two links themselves
   remain correctly gated by DD-9 inside that wrapper. No spec or DD violation — the wrapper is
   presentational scaffolding, not the link itself.
3. **tasks.md T-5 wording vs. DD-5** (orchestrator-flagged, confirmed): tasks.md's looser
   "2 profiles → confirm → selector with remaining profile" wording undersells the actual DD-5
   rule (1 remaining → auto-select, not the selector). The *implementation* follows DD-5 correctly
   (`autoSelectedUserId`, tested); only the task's prose description in `tasks.md` is imprecise —
   no code drift.

## Security

| Check | Status | Notes |
|-------|--------|-------|
| Zero network in the unpair/switch path | ✅ | `deleteRecord`, `listRecords`, `resetLock` are pure IndexedDB/nanostores; no `fetch`/Supabase call added anywhere in the diff. |
| No PIN/credential required to unpair | ✅ | `handleUnpair`/`handleConfirm` take no PIN input; `usePinUnlock` is untouched and not called from the unpair path. |
| DD-2 wipe path isolation | ✅ | `pinUnlock.ts` byte-untouched (git log confirmed); the resurrection race window (`filledCount === 4`) is explicitly guarded by DD-6, tested. |
| Server-side revocation surface unchanged | ✅ | No migrations, RPCs, or Edge Function changes in the diff; `/empleadas` (auth-pin D5/DD-6) remains the sole revocation path. |

## Rollback

All changes are client-side (`lock.ts`, `PinUnlockPanel.tsx`, `PinScreen.tsx`) plus their tests.
No migrations, no server state. Reverting PR #53 restores the display-only panel; any vault
records already deleted by users through this feature stay deleted — re-pairing via `/pair` is
the existing recovery path, identical to the pre-existing DD-2 wipe outcome (per the proposal's
Rollback Plan).

## Findings by Severity

**CRITICAL (0)** — none found. All five gates green, all 9 tasks complete, no drift in any of the
9 design decisions, DD-2 path confirmed untouched, T-8 manual sign-off recorded.

**WARNING (3)**
- **W-1**: REQ-AUTH-9's "switching preserves both records" scenario has its `deleteRecord`-not-
  called half tested, but the `$lock`-unchanged half is not independently asserted by a test —
  only verified by reading `handleSwitchUser`'s single-line body. Low risk (the function has no
  side effects to break), but a one-line assertion (`expect($lock.get()).toEqual(NEUTRAL_LOCK)` or
  the pre-switch value) in `should_return_to_the_selector_without_deleting_when_switch_is_tapped`
  would close this gap cheaply.
- **W-2**: REQ-AUTH-10 ("local-access removal only") has no dedicated test exercising a mocked
  network layer to prove zero calls; it rests on architecture and direct code inspection only.
  This mirrors the already-accepted evidentiary pattern for REQ-AUTH-1's residual W-1 in the
  `auth-pin` verify report — non-blocking there, non-blocking here for the same reason (no code
  path exists that could make a network call; nothing to assert against).
- **W-3**: `tasks.md` frontmatter (`status: ready`, `progress: "8/9"`) is stale — every task row
  including T-8 is `[x]`. Cosmetic; does not affect delivered scope. Should be corrected to
  `status: completed` / `progress: "9/9"` before or during archive.

**SUGGESTION (2)**
- **S-1**: PR #53's size-exception note ("492 lines... 302 son tests") is a rough split; recomputing
  from `gh pr view`'s per-file additions/deletions gives ~486 total code-diff lines (excluding
  `openspec/` docs) with ~322 in test files — close enough to not warrant correction, but a future
  size-exception note could cite the exact `git diff --stat` numbers instead of a rounded estimate.
- **S-2**: The two documented apply-time deviations (panel `key` prop, always-rendered action-row
  wrapper) are sound engineering calls but were not folded back into `design.md`'s own interfaces/
  visual-contract sections. Since `design.md` is frozen at archive time, a one-line addendum there
  (or leaving it as-is, since apply-progress.md already documents both) is a documentation-polish
  item only, not a blocker.

## Verdict

**PASS WITH WARNINGS** — 0 CRITICAL, 3 WARNING, 2 SUGGESTION. All spec requirements
(REQ-AUTH-5..10, 14 scenarios) are COMPLIANT; all 9 design decisions (DD-1..DD-9) show no drift;
all 9 tasks are complete with T-8's manual on-device evidence recorded; all five gates
(lint/format/typecheck/test/build) are green on `main` @ `78bcf66`. Recommended for archive.
