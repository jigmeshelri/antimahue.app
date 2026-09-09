---
change: unpair-device
phase: apply
status: in_progress
session_count: 1
tasks_done: "8/9"
updated_at: 2026-09-09
---

# Apply progress: unpair-device

## Tasks completed (T-1 → T-7, T-9)

Strict RED → GREEN TDD, one task pair at a time, gates run at the end (T-7).

| Task | What | Evidence |
|------|------|----------|
| T-1 | RED — `resetLock()` coverage added to `src/stores/lock.test.ts` (neutral reset + clearing an active cooldown) | 2 new tests failed with `resetLock is not a function` before T-2 |
| T-2 | GREEN — exported `NEUTRAL_LOCK` and `resetLock()` from `src/stores/lock.ts`; `$lock` now seeded from `NEUTRAL_LOCK` | `pnpm vitest run src/stores/lock.test.ts` → 13/13 passed |
| T-3 | RED — `src/components/organisms/PinUnlockPanel.test.tsx` created (12 tests: link visibility, confirm/cancel states, focus management, `aria-describedby`, `onUnpair`/`onSwitchUser` calls, `filledCount === 4` disabling) | 11/12 failed before T-4 (only the "hidden with no user" case passed trivially) |
| T-4 | GREEN — `PinUnlockPanel.tsx`: `onUnpair`/`onSwitchUser` props, `unpairState` machine, action row (idle link / switch link / confirm+cancel), `aria-describedby` note, DD-7 focus management, DD-6 disabling at `filledCount === 4`, `mb-[38px]` moved off the subtitle onto the (always-present) action-row slot | `pnpm vitest run` on the panel file → 12/12 passed |
| T-5 | RED — `src/features/auth/PinScreen.test.tsx` created (4 integration tests: 1→`/pair`, 2→auto-select remaining, 3→selector, switch-without-delete), mocking `./usePinUnlock` and `@/lib/vault` | 4/4 failed before T-6 (`onUnpair is not a function` — prop not wired yet) |
| T-6 | GREEN — `PinScreen.tsx`: `autoSelectedUserId()` helper reused by the mount effect and `handleUnpair`, `handleUnpair(userId)` (`deleteRecord` → `resetLock` → re-read `listRecords` → route per DD-5), `handleSwitchUser` (`setSelectedUserId(null)`), both wired into `PinUnlockPanel`; panel keyed by `selectedUser.userId` so its internal `unpairState` never leaks across a profile swap (auto-select or manual switch) without a real remount | 4/4 passed |
| T-7 | Full gate | `pnpm lint` clean · `pnpm format:check` clean · `pnpm typecheck` clean · `pnpm test` → 291 passed / 7 skipped (baseline 273 + 18 new) · `pnpm build` succeeded (PWA generated) |
| T-9 | Bookkeeping | `tasks.md` T-1..T-7,T-9 marked `[x]`, `progress: 8/9`; `state.yaml` → `status: apply`, `phase_states.apply: in_progress` (T-8 still pending) |

## T-8 — deferred to verify (not apply-owned)

Manual on-device check, per the orchestrator's scope: leave unchecked. Focus areas for whoever
runs it:
- Single paired profile → tap unpair → confirm → lands on `/pair`.
- Two paired profiles → unpair one → auto-selects the remaining profile's PIN screen directly
  (NOT the selector — confirmed by design.md DD-5, differs from tasks.md's looser "selector with
  remaining profile" wording).
- Three paired profiles → unpair one → `UserSelector` shows the other two.
- Cancel at the inline confirm → link reappears, focus returns to it, nothing is deleted.
- "Cambiar de usuario" → returns to the selector, deletes nothing, `$lock` untouched.
- Real focus-visible outline behavior on a touch device (jsdom doesn't render CSS/paint) and real
  44px tap-target feel for the action-row buttons.

## Deviations from design.md (both intentional, documented in code comments)

1. **`PinUnlockPanel` keyed by `selectedUser.userId` in `PinScreen`.** Not spelled out in
   design.md's interfaces section, but required for correctness: without a key, React reuses the
   same component instance across a profile swap (post-unpair auto-select, or a manual switch
   followed by reselecting), and the panel's local `unpairState` (`'submitting'` after a just-
   confirmed unpair) would otherwise leak into the next profile's screen instead of resetting to
   `'idle'`. This is a `PinScreen`-only implementation detail; the `PinUnlockPanelProps` contract
   is unchanged.
2. **Action-row wrapper `div` always renders** (with `mb-[38px] min-h-[44px]`) even when
   `selectedUser` is `null`, instead of being conditionally omitted. This keeps the pad's vertical
   rhythm stable in the (currently unreachable in normal `PinScreen` usage) edge case the panel's
   own prop contract still allows, matching the design's "pad's vertical rhythm is preserved"
   intent more literally than a conditionally-mounted wrapper would.

No REQ-AUTH-5..10 scenario was skipped; no changes to `pinUnlock.ts`'s DD-2 wipe path, no network
calls added, no migrations.

## REQ → test mapping

| Requirement | Test(s) |
|---|---|
| REQ-AUTH-5 (link discoverable) | `PinUnlockPanel.test.tsx`: `should_show_the_unpair_link_when_a_profile_is_selected` |
| REQ-AUTH-6 (inline confirm, no credential) | `PinUnlockPanel.test.tsx`: `should_show_the_consequence_note_and_confirm_buttons_after_tapping_the_link`, `should_restore_the_link_and_change_nothing_on_cancel` |
| REQ-AUTH-7 (confirmed unpair deletes + resets lock, zero network) | `PinScreen.test.tsx`: `should_navigate_to_pair_when_the_last_profile_is_unpaired` (asserts `deleteRecord` call + `$lock` reset to `NEUTRAL_LOCK`) |
| REQ-AUTH-8 (post-unpair destination from a fresh read) | `PinScreen.test.tsx`: all three unpair-destination tests (1/2/3 profiles) |
| REQ-AUTH-9 (switch link, 2+ only) | `PinUnlockPanel.test.tsx`: `should_show_the_switch_link_only_when_onSwitchUser_is_provided`, `should_call_onSwitchUser_when_the_switch_link_is_tapped`; `PinScreen.test.tsx`: `should_return_to_the_selector_without_deleting_when_switch_is_tapped`, `should_auto_select_the_remaining_profile_after_unpairing_one_of_two` (asserts switch link absent with 1 remaining) |
| REQ-AUTH-10 (local-only, DD-2 untouched) | Not independently tested (no server/network mocks are ever exercised by the new code path — `pinUnlock.ts` is untouched and not imported by the new tests) |
