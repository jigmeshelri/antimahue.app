---
change: unpair-device
phase: design
status: completed
depends_on: [auth-pin]
supersedes: ~
persistence: openspec
domain: auth
updated_at: 2026-09-09
resolves_open_questions: [OQ-1, OQ-2]
design_decisions: [DD-1, DD-2, DD-3, DD-4, DD-5, DD-6, DD-7, DD-8, DD-9]
---

# Design: unpair-device — local unpair / profile switch from the PIN screen

## 1. Technical approach

Pure client change on the existing container/presentational split, no new module: `PinUnlockPanel`
(organism) gains one action row and an internal confirm state machine; `PinScreen` (container) keeps
sole ownership of IndexedDB (`@/lib/vault`), the `$lock` nanostore and React Router navigation.
`src/stores/lock.ts` gains one exported reset helper. Zero network, zero PIN, zero server state; the
DD-2 failure/wipe path in `pinUnlock.ts` and `usePinUnlock.ts` is untouched.

## 2. Design decisions

| ID | Resolves | Decision | Rejected |
|----|----------|----------|----------|
| DD-1 | D1, D2 | Action row lives in `PinUnlockPanel`; confirm is **local component state**, container stays effect-only | Lifting `confirming` into `PinScreen`; a new `UnpairAction` molecule |
| DD-2 | D5 | Visibility of the switch link is driven by **`onSwitchUser: (() => void) \| null`** | A separate `pairedCount: number` prop that can disagree with the callback |
| DD-3 | D6 | Export **`NEUTRAL_LOCK` + `resetLock()`** from `src/stores/lock.ts`; `PinScreen` calls it after `deleteRecord` | Inline `$lock.set({...})` in the container; refactoring `pinUnlock.ts`'s private constant (would touch the DD-2 path) |
| DD-4 | OQ-2 | **Re-read `listRecords()`** after `deleteRecord` and derive state from the fresh result | Optimistic local filter of `records` |
| DD-5 | D4, R4 | Post-delete selection reuses the **mount rule**: 0 records → `/pair`; exactly 1 → auto-select it; 2+ → selector | Always routing to `/pair`; always showing the selector (renders an empty panel when 1 remains) |
| DD-6 | R1 | Panel state machine `'idle' \| 'confirming' \| 'submitting'`; confirm and link are disabled while a PIN attempt is in flight (`filledCount === 4`) | Boolean `confirming`; adding a `busy` flag to `usePinUnlock` (out of scope) |
| DD-7 | a11y | On enter-confirm focus moves to **`Cancelar`**; on cancel focus returns to the link; the note is the group's `aria-describedby` | No focus management (focus falls to `<body>`); autofocusing the destructive button |
| DD-8 | OQ-1, R3 | Confirm shows the one-line note `Necesitarás el correo y la contraseña para volver a vincular.` | Confirm with buttons only |
| DD-9 | R4 | Both links are hidden when `selectedUser === null` | Rendering a link that unpairs nothing |

### DD-4 — why re-read instead of optimistic

IndexedDB is the source of truth for pairing (DD-1/DD-3 of `auth-pin`); another tab may have paired or
wiped a profile meanwhile. `listRecords()` is the same single fast round-trip already run at mount, on a
rare user action, and reusing it means one selection rule instead of two divergent ones.

### DD-6 — the resurrection race is real

On a wrong PIN, `attemptUnlock` writes `putRecord({ ...record, failCount })` **after** an await. A
`deleteRecord` landing in that window would be undone by that write, resurrecting the profile. The
attempt window is exactly `filledCount === 4`, already a panel prop, so the guard needs no hook change.

## 3. Data flow

```
tap "¿No eres tú? Desvincular este teléfono"
  └─ panel: unpairState 'idle' → 'confirming'   (note + Sí/Cancelar, focus → Cancelar)
       ├─ "Cancelar" → 'idle' (focus → link, nothing else happens)
       └─ "Sí, desvincular" → 'submitting' → onUnpair()
            └─ PinScreen.handleUnpair(userId)
                 deleteRecord(userId) → resetLock() → listRecords()
                   ├─ []        → navigate('/pair', { replace: true })
                   ├─ [one]     → setRecords([one]); setSelectedUserId(one.userId)   → panel
                   └─ [2+]      → setRecords(next);  setSelectedUserId(null)         → UserSelector

tap "Cambiar de usuario" → onSwitchUser() → setSelectedUserId(null) → UserSelector
  (no delete, no lock reset — usePinUnlock re-syncs $lock from the vault on the next selection)
```

## 4. File changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/organisms/PinUnlockPanel.tsx` | Modify | Action row, `unpairState` machine, note, focus handling, two new props |
| `src/features/auth/PinScreen.tsx` | Modify | `handleUnpair` / `handleSwitchUser`, `autoSelectedUserId` helper shared with the mount effect |
| `src/stores/lock.ts` | Modify | Export `NEUTRAL_LOCK` and `resetLock()` |
| `src/components/organisms/PinUnlockPanel.test.tsx` | Create | Presentational states and callbacks |
| `src/features/auth/PinScreen.test.tsx` | Create | Container: delete, lock reset, both destinations |
| `src/stores/lock.test.ts` | Modify | `resetLock()` clears a locked state |

## 5. Interfaces / contracts

```ts
// src/components/organisms/PinUnlockPanel.tsx
interface PinUnlockPanelProps {
  selectedUser: VaultRecord | null
  filledCount: number
  errorMessage: string | null
  onDigit: (digit: string) => void
  onBackspace: () => void
  /** Confirmed local unpair of `selectedUser`. The container owns vault + routing. */
  onUnpair: () => void
  /** Back to the picker. `null` when fewer than 2 profiles are paired (hides the link). */
  onSwitchUser: (() => void) | null
}

type UnpairState = 'idle' | 'confirming' | 'submitting'
```

```ts
// src/stores/lock.ts
export const NEUTRAL_LOCK: LockState
export function resetLock(): void // $lock.set(NEUTRAL_LOCK)

// src/features/auth/PinScreen.tsx (module-local)
function autoSelectedUserId(records: VaultRecord[]): string | null // 1 record → its id, else null
```

Visual contract: action row centered under `<displayName> · <rol>`, `min-h-[44px]`, 13px DM Sans;
unpair link `text-text-secondary` (low salience, away from the pad), switch link `text-madera`
font-semibold (matching `+ vincular`); both `underline-offset-2 hover:underline focus-visible:outline-2
focus-visible:outline-madera`. Confirm row: `Sí, desvincular` = `rounded-button bg-hoja text-bg-pantalla
px-[14px] py-[11px] text-[13px] font-semibold`, `Cancelar` = same box with `border border-border-sand
bg-bg-card text-text-primary`; note 12px `text-text-muted`. The `mb-[38px]` currently on the subtitle
moves to the action row so the pad's vertical rhythm is preserved.

## 6. Testing strategy

| Layer | What | How |
|-------|------|-----|
| Unit (store) | `resetLock()` clears `failCount`/`lockedUntil`/`requiresRelogin` | vitest on `$lock` |
| Unit (panel) | Idle link visible; confirm shows the note + both buttons; cancel restores the link and fires nothing; confirm calls `onUnpair` once; switch link only when `onSwitchUser` is non-null; both links hidden when `selectedUser` is null; buttons disabled when `filledCount === 4` | Testing Library + `userEvent`, plain props |
| Integration (container) | 1 profile → confirm → `deleteRecord(userId)` called, `$lock` reset, lands on `/pair`; 2 profiles → confirm → selector shown with the remaining profile; 3 profiles → confirm → selector; switch link → selector without `deleteRecord` | `MemoryRouter` + `Routes` (like `CatalogScreen.test.tsx`), `vi.mock('@/lib/vault')` for `listRecords`/`deleteRecord`, `vi.mock('./usePinUnlock')` |

## 7. Threat matrix

N/A — no routing of shell commands, no subprocess, no VCS/PR automation, no executable-file
classification, no process integration. The only security-relevant surface is deletion of a local
encrypted blob, already covered by proposal D3.

## 8. Migration / rollout

No migration, no feature flag, no server change. Ships in one PR (well under the 400-line budget);
rollback is reverting the PR.

## 9. Open questions

None — OQ-1 resolved by DD-8, OQ-2 by DD-4/DD-5.
