---
change: auth-pin
phase: verify
status: completed
verdict: PASS_WITH_WARNINGS
severity_count: { critical: 0, warning: 4, suggestion: 2 }
req_summary: { total: 12, pass: 10, partial: 2, fail: 0 }
success_criteria_summary: { total: 8, pass: 6, partial: 2, fail: 0 }
battery_result: { total: 7, pass: 7, fail: 0, skipped: 0, executed_against: local-stack }
prod_enroll_revoke_cycle: { status: verified, http: "enroll 200 / roster 200 / revoke 200 / self-revoke 400", audit_rows: [enroll_empleado, revoke_empleado], self_revoke_guard: live-prod-confirmed, cleanup: baseline-restored }
depends_on: [proposal, specs, design, tasks]
persistence: openspec
project_ref: aruteznqhdaaxxvllvzm
prod_migrations_confirmed: 8
gates: { lint: pass, format_check: pass, typecheck: pass, test: "83 passed (incl. 7 battery)", build: pass }
verified_at: "2026-07-15T02:00Z–03:10Z"
updated_at: "2026-07-15"
---

# Verify report: auth-pin — PIN unlock + admin/empleado roles

## Verdict

**PASS WITH WARNINGS.** 0 CRITICAL. All 8 migrations present in prod with filename-matching
versions; RLS policies, RPC bodies (incl. the `is_active()`/`is_admin()` activo-fold and the
`actualizar_activo_perfil` self-revoke guard), and grants match design exactly, confirmed via
read-only inspection of the live project. The REQ-AP-SEG-5 JWT battery (T-9.3), scaffolded as
`it.skip` since Phase 1, now executes for REAL against a disposable local Supabase stack with
genuine GoTrue-issued JWTs for four real actors (admin, active empleado, revoked empleado,
anon) — 7/7 rows pass, 0 skipped, 0 failed. All five gates green (lint, format:check, typecheck,
test — 83 passed including the un-skipped battery —, build). 4 WARNINGs, none blocking archive;
2 SUGGESTIONs.

**W-2 CLOSED (2026-07-15, orchestrator).** The one substantive gap this report raised — the
enroll→revoke flow left no persistent trace in PROD, so the relayed "real user tested it end-to-end
against prod" claim was uncorroborated — has since been closed by a real, reversible prod cycle
(Angélica's live JWT via password grant against `aruteznqhdaaxxvllvzm`): enroll via the deployed
Edge Function → 200 (test employee `rol=empleado`); GET roster → 200 (both Angélica + the test
employee); PATCH revoke → 200 (`profiles.activo=false`); `audit_log` recorded `enroll_empleado`
+ `revoke_empleado`; **self-revoke guard confirmed AGAINST LIVE PROD** (Angélica revoking herself
→ 400 `cannot_self_target`) — REQ-AP-SEG-4a now has live-prod evidence, not just local + code
inspection; cleanup verified prod back to exact baseline (1 profile, 1 auth user, 1 `audit_log`
row = `bootstrap_admin` only, 0 sessions). The blind check on persistent prod state did its job:
the claim WAS overstated, and it is now genuinely closed. Remaining WARNINGs (W-1, W-3, W-4, W-5)
are lower-severity residuals, none blocking archive.

## 1. Battery execution (T-9.3) — PASS, real JWTs, local stack only

`src/lib/authPinRlsBattery.test.ts` un-skipped. Gated behind `RUN_LOCAL_RLS_BATTERY=1` (CI has no
Supabase service, so the suite reports SKIPPED there, honestly — not a permanent skip, not a
fake pass). Executed against a disposable `supabase start` stack (never prod):

```
RUN_LOCAL_RLS_BATTERY=1 pnpm exec vitest run authPinRlsBattery
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Actor provisioning (`beforeAll`): 3 fresh `auth.users` rows via the service-role Admin API
(admin, empleado-activo, empleado-revocado), each signed in via a raw GoTrue password-grant
`fetch` (deliberately NOT `supabase-js`'s own `signInWithPassword` — see Discovery D1 below),
producing genuine JWTs attached as explicit `Authorization` headers per actor client (same
pattern `enroll-empleado`'s own `callerClient` uses in prod). Two fixtures needed a direct
superuser SQL connection (`pg`, new devDependency, test-only, never imported by app code — no
lifecycle scripts, `pnpm add -D pg @types/pg` clean under `minimumReleaseAge=1440`):
promoting the admin actor's `profiles.rol` (Gap 11 workaround — `admin.createUser()`'s
`app_metadata` write is a separate post-INSERT UPDATE, so `handle_new_user()` never observes it
at trigger time) and flipping the revoked actor's `activo` **after** it already held a valid
session (proves REQ-AP-SEG-2's "denied on the very next request, independent of access-token
expiry" property for real, not by construction). Two products seeded via the real admin-gated
`crear_producto` RPC; two sales confirmed via `confirmar_venta` for the non-last-sale case.

| Row | Case | Actor | Result | Notes |
|---|---|---|---|---|
| SEG-5.1 | producto_costos/proveedores SELECT | active empleado | ✅ PASS | both `[]`, `error: null` |
| SEG-5.2 | write policy WITH CHECK boundary | active admin vs empleado | ✅ PASS | see Discovery D2 — interpretation disclosed |
| SEG-5.3 | `deshacer_venta` on non-last sale | empleado | ✅ PASS | RAISE caught, stock unchanged |
| SEG-5.4 | `confirmar_venta` over stock | empleado | ✅ PASS | RAISE 'stock insuficiente', stock unchanged |
| SEG-5.5 | productos embed w/ producto_costos | active empleado | ✅ PASS | see Discovery D3 — `null`, not `[]` |
| SEG-5.6 | anon → table/RPC | anon | ✅ PASS | `42501` on both |
| SEG-5.7 | revoked empleado, still-valid JWT | revoked empleado | ✅ PASS | denied on productos/costos/proveedores/RPCs; `is_active()` false |

**Discoveries during battery implementation** (disclosed, not silently patched around):

- **D1 — GoTrue client storage singleton in Node.** Calling `supabase-js`'s own
  `signInWithPassword()` on N separate `createClient()` instances in one Node process collided:
  supabase-js's browser-oriented storage adapter falls back to ONE shared in-memory store keyed
  by `sb-<host>-auth-token` (confirmed by the SDK's own "Multiple GoTrueClient instances
  detected... same storage key" warning) — the LAST sign-in silently won for every client, so
  the "admin" client ended up authenticated as a different actor (`crear_producto` failed `solo
  admin` on the first attempt). Fixed by bypassing `signInWithPassword` entirely: a raw
  `fetch(.../auth/v1/token?grant_type=password)` captures the access token directly, then each
  actor client is built with `persistSession:false` + an explicit `Authorization` header — the
  same pattern already proven in prod by `enroll-empleado`'s own `callerClient`. This is a
  Node/test-harness artifact only; a real browser is one realm per tab, so it cannot occur in
  production (same category of finding as tasks.md Gap 7's jsdom/fake-indexeddb note).
- **D2 — SEG-5.2's spec wording doesn't literally map onto the live WITH CHECK clause.**
  `configuracion_update_admin`/`proveedores_all_admin`'s real USING/WITH CHECK predicate is the
  symmetric `is_admin()` gate (confirmed live in prod), not a value-range boundary — there is no
  "in-bounds VALUE vs out-of-bounds VALUE" case to exercise (the spec's wording is inherited
  verbatim from data-model's own illustrative text, written against a hypothetical `productos`
  UPDATE policy that was never actually implemented that way — `productos` writes only ever go
  through RPCs). The test exercises the REAL boundary this WITH CHECK enforces: an admin's
  UPDATE satisfies it (in-bounds, commits); a non-admin's UPDATE never does (out-of-bounds,
  filtered to 0 rows — the same `[]`-not-403 idiom, not an exception). Recommend correcting
  REQ-AP-SEG-5's T-5.2 row wording in a future spec revision to describe the role boundary
  literally, rather than an unimplemented value boundary.
- **D3 — `producto_costos` embed degrades to `null`, not `[]`.** `producto_costos.producto_id`
  is both PK and FK (a genuine 1:1) — PostgREST infers a TO-ONE embed (object-or-null) rather
  than a to-many array, so RLS-filtered access degrades to `null`. The spec text (inherited
  verbatim from data-model's REQ-DM-SEG-3) says `[]`. The property both requirements actually
  care about — the request succeeds (`error === null`), `productos` rows return normally, never
  a request-level error — holds; only the embedded shape differs by relationship cardinality.
  Recommend the same spec-wording correction as D2.

## 2. Prod structural confirmation (read-only MCP, `aruteznqhdaaxxvllvzm`, sa-east-1)

`list_migrations` — 8/8, versions match repo filename prefixes exactly:
`20260621000000_initial_scaffold`, `20260705000100_domain_tables`, `20260705000200_domain_rls`,
`20260705000300_domain_rpc`, `20260714000000_auth_pin_multirole`,
`20260715000000_enroll_empleado_grants`, `20260716000000_listar_perfiles_rpc`,
`20260717000000_actualizar_activo_perfil_rpc`.

`list_tables` — `profiles`: `activo boolean NOT NULL DEFAULT true` present; `rol` CHECK widened
to `ARRAY['admin','empleado']`; 1 row (Angélica, `rol='admin'`, `activo=true`,
`created_at 2026-07-15 00:52:33Z`). All 10 public tables RLS-enabled. All 7 domain tables at 0
rows (clean prod, no test data leaked in).

Function bodies (`pg_get_functiondef`), verbatim match to design.md/tasks.md:
- `handle_new_user()`: `COALESCE(NEW.raw_app_meta_data->>'rol', 'empleado')` — least-priv default live (Gap 5 resolution confirmed in prod, not just locally).
- `is_admin()` / `is_active()`: both `SECURITY DEFINER STABLE`, both AND `activo` (is_admin) / check `activo` (is_active) — REQ-AP-SEG-2 confirmed live.
- `listar_perfiles()`: `SECURITY DEFINER`, gated `WHERE (select public.is_admin())` inside the query — degrades to empty set for non-admin, matches the codebase's read-denial idiom.
- `actualizar_activo_perfil(p_perfil_id, p_activo)`: `IF NOT public.is_admin() THEN RAISE 'solo admin'` gate present; **self-revoke guard confirmed live**: `IF p_perfil_id = (select auth.uid()) THEN RAISE 'no puede modificar el estado de su propia cuenta'` — REQ-AP-SEG-4a verified in prod, not merely in source.
- `confirmar_venta` / `deshacer_venta`: both contain `is_active()` literally in their body (grepped `pg_get_functiondef`) — REQ-AP-SEG-2's write-RPC gate confirmed live.
- `crear_producto` / `actualizar_producto`: gate via `is_admin()` (which itself folds `activo`) — confirmed present, no `is_active()` literal needed (by design, not an omission).

Policies (`pg_policies`) — 9 total, identical to prod's data-model baseline except the 4 that
were re-gated: `productos_select`/`ventas_select`/`venta_items_select`/`configuracion_select`
now read `(SELECT is_active())` instead of `true`. `configuracion_update_admin` and
`proveedores_all_admin` both carry `is_admin()` on USING and WITH CHECK.

Grants — `service_role` has **zero** SELECT/UPDATE grant on `profiles` (confirmed live, matches
Gap 9/12's local-stack finding exactly) and exactly `INSERT` on `audit_log` (Gap 10's grant
migration, confirmed live). EXECUTE on `is_admin`/`is_active`/`listar_perfiles`/
`actualizar_activo_perfil`/all 4 domain RPCs: `authenticated` only, `anon` and `service_role`
both `false` (verified via `has_function_privilege`, not just ACL text).

### 2a. Live-prod enroll/revoke cycle (closes W-2, added 2026-07-15)

A real, reversible cycle was run against prod (`aruteznqhdaaxxvllvzm`) with Angélica's own live
JWT obtained via password grant — the exact daily-admin path, not service_role. This is the
piece the earlier read-only inspection could not supply (prod's persistent state showed only
`bootstrap_admin`), and it is what upgrades REQ-AP-SEG-3/4/4a from "code + local-stack E2E" to
"confirmed end-to-end in the live environment".

| Step | Call | Result |
|---|---|---|
| enroll | `POST` deployed `enroll-empleado` | 200 — test employee created, `rol='empleado'` |
| roster | `GET` deployed `enroll-empleado` | 200 — returns both Angélica (admin) + the test employee |
| revoke | `PATCH` deployed `enroll-empleado` | 200 — `profiles.activo=false` |
| audit trail | `audit_log` | `enroll_empleado` + `revoke_empleado` rows recorded for the test entity |
| **self-revoke guard (live)** | Angélica `PATCH` on her OWN id | **400 `cannot_self_target`** — REQ-AP-SEG-4a confirmed AGAINST LIVE PROD, not just local + the RPC-body inspection in §2 |
| cleanup | — | prod restored to exact baseline: 1 profile (Angélica admin/`activo=true`), 1 auth user, 1 `audit_log` row (`bootstrap_admin`), 0 sessions |

## 3. Advisors (security) — baseline growth as predicted, one NEW item

- 2 INFO `rls_enabled_no_policy` (`audit_log`, `auth_attempts`) — unchanged, accepted (deny-by-default intentional).
- 1 WARN `anon_security_definer_function_executable` (`rls_auto_enable`) — pre-existing, accepted FP (uncallable platform event_trigger).
- 9 WARN `authenticated_security_definer_function_executable` — the 6 data-model-era ones plus
  auth-pin's 3 new DEFINER functions (`is_active`, `listar_perfiles`, `actualizar_activo_perfil`)
  — all by-design (internal authz gates verified live, §2 above), accepted baseline growth
  10 total WARN → matches the trajectory data-model's own verify-report predicted ("2 → 7... a
  future change will add more").
- **NEW WARN `auth_leaked_password_protection`** — HaveIBeenPwned checking is disabled on this
  project's Auth config. Not present in any prior verify-report; newly relevant now that
  password-based logins exist for more than one hypothetical account (admin-set employee
  passwords via `enroll-empleado`). See W-4.

Performance advisors: unchanged INFO-level `unindexed_foreign_keys`/`unused_index` baseline
(0 rows in domain tables — expected, no new concern).

## 4. Spec compliance matrix

| Requirement | Verdict | Evidence |
|---|---|---|
| REQ-SETUP-8 (multi-role, least-priv signup) | ✅ PASS | CHECK widened + least-priv default confirmed live in prod; spec text itself corrected 2026-07-14 to match design.md (was the defect, not the migration) |
| REQ-AP-SEG-1 (`activo` column) | ✅ PASS | column present, `DEFAULT true`, Angélica's pre-existing row reads `true` with no explicit UPDATE — confirmed live |
| REQ-AP-SEG-2 (`activo` gate everywhere) | ✅ PASS | `is_admin()`/`is_active()` fold confirmed live; SEG-5.7 battery proves it end-to-end with a real revoked JWT against a still-valid session |
| REQ-AP-SEG-3 (`enroll-empleado` contract) | ✅ PASS | code inspected directly (auth chain order, `rol='empleado'` hardcoded server-side, audit_log insert, deleteUser compensation on audit failure) + Phase 5 local E2E; **now also confirmed live in prod** (§2a: enroll → 200, `rol='empleado'`, roster → 200, `enroll_empleado` audit row) — W-2 closed |
| REQ-AP-SEG-4 (revocation action) | ✅ PASS | `actualizar_activo_perfil` + `ban_duration` call confirmed in code and live function def; Phase 7 local E2E; **now also confirmed live in prod** (§2a: revoke → 200, `profiles.activo=false`, `revoke_empleado` audit row) — W-2 closed |
| REQ-AP-SEG-4a (self-revoke guard) | ✅ PASS | confirmed at BOTH layers AND live in prod: Edge Function `userId === actorId → 400 cannot_self_target` — Angélica self-revoking against LIVE PROD returned 400 (§2a) — plus `actualizar_activo_perfil`'s own `RAISE` on `p_perfil_id = auth.uid()` (confirmed in prod's `pg_get_functiondef`) |
| REQ-AP-SEG-5 (JWT battery) | ✅ PASS | 7/7 rows executed for real, this session, against a local stack with genuine JWTs — see §1 |
| REQ-AUTH-1 (zero-network unlock) | ⚠️ PARTIAL | architecture (DD-7 in-memory storage) + code inspection (`pinUnlock.ts`'s `attemptUnlock`, no network call in the decrypt/wrong-PIN path) + unit tests (`pinUnlock.test.ts`, "wrong PIN throws locally, zero network calls") all confirm this; **no live HAR/network-trace capture** was made this session (T-9.4 residual, see W-1) |
| REQ-AUTH-2 (lockout backoff) | ✅ PASS | `lock.test.ts` (10 cases) + code inspection of `nextLockState`/`attemptUnlock`'s catch path |
| REQ-AUTH-3 (idle auto-lock) | ✅ PASS | `idleLock.test.ts` (15 cases, pure logic w/ injected clock) + `useIdleLock.ts`/`main.tsx` wiring inspected; DOM-level walkthrough not repeated this session (no React Testing Library in this repo, precedent already flagged Phase 4/6/8) |
| REQ-AUTH-4 (fresh profile read) | ✅ PASS | `pinUnlock.ts`'s `attemptUnlock` reads `profiles.rol/activo` fresh on every unlock (code confirmed directly, lines 141-161), never trusts the vault's cached `rol` hint, gates on `activo` before setting `$auth` |

**10/12 PASS, 2/12 PARTIAL, 0/12 FAIL.**

## 5. Success Criteria (proposal.md, T-9.5)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `profiles.rol` accepts `'empleado'`; an employee row exists and authenticates via PIN unlock | ⚠️ PARTIAL | CHECK widened + mechanism proven (Phase 5 local E2E + this session's battery); the live prod cycle (§2a) created a real `'empleado'` row (then cleaned it up), so the "employee row exists in prod" half is now demonstrated — the residual is only that no employee has completed a full PIN-unlock (pairing→daily unlock) specifically in prod (the R4 real-device test was Angélica/admin); no longer a W-2 concern |
| 2 | Employee cannot read `producto_costos`/`proveedores` | ✅ PASS | SEG-5.1/5.7, this session, real JWTs |
| 3 | Admin can enroll an employee, no public self-signup path | ✅ PASS | code + grants confirmed; least-priv signup default confirmed live; **enroll flow now exercised live in prod** (§2a: 200, `rol='empleado'`) — W-2 closed |
| 4 | Admin can revoke; revoked user loses access on the NEXT request | ✅ PASS | SEG-5.7 (real revoked JWT vs a still-valid session); **plus the live-prod revoke cycle** (§2a: PATCH → 200, `activo=false`, audit row) — W-2 closed |
| 5 | PIN never travels to the server (network trace) | ⚠️ PARTIAL | architecture + unit tests strongly support this; no live HAR capture this session (W-1) |
| 6 | Wrong PIN → local decrypt failure + lockout, never a token | ✅ PASS | `pinUnlock.test.ts`, code inspection |
| 7 | data-model JWT suite T-5.1..T-5.5 executed and passing | ✅ PASS | this session, §1 — closes the deferral from data-model's own verify-report (S-B) |
| 8 | No authorization logic in `src/**` | ✅ PASS | all authz in Postgres (RLS/RPC); `src/**` route guards are explicitly UX-only (DD-8), not a violation |

**6/8 PASS, 2/8 PARTIAL, 0/8 FAIL.**

## 6. Gaps resolution (tasks.md) — explicit status

| Gap | Topic | Status |
|---|---|---|
| 1 | JWT battery slice placement | **CLOSED** this session (T-9.3) |
| 2 | Idle-lock file not enumerated | CLOSED (non-blocking, informational) |
| 3 | DD-8 hidden-cards scope | CLOSED (scope decision, not a defect) |
| 4 | Idle threshold value (5 min default) | OPEN, non-blocking — still needs user confirmation |
| 5 | `handle_new_user()` self-signup default vs spec text | **CLOSED** 2026-07-14 (spec corrected; confirmed live in prod this session) |
| 6 | `main.tsx` touched in Phase 2 | CLOSED |
| 7 | jsdom/fake-indexeddb ArrayBuffer test gotcha | CLOSED (documented, not an app bug) |
| 8 | `rol` sourcing deviation (pairing vs REQ-AUTH-4) | **CLOSED** (Phase 8's `routeGuards.test.ts` regression case + code inspection confirm no live gap) |
| 9 | design.md §4 service-role `profiles` read unimplementable | CLOSED (`is_admin()`/`listar_perfiles()` route, confirmed live) |
| 10 | `audit_log` grant gap | CLOSED (grant migration, confirmed live) |
| 11 | `admin.createUser()` two-step app_metadata / second-admin limitation | **RESIDUAL, confirmed still real this session** — the battery's own setup had to work around it with a direct SQL promotion. No live impact (enroll-empleado only ever requests `'empleado'`), but a genuine defect if a "provision a second admin" flow is ever built without the recommended `AFTER UPDATE OF raw_app_meta_data` trigger fix. See W-3. |
| 12 | `actualizar_activo_perfil` grant wall | CLOSED |
| 13 | Self-revoke guard undesigned | **CLOSED** — `specs/seguridad/spec.md` now carries REQ-AP-SEG-4a with full scenarios (was still open when tasks.md's Gap 13 text was written; the spec has since caught up) |
| 14 | CORS `Access-Control-Allow-Methods` staleness | **MOSTLY CLOSED** — code fix confirmed correct by inspection (`'GET, POST, PATCH, OPTIONS'`); the deployed function's `GET`/`POST`/`PATCH` dispatch is now exercised live in prod (§2a), so the header value it returns is the correct one. The one residual: no literal browser `OPTIONS` preflight capture (a JWT-authenticated `fetch`/password-grant call does not trigger nor enforce CORS preflight) — see W-5 |
| 15 | Prod enroll/revoke left no persistent trace (raised this session) | **CLOSED** 2026-07-15 — a real reversible prod cycle (§2a) exercised enroll→roster→revoke→self-revoke-guard against the deployed Edge Function with Angélica's live JWT, recorded `enroll_empleado`/`revoke_empleado` audit rows, and restored prod to exact baseline. W-2 downgraded to RESOLVED |

## 7. Deferred items (setup-stack/data-model) — confirmed closed

- **DM Sans self-hosted**: confirmed — `public/fonts/{dm-sans-400,500,700}.woff2` + `OFL.txt` present; `src/index.css` wires 3 `@font-face` rules; `--font-sans` references `'DM Sans'` first.
- **Voseo sweep**: confirmed — `rg` for the 8 previously-flagged voseo forms (`Probá`, `Ingresá`, `Elegí`, `Confirmá`, `Volvé`, `Esperá`, `Consultá`, `podés`) across `src/` returns zero UI-string hits (one code-COMMENT in `empleadasApi.ts` references the historical defect by name, not a live string).
- **Sole-admin bootstrap runbook**: confirmed — Angélica's profile exists in prod (`rol='admin'`, `activo=true`), with a corresponding `audit_log` row (`action='bootstrap_admin'`, `actor_id`/`entity_id` = her own id) recording the deliberate manual/seed provisioning step REQ-SETUP-8 mandates.
- **R4 (installed-PWA WebCrypto/IndexedDB smoke test)**: accepted as satisfied per orchestrator-reported evidence (a real user tested the installed PWA on a real device this session — pairing→PIN→unlock). Not independently reconstructed by this agent (no browser/device tooling available in this session's environment); Angélica's `auth.users.updated_at` (02:01Z, ~1h after her account was created) is consistent with real subsequent PIN-unlock/`refreshSession` activity, though this is circumstantial, not a direct observation.

## 8. Issues found

**CRITICAL**: None.

**RESOLVED (was WARNING)**:
- **W-2 — CLOSED 2026-07-15.** The gap was real and the blind check on persistent prod state
  caught an overstated claim: prod's `audit_log`/`auth.users` showed only `bootstrap_admin`, no
  enroll/revoke trace. The orchestrator then ran a real, reversible prod cycle (§2a) with
  Angélica's live JWT against the deployed Edge Function — enroll → 200 (`rol='empleado'`),
  roster → 200, revoke → 200 (`activo=false`), `enroll_empleado`+`revoke_empleado` audit rows
  recorded, **self-revoke guard confirmed against LIVE PROD** (Angélica → 400 `cannot_self_target`,
  giving REQ-AP-SEG-4a live-prod evidence), then cleanup restored prod to exact baseline. No
  longer a residual.

**WARNING**:
- **W-1** — T-9.4 (network-trace check) not completed this session: no HAR/devtools capture attached. Architecture (DD-7) + unit tests give strong indirect assurance (REQ-AUTH-1's "zero network calls on a PIN attempt" is unit-tested at the mock boundary and confirmed by direct code inspection), but a live capture on a real device remains the more literal form of evidence the task specifies. Non-blocking; recommend before the NEXT change that touches auth, not necessarily before this archive.
- **W-3** — Gap 11 residual (see §6) — recommend a companion `AFTER UPDATE OF raw_app_meta_data ON auth.users` trigger fix before any future flow attempts to provision a second admin via `admin.createUser()`.
- **W-4** — `auth_leaked_password_protection` disabled (new advisor finding, §3). Recommend enabling — admin sets employee passwords directly (`enroll-empleado`), so leaked-password screening protects against a real, plausible mistake (reusing a weak/breached password for a shared-phone account).
- **W-5** — CORS `Access-Control-Allow-Methods` fix (Gap 14) kept as a WARNING, downgraded in scope. The live prod cycle (§2a) now exercises the deployed function's `GET`/`POST`/`PATCH` dispatch successfully, so the function is reachable and returns its own (correct) header value in prod. The residual is narrow and specific: a JWT-authenticated `fetch`/password-grant call is NOT a CORS-preflighted request, so it neither triggers nor validates the browser `OPTIONS` preflight that `Access-Control-Allow-Methods` actually governs. Kept open because the literal thing this header controls — a real browser preflight from the SPA origin — is still uncaptured (same missing-browser-capture root cause as W-1). Low severity: the header value is correct by inspection and the function works; only the preflight-path proof is outstanding.

**SUGGESTION**:
- **S-1** — `src/lib/database.types.ts` is stale relative to schema: generated at T-1.4 (Phase 1), never regenerated after Phase 6/7's `listar_perfiles`/`actualizar_activo_perfil` migrations. No current typecheck impact (only the untyped Deno Edge Function calls them). Regenerate (`supabase gen types typescript --project-id aruteznqhdaaxxvllvzm --schema public`) before any frontend code calls these RPCs directly.
- **S-2** — `useIdleLock.ts`/`RequireSession`/`RequireAdmin` JSX wiring still lack direct component-level tests (no React Testing Library in this repo — precedent flagged since Phase 4). The underlying pure logic (`idleLock.ts`, `routeGuards.ts`) is thoroughly unit-tested; this is a coverage gap in the wiring layer only, low risk.

## 9. Gates (real execution, this session)

```
$ pnpm lint            → clean
$ pnpm format:check    → All matched files use Prettier code style!
$ pnpm typecheck       → clean
$ RUN_LOCAL_RLS_BATTERY=1 pnpm test
   Test Files  9 passed (9)
        Tests  83 passed (83)
$ pnpm build           → tsc + vite build succeeded, PWA generated (18 precache entries, 541.59 KiB)
```

Default `pnpm test` (no env var, CI parity): `8 passed | 1 skipped (9)` / `76 passed | 7 skipped (83)`
— the battery skips honestly when no local Supabase stack is available, exactly as designed.

## 10. Archive readiness

No CRITICAL findings. 10/12 requirements PASS, 2 PARTIAL (REQ-AUTH-1's live network trace and
Success Criterion #1's employee-specific PIN-unlock in prod — neither a code/design defect).
The one substantive residual this report originally raised (W-2) is now CLOSED by a real prod
enroll/revoke cycle. Remaining Gaps: one low-severity residual (#11, second-admin provisioning)
and one idle-threshold open question (#4, non-blocking); all others closed. Recommend: **proceed
to `sdd-archive`**, carrying W-1/W-3/W-4/W-5 forward as recorded residual items — none require
reopening apply, none block archive.
