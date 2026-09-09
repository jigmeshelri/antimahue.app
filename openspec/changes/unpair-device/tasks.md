---
change: unpair-device
phase: tasks
status: ready
depends_on: [proposal, specs, design]
persistence: openspec
sequencing_source: "design.md §4 data flow, §6 testing strategy"
session_count: 1
task_count: 9
progress: "0/9"
updated_at: 2026-09-09
---

# Tasks: unpair-device — local unpair / profile switch from the PIN screen

Small, single-session change on the existing PIN-screen container/presentational split. No new module.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–430 (prod ~170: lock.ts ~15, PinUnlockPanel.tsx ~85, PinScreen.tsx ~35 / tests ~210–260: lock.test.ts ~15, PinUnlockPanel.test.tsx ~130, PinScreen.test.tsx ~150) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR — panel props, container handlers, and their tests are tightly coupled; splitting would leave intermediate PRs with a broken contract |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

If the measured diff clears 400 lines, request `size:exception` rather than fragmenting — do not chain this change.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Local unpair + profile switch from the PIN screen (REQ-AUTH-5..10) | PR 1 (single) | `pnpm vitest run src/stores/lock.test.ts src/components/organisms/PinUnlockPanel.test.tsx src/features/auth/PinScreen.test.tsx` | Manual phone check (T-8): single-profile unpair → `/pair`; two-profile unpair → selector; cancel; switch link | Revert the PR — no migration, no server state (proposal Rollback Plan) |

## Session 1 — Foundation → Panel → Container (TDD)

| ID | Task | Files | Refs | Verification | Status |
|----|------|-------|------|---------------|--------|
| T-1 | RED: extend lock store tests — `resetLock()` clears `failCount`/`lockedUntil`/`requiresRelogin` back to neutral | `src/stores/lock.test.ts` | REQ-AUTH-7, DD-3, DD-6 | test fails (`resetLock` undefined) | [ ] |
| T-2 | GREEN: export `NEUTRAL_LOCK` const and `resetLock()` (`$lock.set(NEUTRAL_LOCK)`); seed `$lock` from `NEUTRAL_LOCK` | `src/stores/lock.ts` | REQ-AUTH-7, DD-3 | T-1 passes | [ ] |
| T-3 | RED: new panel tests — idle link per profile; tap shows note+buttons; cancel restores link and refocuses it; confirm calls `onUnpair` once; switch link only when `onSwitchUser` non-null; both links hidden when `selectedUser` is null; buttons disabled at `filledCount === 4` | `src/components/organisms/PinUnlockPanel.test.tsx` | REQ-AUTH-5,6,9,10; DD-1,2,6,7,8,9 | tests fail (props/markup missing) | [ ] |
| T-4 | GREEN: add `onUnpair`/`onSwitchUser` props, `unpairState` machine (`'idle'\|'confirming'\|'submitting'`), action row under the name/role line, consequence note (`aria-describedby`), `Sí, desvincular`/`Cancelar` buttons, focus → Cancelar on confirm / → link on cancel, disable both links while `filledCount === 4`, move `mb-[38px]` to the action row | `src/components/organisms/PinUnlockPanel.tsx` | REQ-AUTH-5,6,9,10; DD-1,2,6,7,8,9 | T-3 passes | [ ] |
| T-5 | RED: new container tests — mock `./usePinUnlock` and `@/lib/vault`; 1 profile → confirm → `deleteRecord`+`resetLock`+`/pair`; 2 profiles → confirm → selector with remaining profile; 3 profiles → confirm → selector; switch link → selector, no `deleteRecord` | `src/features/auth/PinScreen.test.tsx` | REQ-AUTH-7,8,9,10; DD-3,4,5 | tests fail (handlers missing) | [ ] |
| T-6 | GREEN: add `autoSelectedUserId()` helper (shared with the mount effect), `handleUnpair(userId)` (`deleteRecord` → `resetLock` → re-run `listRecords` → route by DD-5 rule), `handleSwitchUser` (`setSelectedUserId(null)`), wire both into `PinUnlockPanel` | `src/features/auth/PinScreen.tsx` | REQ-AUTH-7,8,9,10; DD-3,4,5 | T-5 passes | [ ] |
| T-7 | Gate: lint + format:check + typecheck + test + build | — | — | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` green | [ ] |
| T-8 | Manual on-device check (user/orchestrator-owned, real phone): single profile → unpair → `/pair`; two profiles → unpair one → selector; cancel leaves link, deletes nothing; switch link → selector, deletes nothing | — | REQ-AUTH-5..10 | manual sign-off before merge | [ ] |
| T-9 | openspec bookkeeping: `state.yaml` → `phase_states.apply: completed`, `status: apply`, `updated_at` | `openspec/changes/unpair-device/state.yaml` | — | fields updated | [ ] |

**Commit suggestion (one PR, atomic commits):**
1. `test(auth): add resetLock coverage to lock store` + `feat(auth): export NEUTRAL_LOCK and resetLock`
2. `test(auth): add PinUnlockPanel unpair/switch coverage` + `feat(auth): add unpair and switch-user affordances to PinUnlockPanel`
3. `test(auth): add PinScreen unpair/switch integration coverage` + `feat(auth): wire unpair and switch handlers into PinScreen`
