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
progress: "29/47"
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

**Phase 5 status: 2/2 complete (agent-side).** All five gates (`pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm test`, `pnpm build`) pass — `supabase/functions/**` is excluded from the
Node/TS toolchain (Deno code, see Gap 9). Full local-stack E2E verified against a disposable
`supabase start` + `supabase functions serve` run (all 5 containers, then `supabase stop`): active
admin → 200 + `auth.users`/`profiles`(`rol='empleado'`,`activo=true`)/`audit_log` rows; active
empleado → 403; revoked admin (`activo=false`) → 403; anon (no header) → 401; anon-key-as-bearer →
401; duplicate email → 409; weak password / bad email shape → 422; malformed JSON → 400; CORS
`OPTIONS` → 200; audit_log-insert-failure compensation (deleteUser rollback) → 500, verified by
deliberately revoking the grant mid-test and confirming zero orphaned `auth.users` row. See
`sdd/auth-pin/apply-progress` in engram for the full command-by-command evidence and Gap 9/10.
T-5.2's literal "deploy the Edge Function" + "set `SUPABASE_SERVICE_ROLE_KEY` as a function secret"
are **orchestrator actions** (this agent doesn't deploy to prod) — see Gap 10 for why the secret
half is likely a no-op on this project.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-5.1 | CORS preflight + JWT auth chain (missing/invalid→401; not admin/inactive→403) + `POST`: `admin.createUser({email,password,email_confirm:true,app_metadata:{rol:'empleado'},user_metadata:{display_name}})` + `audit_log` insert (`action='enroll_empleado'`). | `supabase/functions/enroll-empleado/index.ts` | REQ-AP-SEG-3, DD-4, DD-6 | 409 duplicate email; 422 weak password; response has NO password/token; non-admin/inactive-admin → 403, zero side effects | [x] Done — see Gap 9 for a design.md §4 deviation (is_admin() RPC instead of a direct service-role `profiles` read) and the companion grant migration it required |
| T-5.2 | Deploy the Edge Function; set `SUPABASE_SERVICE_ROLE_KEY` as a function secret (never under `src/`). | — | REQ-SETUP-9 | function reachable; key absent from `src/` | [x] Done (agent-side) — function authored + fully verified end-to-end against a disposable local stack; `SUPABASE_SERVICE_ROLE_KEY` never appears under `src/` (confirmed: it's a Deno-only reference in `supabase/functions/enroll-empleado/index.ts`). **[HUMAN/ORCHESTRATOR]** residual: actual prod deploy (GitHub integration vs `deploy_edge_function` MCP fallback) — see Gap 10 for why the secret itself is likely already auto-injected, needing no manual `secrets set` |

## Phase 6 — Employee management screen: GET + UI (slice 6, DD-11)

> **FLAG**: net-new surface, absent from the 9-screen hi-fi handoff (Risk R2, `proposal.md`).

**Phase 6 status: 3/3 complete.** All five gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
`pnpm test`, `pnpm build`) pass. Gap 9's own forward-flag for this phase ("Phase 6 either needs its own
grant migration or a similar SECURITY DEFINER RPC route") is RESOLVED via a new migration,
`supabase/migrations/20260716000000_listar_perfiles_rpc.sql` (`listar_perfiles()`, `is_admin()`-gated
SECURITY DEFINER RPC) — see that migration's own header and Gap 9's note below for the full reasoning.
Full local-stack E2E verified against a disposable `supabase db reset` + `supabase functions serve` run
(3 synthetic actors — active admin, active empleado, revoked admin — plus anon): GET as active admin →
200 + correct 3/4-row roster (id/email/displayName/rol/activo/banned, joining `admin.listUsers()` with
`listar_perfiles()`); GET as active empleado → 403; GET as revoked admin → 403; GET with no
Authorization header → 401; GET with the anon key as bearer → 401; direct `listar_perfiles()` RPC call
(bypassing the Edge Function) as empleado/revoked-admin → empty set (never an exception, matching this
codebase's own read-denial idiom); as anon role → `42501 permission denied for function
listar_perfiles` (EXECUTE never granted to `anon`). POST (Phase 5) regression-checked in the same run:
still 200, `audit_log` row still written, new row visible in a follow-up GET. See `sdd/auth-pin/apply-
progress` in engram and Gap 11 below for a real (if currently benign) defect discovered ONLY by this
empirical run: `handle_new_user()`'s role sourcing cannot actually produce an admin profile via
`admin.createUser()` today.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-6.1 | Add `GET` (list): `admin.listUsers()` ∩ `profiles` → `[{id,email,displayName,rol,activo,banned}]`. No broad `profiles` SELECT policy added — roster is Edge-Function-only. | `supabase/functions/enroll-empleado/index.ts` | REQ-AP-SEG-3 | roster reflects real `auth.users`+`profiles` join | [x] Done — `profiles` data sourced via a NEW `listar_perfiles()` SECURITY DEFINER RPC (Gap 9 resolution for this phase, see migration `20260716000000_listar_perfiles_rpc.sql`), not a direct service-role table read (would have 42501'd, identically to Gap 9's POST-path discovery) |
| T-6.2 | Terracota header (back + "Vendedoras" + "+"); body = roster cards (displayName + `activo` badge + revoke/restore toggle stub) from `GET`; "+" → inline form (nombre, email, password) → `POST` (Phase 5). | `src/features/empleadas/EmpleadasScreen.tsx` | DD-11 | roster renders from real `GET`; add-employee form succeeds, new row appears after refetch | [x] Done — pure network/parsing logic extracted to `src/features/empleadas/empleadasApi.ts` (`fetchRoster`/`enrollEmpleado`, mirroring the `pairDevice.ts`/`pinUnlock.ts` split), unit-tested in `empleadasApi.test.ts` (9 cases: success roster, 401/403/409/422 error-surface mapping, non-JSON error body fallback, non-array response guard, POST body/ack shape) mocking ONLY `supabase.functions.invoke`. Component-level walkthrough not yet done inside an actual browser (no React Testing Library in this repo — same residual-verification status T-4.9 flagged for `PinScreen.tsx`); the GET/POST contract itself IS verified end-to-end (see the Phase 6 status note above). Copy written in neutral/Chilean Spanish, no voseo (per the flagged Phase 4 "Probá" defect — not repeated here). Revoke/restore toggle rendered as a disabled stub per this row's own spec, wired for real in Phase 7 (T-7.2) |
| T-6.3 | Add `/empleadas` route (lazy-loaded, admin-only, matching the existing 9-route pattern). | `src/lib/router.tsx` | DD-11 | route resolves to `EmpleadasScreen` | [x] Done — `<RequireAdmin>` route-level guard is still Phase 8 (out of scope); `EmpleadasScreen` itself gates on `$auth.rol === 'admin'` in the meantime (never fetches/renders roster data otherwise), per this apply's brief ("don't render cost/roster data without an admin session state") |

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
9. **design.md §4's literal "With SERVICE_ROLE, SELECT rol, activo FROM profiles WHERE id = <caller>" is
   unimplementable as written on this project** (discovered while implementing T-5.1, confirmed against a
   disposable local stack). `supabase/config.toml` documents `auto_expose_new_tables` defaulting to OFF
   (current Supabase cloud default: new tables get ZERO Data API grants to ANY role, including
   `service_role`, until explicitly `GRANT`ed) — verified empirically: `\dp public.profiles` shows
   `service_role=Dxtm/postgres` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN only, no SELECT). A literal
   service-role `.from('profiles').select(...)` 42501s on every single call; this was never caught by the
   Phase 1 JWT battery (T-1.5–T-1.11) because those tests exercise the `authenticated` role via RLS, never
   `service_role` via direct PostgREST access. Resolution taken: `enroll-empleado`
   (`supabase/functions/enroll-empleado/index.ts`) checks admin/active status by calling `public.is_admin()`
   — a SECURITY DEFINER RPC already `GRANT`ed to `authenticated` (`20260705000200_domain_rls.sql`) that
   already ANDs `activo` (Phase 1's `20260714000000...sql` item 5) — via a client scoped with the CALLER'S
   OWN JWT (not service_role). This satisfies the exact same "rol='admin' AND activo" predicate with zero
   new grants, and is arguably MORE aligned with this codebase's own established pattern (DD-8: RLS/RPC is
   the sole authorization boundary) than the literal pseudocode. Not silently resolved: design.md §4 should
   be corrected to reference `is_admin()` rather than a direct service-role table read, for whoever builds
   Phase 6 (T-6.1's `GET` roster join literally needs `profiles` data too, and will hit this SAME grant gap
   if implemented as a direct service-role `.from('profiles')` read — Phase 6 either needs its own grant
   migration or a similar SECURITY DEFINER RPC route).
   **RESOLVED 2026-07-14 (Phase 6)**: exactly the forward-flagged case — T-6.1's `GET` roster handler hit
   the identical 42501 on a direct service-role `profiles` read. Resolution chosen, precedent-consistent
   AND respecting DD-11's own explicit decision ("no `profiles` read-policy widening, no `nombre` column"
   — a broad admin-read RLS policy on `profiles` was the REJECTED alternative in that same decision row):
   a new SECURITY DEFINER RPC, `listar_perfiles()` (`supabase/migrations/20260716000000_listar_perfiles_rpc.sql`),
   gated by `is_admin()` INSIDE its own body (defense-in-depth — it is `authenticated`-EXECUTE-granted, so
   callable directly from the browser console, bypassing the Edge Function's own auth chain entirely),
   invoked via the caller's own JWT (same `callerClient` the POST path already uses for `is_admin()`).
   Degrades to an empty set for a non-admin `authenticated` caller (matches this codebase's own read-denial
   idiom — `producto_costos_select_admin` et al. — never an exception); `anon` gets a harder `42501`
   because EXECUTE is never granted to it. Verified empirically on a disposable local stack for all 4 actor
   types (see the Phase 6 status note above for the full command-by-command result).
10. **The mandatory `audit_log` insert (REQ-AP-SEG-3) hit the identical grant gap as Gap 9** — `service_role`
   also had zero grants on `audit_log` (confirmed via the same `\dp` check: `service_role=Dxtm/postgres`,
   no INSERT). Unlike Gap 9, there is no SECURITY DEFINER RPC to route around this — the audit trail is a
   plain table write with no existing wrapper function — so this one genuinely needed a new migration.
   Added `supabase/migrations/20260715000000_enroll_empleado_grants.sql`: `GRANT INSERT ON public.audit_log
   TO service_role;` (INSERT only — the function's own `.insert()` call has no `.select()` chained, so
   PostgREST never requests `SELECT` back). Verified empirically both ways on the local stack: with the
   grant, enrollment succeeds and the audit row lands; with the grant deliberately revoked mid-test, the
   function's own compensation logic (`admin.deleteUser()` rollback on audit-insert failure, disclosed in
   `index.ts`'s file-header comment) fired correctly — zero orphaned `auth.users` row, 500 returned. This
   migration is a REQUIRED companion to the `enroll-empleado` function deploy, not an optional cleanup —
   without it, T-5.1's own spec requirement (REQ-AP-SEG-3's "MUST insert one audit_log row") fails on every
   call in prod exactly as it did locally before the grant existed. Flagged for the orchestrator's deploy
   step (same GitHub-integration path as `20260714000000_auth_pin_multirole.sql`, per this repo's schema
   deploy convention) and for whoever builds Phase 6/7 (their own writes to `audit_log`, if any beyond what
   this migration already covers, may need their own additive grants too).
11. **NEW, discovered while empirically verifying T-6.1 (not by design/spec review — this is a runtime
   discovery about `admin.createUser()`'s real behavior, not a design/spec text mismatch like Gaps 1-10):
   `handle_new_user()` (`20260714000000_auth_pin_multirole.sql` item 3) is `AFTER INSERT ON auth.users`
   ONLY, but `supabase.auth.admin.createUser({..., app_metadata: {...}})` does NOT set `raw_app_meta_data`
   as part of that INSERT — GoTrue performs an initial INSERT (default/provider-only metadata), then a
   SEPARATE, immediately-following UPDATE that actually writes the custom `app_metadata` fields. Verified
   empirically on a disposable local stack: created 2 users via the real Admin API with
   `app_metadata:{rol:'admin'}` — `auth.users.raw_app_meta_data` correctly shows `{"rol":"admin",...}`
   post-creation, `auth.users.created_at <> updated_at` (≈13ms apart, confirming a 2-step write), YET
   `public.profiles.rol` came out `'empleado'` for BOTH — the trigger's `COALESCE(NEW.raw_app_meta_data->>
   'rol', 'empleado')` read the metadata AS IT STOOD AT INSERT TIME (before GoTrue's follow-up UPDATE ever
   ran), so it never sees a caller-supplied `rol` at all and always falls through to the `'empleado'`
   default — regardless of what `app_metadata` was actually requested. Practical impact TODAY: currently
   benign/masked, not actively exploited — `enroll-empleado`'s only `admin.createUser()` call
   (`supabase/functions/enroll-empleado/index.ts`) hardcodes `app_metadata:{rol:'empleado'}`, which
   coincides with the trigger's own fallback, so Phase 5/6's actual enrollment behavior is correct BY
   ACCIDENT, not by the mechanism working as designed. Real consequence: **this project currently has NO
   working code path that can provision a second `'admin'` profile via `admin.createUser()`** — any future
   flow attempting that (there is none today; Phase 6/7 only ever create/revoke `'empleado'` rows) would
   silently receive an `'empleado'` profile instead, a silent-downgrade correctness bug (safe direction —
   under-privilege, not escalation — but still wrong and worth fixing before it's ever relied on). This also
   means Gap 5's own verification claim ("an explicit `app_metadata.rol = 'admin'` still yields `'admin'`")
   was likely validated via a raw SQL `INSERT INTO auth.users` (single-step, metadata present atomically at
   INSERT time) rather than the real `admin.createUser()` API path (two-step) — the two are NOT equivalent
   for trigger-timing purposes, and Gap 5's claim does not hold against the real Admin API. NOT fixed in
   this apply: `handle_new_user()` was already deployed to prod in Phase 1 (out of Phase 6's scope to
   re-touch), and no in-scope flow is currently affected. Recommended fix for whoever picks this up: add a
   companion `AFTER UPDATE OF raw_app_meta_data ON auth.users FOR EACH ROW WHEN (OLD.raw_app_meta_data IS
   DISTINCT FROM NEW.raw_app_meta_data) EXECUTE FUNCTION public.sync_profile_rol()` (re-derive/UPSERT
   `profiles.rol` from the post-update value) as a new additive migration, OR confirm whether a future
   "provision a second admin" flow is even needed before spending effort on it.
