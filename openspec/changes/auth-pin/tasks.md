---
change: auth-pin
phase: tasks
status: ready
depends_on: [proposal, specs, design]
persistence: openspec+engram
sequencing_source: "design.md §8 (DD-12) — 9 slices, smallest-first, daily-path-first"
apply_gate: "Phase 0 (APPLY GATE) MUST be 100% checked before any other phase starts — proposal decision, non-negotiable"
phase_count: 10
task_count: 47
progress: "24/47"
updated_at: 2026-07-14
---

# Tasks: auth-pin — PIN unlock + admin/empleado roles

Full SQL/TS bodies already exist verbatim in `design.md` (§3, §4, §5, §6) — tasks reference sections, they do
not restate code. Phase numbers 0–9 mirror `design.md` §8's 9-slice sequencing 1:1; Phase 0 is the APPLY GATE
added on top, per the session decision recorded in `proposal.md` (Dependencies section) and `design.md` §8.

## Phase 0 — APPLY GATE (blocks every other phase)

Repo has zero linter/formatter/test runner/CI today (`package.json` scripts are only `dev`/`build`/
`typecheck`/`preview`). This phase must close before Phase 1 starts.

| ID | Task | Files | Verification | Status |
|---|---|---|---|---|
| T-0.1 | Add ESLint flat config for TS+React (`eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`); add `"lint": "eslint ."` script. | `eslint.config.js`, `package.json` | `pnpm lint` runs clean on current `src/` skeleton | [x] Done |
| T-0.2 | Add Prettier (`prettier`, `eslint-config-prettier` to disable conflicting ESLint style rules); add `"format"`/`"format:check"` scripts. | `.prettierrc`, `.prettierignore`, `package.json` | `pnpm format:check` passes after one formatting pass | [x] Done |
| T-0.3 | Add Vitest as test runner (`vitest`, `jsdom` env); add `"test": "vitest run"` script; one trivial smoke spec. | `vitest.config.ts` (or `vite.config.ts` `test` block), `src/lib/crypto.test.ts` (asserts `generateSalt()` returns 16 bytes) | `pnpm test` green | [x] Done |
| T-0.4 | Add CI workflow: checkout → corepack pnpm → `pnpm install --frozen-lockfile` → lint → format:check → typecheck → test → build. | `.github/workflows/ci.yml` | workflow green on a throwaway PR before any auth-pin code lands | [x] Done — workflow written and each step verified locally; the "throwaway PR" green run itself still needs the actual PR (orchestrator/human, since this agent does not commit/push) |
| T-0.5 | Generate Supabase TS types (pre-migration baseline); wire `createClient<Database>()`. Closes `data-model` T-6.1 debt. | `src/lib/database.types.ts`, `src/lib/supabase.ts` | `Database` type exported; `supabase.ts` typechecks against it | [x] Done |

**Phase 0 status: 5/5 complete.** All four local gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
`pnpm test`, `pnpm build`) pass. Remaining before Phase 1 can truly start per the apply gate: T-0.4's "green
on a throwaway PR" needs an actual PR run on GitHub Actions (this agent works on `chore/toolchain-gate` and
does not commit/push — see `sdd/auth-pin/apply-progress` in engram for full verification output).

## Phase 1 — Migration + REQ-AP-SEG-5 JWT battery (slice 1, DD-5, DD-12)

Battery tasks (T-1.5–T-1.11) are tracked here per `design.md` §8 slice 1's grouping, but their real actors
(`'empleado'` row, revoked `'empleado'` row) don't exist until Phase 5 and Phase 7 ship — see **Gaps**. They
close for real in Phase 9.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-1.1 | Write the additive migration: widen `rol` CHECK, add `activo`, harden `handle_new_user()`, add `is_active()`, fold `activo` into `is_admin()`, gate write RPCs + SELECT policies (design.md §3, all 7 items verbatim). | `supabase/migrations/20260714000000_auth_pin_multirole.sql` | REQ-AP-SEG-1, REQ-AP-SEG-2, REQ-SETUP-8, DD-5 | file is valid SQL; date prefix > `20260705000300` (last existing) | [x] Done — verified against a disposable local stack (`supabase start`, all 5 migrations applied clean), then `supabase stop`. See apply-progress for the full empirical check (self-signup default, revoke-empleado/-admin, anon denial). |
| T-1.2 | **[HUMAN]** Commit on short branch → PR → merge to `main` (repo PR-only convention). Merge triggers the now-ACTIVE GitHub schema integration (no MCP `execute_sql` fallback needed, unlike `data-model`). | — | DD-5 | migration applied automatically post-merge | [x] Done — PR #28 merged; GitHub integration applied `20260714000000_auth_pin_multirole` automatically (~90s) |
| T-1.3 | Post-deploy structural verify: `list_migrations` shows the new file; `list_tables` shows `profiles.activo`; `get_advisors(type='security')` shows no new unexpected WARN. | — | — | 3 checks pass | [x] Done (orchestrator) — `list_migrations` matches repo 1:1; `profiles.activo` + widened CHECK confirmed live; advisors delta 9→10 is exactly the expected `is_active()` SECURITY DEFINER WARN (zero CRITICAL) |
| T-1.4 | Regenerate Supabase TS types post-migration (now includes `profiles.activo` + widened `rol` union) — supersedes T-0.5's baseline. | `src/lib/database.types.ts` | — | `profiles.Row` includes `activo: boolean`, `rol: 'admin'\|'empleado'` | [x] Done — regenerated from live prod (same CLI command as T-0.5); diff is exactly header + `activo` in Row/Insert/Update + `is_active` in Functions, rest byte-identical. Note: `rol` types as `string`, NOT a union — CHECK constraints never surface as unions in generated types (this row's original "widened `rol` union" wording was optimistic; the T-0.5 header already documented the real behavior). All 5 gates green post-regen. |
| T-1.5 | Battery row SEG-5.1 (spec's own label: T-5.1): active empleado → `producto_costos`/`proveedores` SELECT → `[]`, never 403. | — | REQ-AP-SEG-5 | PASS once empleado exists (Phase 5) | [ ] Scaffolded (skipped) — `src/lib/authPinRlsBattery.test.ts`; blocked on Phase 5, closes for real at T-9.3 |
| T-1.6 | Battery row SEG-5.2 (T-5.2): active admin `WITH CHECK` boundary — out-of-bounds UPDATE rejected, in-bounds succeeds. | — | REQ-AP-SEG-5 | PASS | [ ] Scaffolded (skipped) — same file; blocked on Phase 5 |
| T-1.7 | Battery row SEG-5.3 (T-5.3): `deshacer_venta` on a non-last confirmed sale → RPC error, zero partial effect. | — | REQ-AP-SEG-5 | PASS | [ ] Scaffolded (skipped) — same file; blocked on Phase 5 |
| T-1.8 | Battery row SEG-5.4 (T-5.4): `confirmar_venta` over available stock → rejected, stock unchanged. | — | REQ-AP-SEG-5 | PASS | [ ] Scaffolded (skipped) — same file; blocked on Phase 5 |
| T-1.9 | Battery row SEG-5.5 (T-5.5): active empleado embed `productos?select=*,producto_costos(costo)` degrades to `[]`, not a request-level error. | — | REQ-AP-SEG-5 | PASS | [ ] Scaffolded (skipped) — same file; blocked on Phase 5 |
| T-1.10 | Battery row SEG-5.6 (spec's "new" row): anon → any domain table/RPC → `401`/`42501`. | — | REQ-AP-SEG-5 | PASS | [ ] Scaffolded (skipped) — same file; not actor-blocked, but deferred to the single Phase 9 (T-9.3) verify pass |
| T-1.11 | Battery row SEG-5.7 (spec's other "new" row): inactive empleado (`activo=false`) → denied on every SEG-5.1–SEG-5.4 target, incl. plain `productos` SELECT. | — | REQ-AP-SEG-2, REQ-AP-SEG-5 | PASS once Phase 7 (revocation) ships | [ ] Scaffolded (skipped) — same file; blocked on Phase 7 |

> **ID note**: `SEG-5.n` is this document's own disambiguated numbering for `REQ-AP-SEG-5`'s matrix rows.
> The spec itself labels these rows `T-5.1..T-5.5` (inherited verbatim from `data-model`'s own Phase-5
> battery) plus two unlabeled "new" rows — that label would collide with THIS document's own Phase 5
> (`T-5.1`/`T-5.2`, employee enrollment). `SEG-5.n` avoids the clash; the parenthetical keeps traceability
> to the spec's original case names.

## Phase 2 — Vault + stores + Supabase client (slice 2, DD-1, DD-7)

**Phase 2 status: 4/4 complete.** All five gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
`pnpm test`, `pnpm build`) pass. See `sdd/auth-pin/apply-progress` in engram for the full verification
output and a documented test-tooling gotcha (jsdom + fake-indexeddb cross-realm `ArrayBuffer`).

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-2.1 | Create raw-IndexedDB vault: DB `antimahue-vault` v1, object store `profiles` keyPath `userId`; `VaultRecord` (`userId,displayName,rol,salt,iv,ciphertext,failCount,lockedUntil,pairedAt`); `putRecord/getRecord/listRecords/deleteRecord`. Zero IDB helper dependency (raw WebCrypto/IDB only). Add `fake-indexeddb` as a test-only devDependency. | `src/lib/vault.ts` | DD-1 | vitest: put→get roundtrip; `listRecords()` returns all; `deleteRecord` removes it | [x] Done — `src/lib/vault.test.ts`, 7 tests (roundtrip, unknown-key undefined, empty list, multi-record list, overwrite-by-userId, targeted delete, delete-unknown no-throw) |
| T-2.2 | Set `auth.persistSession:false` + in-memory `storage` shim (custom `getItem`/`setItem`/`removeItem`); keep `autoRefreshToken:true`; wire `createClient<Database>()` (T-1.4 types). | `src/lib/supabase.ts` | DD-7 | no refresh token ever reaches `localStorage` | [x] Done — `persistSession:false` + `Map`-backed in-memory storage shim, both defense-in-depth together; `createClient<Database>()` already wired from T-1.4 |
| T-2.3 | Extend `AuthState`: add `rol:'admin'\|'empleado'\|null`, `status:'locked'\|'unlocking'\|'unlocked'`. | `src/stores/auth.ts` | DD-7 §5 | typecheck passes | [x] Done — `Rol` type sourced from `src/lib/vault.ts` (single definition, reused by both `VaultRecord.rol` and `AuthState.rol`); `pnpm typecheck` green |
| T-2.4 | Rewrite backoff table to DD-2 values (1–4 retry, 5→30s, 6→2min, 7→10min, 8→1h, 9→wipe), replacing the stale 5/6/7/8+ table; fix the incorrect "mirrored to server" comment (`auth_attempts` is authenticated-only telemetry, NOT an offline gate). | `src/stores/lock.ts` | DD-2 | vitest: `isLocked()` boundary cases at fail counts 4/5/8/9; comment no longer claims server-side gating | [x] Done — `src/stores/lock.test.ts`, 10 tests covering `nextLockState` at every threshold (4 through 9, plus beyond-9 and the `now` default) and `isLocked` boundary timing; comment rewritten |

## Phase 3 — Device pairing (slice 3, DD-3)

**Phase 3 status: 2/2 complete.** All five gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
`pnpm test`, `pnpm build`) pass. See `sdd/auth-pin/apply-progress` in engram for the full verification
output and Gap 8 (`rol` sourcing deviation from design.md's literal DD-3 step 4 pseudocode).

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-3.1 | Build pairing flow: email+password → `signInWithPassword()` → employee sets own 4-digit PIN (entered twice) → `generateSalt`+`deriveKey`+`encryptToken(session.refresh_token)`+`putRecord({...pairedAt:Date.now()})`. | `src/features/auth/PairDeviceScreen.tsx` | DD-3, REQ-AUTH-1 | after pairing, `listRecords()` has exactly one record; no plaintext password/token ever passed to `putRecord` | [x] Done — orchestration extracted into `src/features/auth/pairDevice.ts` (`signInForPairing` + `completePairing`) so it's unit-testable without a rendering harness; `PairDeviceScreen.tsx` is a thin two-step form container. `src/features/auth/pairDevice.test.ts` (9 tests) mocks ONLY `supabase.auth.signInWithPassword`; `@/lib/crypto` and `@/lib/vault` run for real (fake-indexeddb) — one test does a full roundtrip: pair → `listRecords()` has exactly 1 record → decrypt the persisted ciphertext with the same PIN → recovers the original refresh token. A second test asserts the serialized record contains neither the PIN nor the refresh token as plaintext. Password is cleared from component state in a `finally` block immediately after `signInWithPassword` resolves (success or failure); PIN + session cleared in a `finally` block immediately after `completePairing` resolves. |
| T-3.2 | Temporary direct route for this slice's standalone testability (e.g. `/pair`) — superseded by the "+ vincular" affordance wired into `UserSelector` in Phase 4 (T-4.6). | `src/lib/router.tsx` | DD-3 | navigating to the temp route renders `PairDeviceScreen` | [x] Done — `/pair` route added (lazy-loaded, same pattern as the other 9 routes) |

## Phase 4 — Daily PIN unlock (slice 4, DD-2, DD-7, DD-10)

**Phase 4 status: 9/9 complete.** All five gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
`pnpm test`, `pnpm build`) pass. See `sdd/auth-pin/apply-progress` in engram for the full verification
output, the Tailwind/Terraza-tokens wiring decision (no CSS entry file existed before this phase), and
the `@phosphor-icons/react` dependency addition (design-system-mandated icon set, not a fresh choice).

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-4.1 | Atom: 13×13 dot, filled `#8B5E3C` / empty border `#D9C3A0`, 150ms fill transition. | `src/components/atoms/PinDot.tsx` | DD-10 | matches handoff spec | [x] Done |
| T-4.2 | Atom: 66×66 circle key, `#FDFAF4` bg, `1px #D9C3A0` border, 22px/500 label. | `src/components/atoms/PinKey.tsx` | DD-10 | matches handoff spec | [x] Done |
| T-4.3 | Atom: 70×70 maple-leaf SVG, gradient `#C84030→#8A2010` (reuse handoff SVG path). | `src/components/atoms/AppIcon.tsx` | DD-10 | matches handoff spec | [x] Done |
| T-4.4 | Molecule: row of 4 `PinDot`. | `src/components/molecules/PinDots.tsx` | DD-10 | renders 4 dots, fills left-to-right | [x] Done |
| T-4.5 | Molecule: 3×4 grid + Phosphor `Backspace` (`fill`) + empty `[9,0]` cell. | `src/components/molecules/PinPad.tsx` | DD-10 | matches handoff layout | [x] Done — uses `BackspaceIcon` (the non-deprecated export; `Backspace` itself is `@deprecated` in `@phosphor-icons/react` 2.1.10) |
| T-4.6 | Molecule: avatars/names sourced ENTIRELY from `listRecords()`; auto-select if exactly one record; "+ vincular" → `PairDeviceScreen` (wires T-3.2's temp route into the real selector). | `src/components/molecules/UserSelector.tsx` | DD-3 RFC | 0 records → only "+ vincular" shown; 1 record → auto-selected, no picker | [x] Done — auto-select/no-picker logic lives in `PinScreen.tsx` (the container); the molecule itself is presentational (records/onSelect props) |
| T-4.7 | Organism: `AppIcon` + title "Antimahue" + subtitle(selected) + "INGRESA TU PIN" + `PinDots` + `PinPad` + lockout countdown (reads `$lock`). | `src/components/organisms/PinUnlockPanel.tsx` | DD-10 | matches handoff screen 1 | [x] Done — countdown ticks via a `now` state value updated in a `setInterval` effect, not a direct `Date.now()` call in the render body (`react-hooks/purity`, eslint-plugin-react-hooks v7) |
| T-4.8 | Hook: 4-digit accumulation → `getRecord`→`deriveKey`→`decryptToken`→`refreshSession({refresh_token})`; on success RE-ENCRYPT the rotated refresh token + `putRecord`; reset `failCount`; fetch own `profiles` row → `rol` into `$auth` (REQ-AUTH-4); on failure → DD-2 backoff, 9th failure → `deleteRecord`+route to pairing. | `src/features/auth/usePinUnlock.ts` | REQ-AUTH-1, REQ-AUTH-2, REQ-AUTH-4, DD-2, DD-7 | vitest w/ mocked `crypto.subtle`/supabase: correct PIN resolves + resets failCount; wrong PIN throws locally, zero network calls; 9th failure calls `deleteRecord` | [x] Done — split into `pinUnlock.ts` (pure orchestration, mirrors the `pairDevice.ts` precedent, holds ALL the logic in this row's description including the `$auth`/`$lock` store writes) + `usePinUnlock.ts` (the React digit-accumulation state machine calling it). `src/features/auth/pinUnlock.test.ts`, 12 tests: successful roundtrip + `$auth` update, token-rotation re-encryption recoverable with the same PIN, wrong-PIN zero-network, 5th-failure 30s lock, cooldown rejection without touching `failCount`/network, 9th-failure wipe, revoked-user (`activo=false`) refusal with vault intact, not-paired edge case, `refreshSession`-rejects edge case, post-refresh profile-read-fails edge case, `syncLockFromVault` mirroring + neutral-reset |
| T-4.9 | Rewrite skeleton into real container: `UserSelector` (if >1 record) → `PinUnlockPanel`, wires `usePinUnlock`, disables pad while `$lock` active, navigates `/dashboard` 350ms after 4th correct digit, resets dots. | `src/features/auth/PinScreen.tsx` | DD-10, REQ-AUTH-1 | manual walkthrough: correct PIN → dashboard; wrong PIN → reset, no navigation | [x] Done — not manually walked through yet inside an actual browser (this agent has no browser tool in this session); logic verified via the 12 `pinUnlock.test.ts` cases + all 5 static gates green. Flagged as residual verification for `sdd-verify`/T-9 rather than silently claimed complete. |

## Phase 5 — Employee enrollment: POST (slice 5, DD-4, DD-6)

| ID | Task | Files | Refs | Verification |
|---|---|---|---|---|
| T-5.1 | CORS preflight + JWT auth chain (missing/invalid→401; not admin/inactive→403) + `POST`: `admin.createUser({email,password,email_confirm:true,app_metadata:{rol:'empleado'},user_metadata:{display_name}})` + `audit_log` insert (`action='enroll_empleado'`). | `supabase/functions/enroll-empleado/index.ts` | REQ-AP-SEG-3, DD-4, DD-6 | 409 duplicate email; 422 weak password; response has NO password/token; non-admin/inactive-admin → 403, zero side effects |
| T-5.2 | Deploy the Edge Function; set `SUPABASE_SERVICE_ROLE_KEY` as a function secret (never under `src/`). | — | REQ-SETUP-9 | function reachable; key absent from `src/` |

## Phase 6 — Employee management screen: GET + UI (slice 6, DD-11)

> **FLAG**: net-new surface, absent from the 9-screen hi-fi handoff (Risk R2, `proposal.md`).

| ID | Task | Files | Refs | Verification |
|---|---|---|---|---|
| T-6.1 | Add `GET` (list): `admin.listUsers()` ∩ `profiles` → `[{id,email,displayName,rol,activo,banned}]`. No broad `profiles` SELECT policy added — roster is Edge-Function-only. | `supabase/functions/enroll-empleado/index.ts` | REQ-AP-SEG-3 | roster reflects real `auth.users`+`profiles` join |
| T-6.2 | Terracota header (back + "Vendedoras" + "+"); body = roster cards (displayName + `activo` badge + revoke/restore toggle stub) from `GET`; "+" → inline form (nombre, email, password) → `POST` (Phase 5). | `src/features/empleadas/EmpleadasScreen.tsx` | DD-11 | roster renders from real `GET`; add-employee form succeeds, new row appears after refetch |
| T-6.3 | Add `/empleadas` route (lazy-loaded, admin-only, matching the existing 9-route pattern). | `src/lib/router.tsx` | DD-11 | route resolves to `EmpleadasScreen` |

## Phase 7 — Revocation (slice 7, D5, DD-6)

| ID | Task | Files | Refs | Verification |
|---|---|---|---|---|
| T-7.1 | Add `PATCH` (revoke/restore): `{userId,activo}` → `UPDATE profiles SET activo=<>`; revoke also `admin.updateUserById(userId,{ban_duration:'876000h'})`, restore `ban_duration:'none'`; `audit_log` insert (`action='revoke_empleado'`); `activo` write MUST NOT depend on the ban call succeeding. | `supabase/functions/enroll-empleado/index.ts` | REQ-AP-SEG-4 | 404 unknown user; `activo` flips even if the ban call throws |
| T-7.2 | Wire the revoke/restore toggle in the roster to call `PATCH`; refetch-on-success UI update. | `src/features/empleadas/EmpleadasScreen.tsx` | DD-11 | toggling a roster row flips its `activo` badge after the call resolves |

## Phase 8 — Inactivity auto-lock + route guards (slice 8, DD-8, DD-9)

DD-8's "hidden cost/margin cards" applies to shared shell/nav elements only — catálogo/dashboard screen
bodies are out of proposal scope (they don't exist beyond lazy-loaded stubs yet); see **Gaps**.

| ID | Task | Files | Refs | Verification |
|---|---|---|---|---|
| T-8.1 | Wall-clock idle detection: `visibilitychange`→hidden records `Date.now()`; →visible, if `now-hidden>threshold` set `$auth.status='locked'` immediately; foreground `setInterval` covers active use; handle `pagehide`/`freeze`/bfcache. MUST NOT rely on `setTimeout` alone. Default threshold 5 min (residual open question from design.md — confirm with user). | `src/features/auth/useIdleLock.ts` | REQ-AUTH-3, DD-9 | fake-timer test: hidden 6min→visible locks; hidden 2min→visible stays unlocked |
| T-8.2 | Wire `useIdleLock` into the app shell for the lifetime of an unlocked session; re-unlock via the same `usePinUnlock` local-decrypt path (no re-auth over the wire). | `src/main.tsx` (or root layout) | REQ-AUTH-3 | idle-lock shows `PinScreen`; correct PIN resumes without a `signInWithPassword` call |
| T-8.3 | `<RequireSession>` guard: redirect to `/` when `$auth.status !== 'unlocked'`. | `src/lib/router.tsx` | DD-8 | navigating to `/dashboard` while locked redirects to `/` |
| T-8.4 | `<RequireAdmin>` guard: redirect `empleado` away from `/proveedor`, `/dte`, `/empleadas`. | `src/lib/router.tsx` | DD-8 | empleado session hitting `/empleadas` redirects away; RLS still returns `[]` if reached anyway (cross-check SEG-5.1/SEG-5.7, tasks T-1.5/T-1.11) |

## Phase 9 — Verify prep (slice 9, DD-13, R4)

| ID | Task | Files | Refs | Verification |
|---|---|---|---|---|
| T-9.1 | **[HUMAN]** Build + install the PWA (production build, SW registered, "Add to Home Screen") on a real or emulated mobile device. | — | R4 | app launches in `display-mode: standalone` |
| T-9.2 | **[HUMAN, or agent via chrome-devtools-mcp emulation]** Run the WebCrypto/IndexedDB smoke test INSIDE the installed PWA: `generateSalt→deriveKey→encryptToken→putRecord→reload→getRecord→decryptToken`, assert plaintext roundtrip; assert `crypto.subtle` present in the standalone context. | — | R4, DD-13 | roundtrip succeeds after a real reload of the installed app (setup-stack task 7.10 was left unverified — this closes it) |
| T-9.3 | Confirm Phase 1's REQ-AP-SEG-5 battery (T-1.5–T-1.11) fully closed now that Phase 5 + Phase 7 provide real empleado + revoked-empleado rows; re-run any row only structurally checked earlier. | — | REQ-AP-SEG-5 | all 7 rows PASS against the live project with real JWTs |
| T-9.4 | **[HUMAN]** Network-trace check across one full daily unlock (correct PIN): confirm zero requests carry a PIN or token in cleartext; confirm the ONE authenticated request in the whole flow is the one-time enrollment/pairing login. | — | REQ-AUTH-1 (both scenarios) | HAR/devtools capture attached to `verify-report.md` |
| T-9.5 | Walk `proposal.md`'s Success Criteria checklist (8 items) end-to-end; record PASS/FAIL per item. | — | proposal.md Success Criteria | all 8 PASS, or each FAIL has a documented follow-up |

## Gaps (spec/design inconsistencies — surfaced, not silently resolved)

1. **JWT battery slice placement**: `design.md` §8 slice 1 literally groups "run deferred JWT battery
   T-5.1..T-5.5" with the migration, but every battery row needs a real (and, for the new row, a *revoked*)
   `'empleado'` — neither exists until Phase 5 (enrollment) and Phase 7 (revocation) ship. Resolution taken:
   battery task IDs live in Phase 1 (matching the design's slice grouping), tagged execution-blocked, closed
   for real in Phase 9 (T-9.3). Design itself doesn't reconcile this ordering.
2. **Idle-lock file not enumerated**: `design.md` §10's File changes table lists `router.tsx` for guards but
   names no file for the DD-9 idle-timer logic. Resolution taken: `src/features/auth/useIdleLock.ts`,
   consistent with the existing `usePinUnlock.ts` naming in the same feature directory — not a new surface,
   just an unnamed implementation detail of an already-mandated behavior.
3. **DD-8 "hidden cost/margin cards" scope**: DD-8 mentions hiding cost/margin cards and nav items, but
   `proposal.md`'s Out-of-scope explicitly excludes screens beyond PIN + employee-management ("catálogo/
   venta/dashboard remain later changes") — and those screens are still lazy-loaded stubs today. Resolution
   taken: Phase 8 implements only the router-level guards (`RequireSession`/`RequireAdmin`), which is the
   full actionable scope today; per-screen cost-card concealment is deferred to whichever change actually
   builds those screens.
4. **Idle threshold value**: design.md's Open Questions section leaves the exact idle-lock minutes
   unconfirmed, proposing 5 min. T-8.1 carries that default; not a blocker, flagged for user confirmation.
5. **`handle_new_user()` self-signup default — design.md CONTRADICTS this same change's own spec text**
   (discovered while implementing T-1.1, confirmed against a disposable local Supabase stack). `design.md`
   §3 item 3 flips the trigger's fallback role from `'admin'` to `'empleado'`
   (`COALESCE(NEW.raw_app_meta_data->>'rol', 'empleado')`) — explicitly called "least-priv default" in its
   own prose. But `specs/setup-stack/spec.md`'s REQ-SETUP-8 (this same change's delta) literally requires
   the opposite: *"The default for new rows MUST remain 'admin' only for the signup trigger path"*, with a
   scenario asserting *"self-signup still defaults to admin, never empleado."* These cannot both be true;
   T-1.1 was written to satisfy design.md §3 verbatim, so it necessarily fails that spec scenario as
   literally worded. Resolution taken: implemented design.md's flip, because it closes a real, currently-
   live privilege-escalation hole — `supabase/config.toml`'s `auth.enable_signup = true` (CLI default,
   nothing in this repo's history disables it) means public self-signup via the anon key has been reachable
   since `setup-stack`, and the PRE-migration trigger (`INSERT INTO profiles (id) VALUES (NEW.id)`, no
   explicit `rol`) relies purely on the column `DEFAULT 'admin'` — i.e. today, in production, ANY anonymous
   caller invoking `signUp()` becomes a full admin. Verified empirically on a local stack: inserting a bare
   `auth.users` row with empty `raw_app_meta_data` now yields `profiles.rol = 'empleado'`; an explicit
   `app_metadata.rol = 'admin'` still yields `'admin'` (only a service_role caller — `enroll-empleado`, never
   present on the client — can set that). Not silently resolved: this is a genuine spec bug, most likely
   because REQ-SETUP-8's scenario text was carried forward from before design.md's security hardening and
   never updated. Recommend correcting the spec scenario text (self-signup should default to LEAST
   privilege, i.e. `'empleado'`) rather than reverting the migration.
   **RESOLVED 2026-07-14**: `specs/setup-stack/spec.md` REQ-SETUP-8 corrected to match design.md §3 (least-priv `'empleado'` default via `app_metadata.rol`, incl. the fresh-environment first-admin bootstrap nuance) and `spec.html` synced — the spec text was the defect, not the migration.
6. **`src/main.tsx` touched during Phase 2, though absent from design.md §10's File changes table for this
   slice** (that table only lists it under Phase 8's idle-lock wiring, T-8.2). T-2.3 extends `AuthState` with
   two now-REQUIRED fields (`rol`, `status`) per the design's own literal TS contract (§5) — but
   `main.tsx`'s two `$auth.set({...})` calls (session bootstrap + `onAuthStateChange`) predate those fields
   and would fail `pnpm typecheck` (missing required properties) the instant `AuthState` gained them.
   Resolution taken: patched both call sites minimally — `rol: null` (real resolution is REQ-AUTH-4's job,
   Phase 4's `usePinUnlock`, not this bootstrap) and `status` derived from session presence (`session ? 'unlocked'
   : 'locked'`), which happens to be exactly correct today since T-2.2's `persistSession:false` means
   `getSession()` on a fresh load always resolves `session: null` → app boots to `'locked'` → `PinScreen`,
   matching the design intent. Phase 8's idle-lock state machine supersedes this bootstrap logic once it
   lands. Not a scope-creep feature — the minimum edit to keep the mandated literal `AuthState` contract
   compiling.
7. **Test-tooling gotcha, not an app bug**: `src/lib/vault.test.ts` cannot use a single `toEqual()` across a
   whole `VaultRecord` when it contains a raw `ArrayBuffer` (the `ciphertext` field). Under vitest's `jsdom`
   test environment, `fake-indexeddb`'s structured-clone step returns an `ArrayBuffer` from a different
   realm than the one the test constructs; `byteLength` and byte content are BOTH correct (verified
   explicitly), but `toEqual`'s deep-equality can't match a cross-realm `ArrayBuffer` via `instanceof` and
   misreports a diff. Worked around by comparing binary fields as `Array.from(new Uint8Array(...))` instead
   of the raw buffer object. A real browser has exactly one realm — this cannot occur in production; it is
   purely an artifact of this jsdom+fake-indexeddb combination in the test runner.
8. **T-3.1's `rol` sourcing deviates from design.md §2 DD-3 step 4's literal pseudocode** (which lists
   exactly 4 steps — `generateSalt`→`deriveKey`→`encryptToken`→`putRecord` — with no extra network fetch
   between login and vault write). `completePairing` (`src/features/auth/pairDevice.ts`) reads `rol` from
   `session.user.app_metadata.rol` (JWT-embedded, service-role-only settable via `handle_new_user()`/
   `enroll-empleado`) rather than adding a `profiles` SELECT, keeping the sequence literally 4 steps as
   written. This is NOT a full REQ-AUTH-4 implementation: REQ-AUTH-4 requires resolving `rol`/`activo` from
   a FRESH `profiles` read "after establishing a session (fresh login or PIN unlock)" — pairing IS a fresh
   login, so read strictly, T-3.1 only partially satisfies it. Resolution taken: the vault's `rol` field is
   a UI-shaping hint only (Phase 4 T-4.6's PIN-selector avatar/label) — DD-8 keeps RLS/RPC as the sole
   authorization boundary regardless of what this hint says, so a stale/JWT-cached value here has no
   security consequence. `PairDeviceScreen` deliberately does NOT write to `$auth.rol` either (left `null`,
   matching `main.tsx`'s existing bootstrap) — REQ-AUTH-4's fresh-read is Phase 4's `usePinUnlock`'s own
   claimed responsibility per its task description ("fetch own `profiles` row → `rol` into `$auth`
   (REQ-AUTH-4)"), not pairing's. Residual edge case, not addressed here: immediately after pairing (before
   the employee's first Phase-4 PIN unlock), `$auth.rol` stays `null` — if Phase 8's `RequireAdmin` guard
   existed today, a freshly-paired ADMIN could be redirected away from admin-only routes until their next
   unlock. Phase 8 doesn't exist yet, so this has zero live consequence now; flagging for whoever builds
   Phase 8 to confirm `usePinUnlock` actually runs (or an equivalent `profiles` read fires) right after
   pairing completes, not only on subsequent unlocks.
   **PARTIALLY RESOLVED 2026-07-14 (Phase 4)**: REQ-AUTH-4's own claimed responsibility is now built —
   `attemptUnlock` (`src/features/auth/pinUnlock.ts`) performs a fresh `profiles` SELECT on every PIN unlock
   and writes the resolved `rol` (plus an `activo` GATE — see design.md §5's "Edge case" and this file's
   T-4.8 row) into `$auth`, never trusting the vault's cached hint or a stale value. The residual edge case
   itself (freshly-paired user's `$auth.rol` is `null` until their FIRST unlock) is UNCHANGED by this phase
   — still correctly flagged for whoever builds Phase 8's `RequireAdmin` guard, since Phase 8 remains out of
   scope here.
