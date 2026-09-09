---
change: unpair-device
phase: archive
status: completed
depends_on: [auth-pin]
supersedes: ~
persistence: openspec
archived_at: 2026-09-09
---

# Archive Report — unpair-device

## Change

**unpair-device** — user-initiated, local-only unpair and profile-switch affordance on the PIN screen (`PinUnlockPanel`/`PinScreen`). Closes the gap where the only exit from a paired profile was the machinery-triggered DD-2 nine-failure wipe. Merged to `main` as PR #53 (2026-09-09). Verify verdict: **PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 2 SUGGESTION).

## Verification Status

Verified on 2026-09-09 with verdict **PASS WITH WARNINGS**.
All five project gates were green: lint, format:check, typecheck, test (385 passed / 7 skipped), build.
Manual on-device verification (T-8) completed by the maintainer on 2026-09-09 (Android, production).
See `verify-report.md` in this archive for full details.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| auth | Updated | `openspec/specs/auth/spec.md` appended with REQ-AUTH-5..10 (6 requirements, 14 scenarios); REQ-AUTH-1..4 preserved intact. |

## Archive Contents

- `proposal.md` ✅
- `specs/auth/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (9/9 tasks complete)
- `apply-progress.md` ✅
- `verify-report.md` ✅
- `state.yaml` ✅
- `archive-report.md` ✅

## Source of Truth Updated

The consolidated specification now lives at:

- `openspec/specs/auth/spec.md` (REQ-AUTH-1..10, 10 total requirements)

## Verification Facts (Final-State Authority Ranking)

1. **Merged to main**: PR #53 on 2026-09-09 @ commit `78bcf66`.
2. **Test counts**: 385 passed / 7 skipped (7 skipped are pre-existing RLS multi-role battery).
3. **Manual verification (T-8)**: Completed 2026-09-09 — single-profile unpair → `/pair`; `Cancelar` restores link without deletion.
4. **Spec compliance**: 14/14 scenarios COMPLIANT (12 fully test-backed, 2 architecture/code-inspection-backed per W-1/W-2).
5. **Design decisions**: 9/9 (DD-1..DD-9) show no drift vs. design.md.

## Findings Summary

**CRITICAL (0)** — none.

**WARNING (3)**
- **W-1**: REQ-AUTH-9 `$lock`-unchanged scenario verified by code inspection only, not by independent test assertion.
- **W-2**: REQ-AUTH-10 ("local-access removal only") rests on architecture and code inspection (no dedicated network-mock test).
- **W-3**: `tasks.md` frontmatter (`status: ready`, `progress: "8/9"`) is stale; task rows show 9/9 complete (cosmetic, no scope gap).

**SUGGESTION (2)**
- **S-1**: PR #53 size-exception note could cite exact `git diff --stat` numbers vs. rough estimate.
- **S-2**: Apply-time deviations (panel `key` prop, always-rendered action-row wrapper) not folded into `design.md` (documentation polish only).

## Active Changes Updated

`unpair-device` was removed from `openspec/project.yaml` `active_changes`.
Remaining active change: `color-palette-assistant`.

## SDD Cycle Complete

The change has been fully planned (proposal), specified (6 requirements with 14 scenarios), designed (9 design decisions), tasked (9 tasks), implemented and applied (merged to main, 78bcf66), verified (PASS WITH WARNINGS, all gates green, manual T-8 complete), and archived.

Ready for the next change.
