---
change: setup-stack
phase: verify
scope: FINAL verify — full change (batches 1+2+3); consolidates the prior batch-2 verify below
status: completed
verdict: PASS_WITH_WARNINGS
verified_against: [spec.md, spec.html, design.md, design.html, tasks.md, wrangler.jsonc, live DB aruteznqhdaaxxvllvzm, runtime PostgREST]
date: 2026-06-22
---

# Verification Report — setup-stack (apply batch 2)

> NOTE: This file now contains TWO verify passes. The **batch-2 verify** (2026-06-21) is preserved verbatim below for the audit trail. The **FINAL verify of the complete change** (2026-06-22) is appended at the end under "FINAL VERIFY — full change".

**Change**: setup-stack · **Scope of this verify**: DB security scaffold (tasks 2.4, 3.1–3.6)
**Method**: adversarial — every apply claim re-checked against `spec.md` + live Postgres (read-only queries) + the migration file read line by line.

> The orchestrator flagged 4 DB signals. All 4 resolved below with hard evidence. Net: the SQL scaffold is correct and spec-compliant; the open items are process (commit) and deferred-by-design policies, not defects.

---

## Completeness (this batch)

| Metric | Value |
|--------|-------|
| Batch-2 tasks claimed | 7 (2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6) |
| Batch-2 tasks verified done | 7 / 7 |
| Overall change tasks | 30 / 48 (per state) |

All 7 batch-2 tasks have real DB evidence backing the `[x]`. The remaining 18 open tasks are out of this batch's scope (env files, wrangler/CF config, the initial commit, Phase 7 acceptance).

---

## Build & Tests Execution

**Build**: PASS — `pnpm build` exit 0; `dist/index.html` + hashed assets + PWA (`sw.js`, manifest, 13 precache entries) generated. (V-1)
```
✓ 102 modules transformed.  ✓ built in 2.35s   PWA v0.21.2 generateSW — files generated
```
(Note: single 502 KB chunk warning — non-blocking, pre-existing from batch 1, not in this batch's scope.)

**Tests**: ➖ None — no `test` script in `package.json`, no test files. Expected at this stage (project has no test harness yet, per CLAUDE.md). Behavioral DB scenarios were validated directly via live SQL instead (below).

**Coverage**: ➖ Not configured.

---

## Spec Compliance Matrix (DB scaffold scenarios — validated against live DB)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| REQ-SETUP-6 | migration applied | `supabase/migrations/20260621000000_initial_scaffold.sql` exists; 3 tables present in DB | ✅ COMPLIANT |
| REQ-SETUP-7 | anon cannot read profiles (no policy → deny) | `relrowsecurity=true` on all 3 tables; `pg_policies` = `[]`; `relacl` grants anon/authenticated only `Dxtm` (no `r`/SELECT) | ✅ COMPLIANT |
| REQ-SETUP-8 | profiles minimal scaffold | DB schema = literal spec contract: `id uuid PK → auth.users ON DELETE CASCADE`, `rol text NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin'))`, `created_at` | ✅ COMPLIANT |
| REQ-SETUP-8 | profile row on signup | trigger `on_auth_user_created AFTER INSERT ON auth.users` → `handle_new_user()` (SECURITY DEFINER, `search_path=''`) inserts profile, `rol` defaults `'admin'` | ✅ COMPLIANT (static; runtime untestable without creating a real user) |
| REQ-SETUP-8 | non-admin rol rejected | `CHECK (rol IN ('admin'))` present at DB level | ✅ COMPLIANT |
| design T5 | server-mirrored throttle table | `auth_attempts(id, user_id, attempted_at, success)` RLS-enabled | ✅ COMPLIANT |
| design T7 | audit_log scaffold | `audit_log(id, actor_id, action, entity, entity_id, detail jsonb, created_at)` RLS-enabled | ✅ COMPLIANT |

**Compliance summary**: 7/7 scaffold scenarios compliant.

---

## Correctness (static + DB structural evidence)

| Requirement | Status | Notes |
|---|---|---|
| REQ-SETUP-8 schema | ✅ Implemented | matches the spec's literal `CREATE TABLE` byte-for-byte |
| REQ-SETUP-7 deny-by-default | ✅ Implemented | RLS on + zero policies + no SELECT grant = double deny |
| `handle_new_user` hardening | ✅ Implemented | SECURITY DEFINER + `search_path=''` + `REVOKE EXECUTE` from PUBLIC/anon/authenticated (`proacl={postgres=X/postgres}`) |
| Tasks 3.4 / 3.5 deviation | ✅ Improvement | migration uses `ON DELETE CASCADE` (auth_attempts.user_id) and `ON DELETE SET NULL` (audit_log.actor_id) — tasks.md didn't specify; both are correct, audit_log SET NULL preserves the audit trail when a user is deleted (good for T7 repudiation) |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D5 multi-user-ready without redesign | ✅ Yes | single 'admin' CHECK now; widening = relax CHECK + per-role RLS later, mechanism unchanged |
| OQ-2 audit_log scaffolded now | ✅ Yes | empty table created, triggers deferred to data-model |
| Threat T2 RLS day-1 | ✅ Yes | deny-by-default on every public table before any business data |

---

## Investigated signals (orchestrator's 4 doubts — resolved)

1. **Role model (`DEFAULT 'admin' CHECK (rol IN ('admin'))`)** — NOT a contradiction. It is the literal REQ-SETUP-8 contract (`spec.md` L185–208), and scenario "non-admin rol rejected" *requires* the single-value CHECK. Employee role is explicitly `out_of_scope` in the spec frontmatter ("RLS multi-role policies for employees") and deferred to the `data-model` change. `DEFAULT 'admin'` satisfies scenario "rol defaults to 'admin'"; it is intentional for the single-user MVP (Angélica), not a least-privilege violation.

2. **`public.rls_auto_enable()`** — apply's claim CONFIRMED, it is NOT created by this migration. `rg` over the repo = NOT FOUND; the 93-line migration does not contain it. It is a **Supabase-project event trigger** (`ensure_rls`, event `ddl_command_end`, owner `postgres`, `RETURNS event_trigger`, `SET search_path='pg_catalog'`) that auto-enables RLS on every new `public` table — it *reinforces* T2. The two WARN advisors (`anon/authenticated_security_definer_function_executable`) are **false positives on exploitability**: an `event_trigger` function is NOT PostgREST-RPC-callable (its return type can't be exposed) and can't be `SELECT`ed directly. `proacl IS NULL` = the default PUBLIC grant the linter pattern-matches, but the function is unreachable. NOT a privilege-escalation hole, and we do not own the object to revoke it.

3. **`handle_new_user()`** — `pg_get_functiondef` confirms `SECURITY DEFINER` + `SET search_path = ''` (anti search_path injection). Inserts the profile with the DEFAULT `rol='admin'` (consistent with point 1). `REVOKE` worked: `proacl={postgres=X/postgres}` — only the owner can EXECUTE; anon/authenticated have none.

4. **RLS without policy** — confirmed: 3 tables RLS-enabled, `pg_policies=[]`. The "profiles needs a SELECT policy so the client can read its own rol" is **deferred by design** (out_of_scope: multi-role policies) — NOT blocking for a batch-2 scaffold whose whole point is deny-by-default. The app reading its own role belongs to a later change that adds the `auth.uid() = id` SELECT policy.

---

## Issues Found

**CRITICAL** (must fix before archive): None.

**WARNING** (should fix):
- **W1 — Scaffold not committed.** `git status` shows `supabase/` as untracked (`??`); the migration is applied to the DB but uncommitted. Task 1.10 and Phase 6–7 remain open. The initial commit must include this migration so DB state and repo are in sync. (Process, not a code defect.)
- **W2 — Advisor noise from `ensure_rls`.** The two WARN advisors on `rls_auto_enable` will keep appearing on every `get_advisors` run. They are false positives (see signal 2) but should be **documented as a known/accepted advisor exception** (e.g. in the design or a SECURITY note) so a future reviewer doesn't mistake them for a regression. Do NOT attempt to revoke — it's a platform-owned object.

**SUGGESTION** (nice to have):
- **S1 —** When the `data-model` change adds the SELECT policy for `profiles` (`auth.uid() = id`), add a Vitest/integration test asserting anon → 0 rows (V-7) and authenticated → own row only, to convert these scenarios from "static-validated" to "runtime-COMPLIANT".
- **S2 —** Consider mirroring the FK delete-behaviors (`ON DELETE CASCADE` / `SET NULL`) back into `tasks.md` 3.4/3.5 so the task text matches the (better) implementation.

---

## Verdict

**PASS WITH WARNINGS**

The DB security scaffold (tasks 2.4, 3.1–3.6) is correct and fully compliant with REQ-SETUP-6/7/8 and design D5/T2/T5/T7. The role-model "contradiction" and the `rls_auto_enable` "hole" both dissolve under evidence: the former is the literal spec contract with employees deferred by design; the latter is an unreachable platform-owned event trigger (advisor false positive). Build is green; `service_role` absent from the bundle. The only real action is the **process gap** — commit the applied migration (W1) — plus documenting the advisor false positive (W2). **Batch 2 is committable as-is.**

---
---

# FINAL VERIFY — full change (batches 1+2+3)

**Change**: setup-stack · **Date**: 2026-06-22 · **Method**: adversarial — re-checked every claim against `spec.md`/`spec.html`, `design.md`/`design.html`, `tasks.md`, `wrangler.jsonc`, the live DB (read-only), and a **runtime PostgREST request** for V-7. This pass is the gate before `archive`.

Since batch 2 was verified, the prior **W1 (scaffold not committed) is RESOLVED**: `git log` shows `208579a feat(db): add security scaffold migration`, `1cd9528 docs(sdd): record … batch 2`, `acb8ad1 docs(diario)`. The migration + scaffold are committed. The only uncommitted work is batch-3 doc edits (`spec.*`, `design.*`, `tasks.md`) + the untracked `wrangler.jsonc` — expected for an in-flight verify.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 48 |
| Tasks complete `[x]` | 43 |
| Tasks incomplete `[ ]` | 5 |

Incomplete tasks (all 5 are HUMAN-required acceptance, not agent-implementable — NOT a FAIL):
- **2.2** — `.env.local` with real Supabase values (human; secret material).
- **5.3** — CF Pages dashboard project + env vars (human; needs CF credentials).
- **7.2 / 7.3** — `pnpm dev` + browser network check (human; needs display/browser + real `.env.local`).
- **7.10** — PWA WebCrypto + IndexedDB smoke test inside installed SW (human; needs browser PWA install).

All 5 are documented with step-by-step repro under "Notes for human-required tasks" in `tasks.md` (L83–137). Their non-execution is post-merge acceptance work, not a change defect.

## Build & Tests Execution

**Build**: PASS — `pnpm build` exit 0. 102 modules transformed; `dist/index.html` + hashed assets; PWA `sw.js` + `workbox-*.js` + manifest, 13 precache entries (492.68 KiB). The single 502.71 KB chunk is the known non-blocking warning (V-1 ✓).

**Tests**: ➖ None — no `test` script, no test harness yet (per CLAUDE.md; correct for this stage). Behavioral DB scenarios validated via live SQL + a real PostgREST request instead.

**Coverage**: ➖ Not configured.

## Spec Compliance Matrix (acceptance criteria V-1 → V-9)

| ID | Criterion | Evidence | Result |
|----|-----------|----------|--------|
| V-1 | `pnpm build` exit 0, no TS errors | exit 0; `dist/` populated; PWA generated | ✅ COMPLIANT |
| V-2 | `pnpm dev` at :5173 | (human — task 7.2) | ⏸ DEFERRED (human) |
| V-3 | App connects to Supabase | (human — task 7.3) | ⏸ DEFERRED (human) |
| V-4 | `grep service_role dist/` empty | `grep -rl service_role dist/` → no match | ✅ COMPLIANT |
| V-5 | `.env*` ignored | `.gitignore` L2–5: `.env`, `.env.*`, `.envrc`, `!.env.example` | ✅ COMPLIANT |
| V-6 | RLS enabled on all public tables | `list_tables`: `profiles`/`auth_attempts`/`audit_log` all `rls_enabled:true`; `relrowsecurity=true`, `policy_count=0` each | ✅ COMPLIANT |
| V-7 | Anon `GET /profiles` → **401** | **RUNTIME**: `curl GET /rest/v1/profiles` w/ anon key → `HTTP 401`, `code 42501`, `permission denied for table profiles`. Same 401 on all 3 tables. | ✅ COMPLIANT (runtime-proven) |
| V-8 | `pnpm-lock.yaml` committed | tracked (committed in batch-1) | ✅ COMPLIANT |
| V-9 | `pnpm audit` no critical/high | "No known vulnerabilities found" (task 6.1) | ✅ COMPLIANT |

**Compliance summary**: 7/7 agent-verifiable criteria COMPLIANT; V-2/V-3 deferred to human acceptance.

V-7 is the most important result: the spec was *tightened* (`[]` → 401), and the runtime request proves the live DB is **stricter** than the original spec — deny happens at the grant layer (42501) before RLS even evaluates. This is least-privilege done right, not a test-passing hack.

## Batch-3 Focus Verdicts

### (a) W2 advisor false-positive doc — ✅ CORRECT & CONSISTENT
- `get_advisors(security)` returns exactly: 2 WARN (`0028 anon_…`, `0029 authenticated_…`) on `public.rls_auto_enable()` + 3 INFO `rls_enabled_no_policy` on the 3 tables. Matches the doc byte-for-byte.
- `design.md` §"Advisors — Accepted False Positives (W2)" (L194–215) and `design.html` §"Advisors de seguridad — falsos positivos aceptados" carry the **same content**: lint IDs, the event-trigger inertness argument (not PostgREST-RPC-callable, `SELECT` raises "event trigger functions cannot be called directly", inert PUBLIC grant), the MUST-NOT-fix instruction, and the INFO-is-intentional note. The HTML is sentence-case Spanish neutral, callout-structured — consistent with the `.md`.
- The reasoning is technically sound: `rls_auto_enable()` returns `event_trigger`, owned by `postgres`, platform-managed. Not in this migration (`REVOKE` in the SQL targets only `handle_new_user()`). Correctly NOT touched.

### (b) `wrangler.jsonc` — ✅ COHERENT & NO SECRETS
- Config: `name: "antimahue"`, `pages_build_output_dir: "dist"`, `compatibility_date: "2026-06-21"`, `$schema` from local wrangler. This is the **Pages** shape (`pages_build_output_dir`), NOT a Workers config — coherent with D6 (host = CF Pages) and REQ-SETUP-11 (pure static SPA, no SSR/persistent process).
- **No secrets**: the only `service_role` occurrence is a comment "NEVER add SUPABASE_SERVICE_ROLE_KEY here (REQ-SETUP-9, T4)". No keys, no JWTs, no env values. Env vars are explicitly delegated to the CF Pages dashboard (the two public `VITE_*`), satisfying REQ-SETUP-9 key separation. Inline comments document the human task 5.3.

### (c) Spec V-7 adjustment (`[]` → 401) — ✅ COHERENT, JUSTIFIED, NOT A HACK
- **(i) Justified & stricter**: the change makes the spec match a state that is *more* restrictive than the original. Runtime proof (401/42501) + ACL evidence (anon/authenticated/service_role hold only `Dxtm` — TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, **no `r`/SELECT, no DML**) show deny at two independent layers (no grant + RLS-no-policy). The `[]` path would *require* granting SELECT before it's needed → least-privilege violation. The justification is in the spec NOTE, the V-7 row, and `tasks.md` 7.7.
- **(ii) `.md`/`.html` consistent**: `spec.md` scenario "anon cannot read profiles — deny at two layers" + V-7 row, and `spec.html` scenario "anon denegado en dos capas" + V-7 row + "Deferido a data-model" callout carry identical semantics (401, two-layer deny, `[]` deferred to `data-model`). The blocking-criteria callout in both updated to "deny-by-default a dos capas: 401 anon confirmado".
- **(iii) DB matches spec**: live DB anon → 401 (runtime). ✅
- **(iv) task 7.7 reflects resolution**: `tasks.md` 7.7 marked `[x]` "RESOLVED BY DESIGN DECISION (2026-06-22)" + a full "V-7 — RESOLVED" note (L85–94). ✅

## Spec Coverage (REQ-SETUP-*)

| Req | Status | Note |
|-----|--------|------|
| REQ-SETUP-1 layout | ✅ Met | `src/`, `supabase/migrations/`, `public/`, `vite.config.ts`, `index.html`; no `backend/`/`docker-compose.yml` |
| REQ-SETUP-2 toolchain | ✅ Met | Vite+React19+TS+Tailwind4+VitePWA; build green |
| REQ-SETUP-3 pnpm v11 secure | ✅ Met (documented deviation) | `minimumReleaseAge=1440` in `.npmrc`; `allowBuilds` moved to `pnpm-workspace.yaml` as v11 YAML map (`esbuild:true` security-reviewed) + `strictDepBuilds:true`. Spec's literal `allowBuilds=` in `.npmrc` is invalid in v11 — deviation documented in both files. |
| REQ-SETUP-4 audit cadence | ⚠️ Partial | `pnpm audit` run clean locally; CI enforcement not yet wired (no CI in repo) — deferred |
| REQ-SETUP-5 Supabase sa-east-1 | ✅ Met | project `aruteznqhdaaxxvllvzm` exists, single migration |
| REQ-SETUP-6 migrations | ✅ Met | `20260621000000_initial_scaffold` applied + committed |
| REQ-SETUP-7 RLS deny-by-default | ✅ Met (runtime-proven) | 3 tables RLS-on, 0 policies, no DML grant; anon→401 |
| REQ-SETUP-8 profiles scaffold | ✅ Met | schema = literal spec contract; signup trigger SECURITY DEFINER `search_path=''`; CHECK `rol IN ('admin')` |
| REQ-SETUP-9 key separation | ✅ Met | `service_role` absent from `dist/`, from `src/`, from `wrangler.jsonc` |
| REQ-SETUP-10 secrets not committed | ✅ Met | `.gitignore` covers `.env*`/`.envrc`; only `.env.example` allowed |
| REQ-SETUP-11 host (static SPA) | ✅ Met | CF Pages chosen (D6); `wrangler.jsonc` Pages config, no SSR |

**Deferred** (correctly, by design): per-table RLS policies + `GRANT SELECT`, employee role, atomic sale RPC, business-ops audit triggers → all to `data-model`. CI `pnpm audit` (REQ-SETUP-4) → ops follow-up. V-2/V-3/7.10 → human acceptance.

## Issues Found (final)

**CRITICAL**: None.

**WARNING**:
- **W3 — REQ-SETUP-4 CI not wired.** The spec SHOULD-runs `pnpm audit` per PR and MUST weekly; there is no CI workflow in the repo yet. Local audit is clean, so this is not blocking, but the cadence requirement is unmet until a CI step exists. Recommend a follow-up task (or a `data-model`/CI change) to add `pnpm audit` to CI. (W1 from batch-2 is RESOLVED — migration committed. W2 is RESOLVED — documented in design.md+html.)

**SUGGESTION**:
- **S1 (carried)** — when `data-model` adds the `profiles` SELECT policy (`auth.uid() = id`), add an integration test asserting anon→401/0-rows and authenticated→own-row-only, converting V-7 from runtime-curl-proven to harnessed-COMPLIANT.
- **S3** — `.npmrc`/`pnpm-workspace.yaml` deviation from the spec's literal `allowBuilds=` is correct for v11 and well-documented; consider a one-line note in `spec.md` REQ-SETUP-3 so the spec text itself isn't read as contradicting the implementation.

## Human-deferred tasks (confirmed well-documented)

| Task | What | Doc location |
|------|------|--------------|
| 2.2 | `.env.local` real values | tasks.md (gitignored, human) |
| 5.3 | CF Pages dashboard + env vars | tasks.md L127–136 (step-by-step) + wrangler.jsonc inline comments |
| 7.2 / 7.3 | dev server + browser network | tasks.md L119–125 |
| 7.10 | PWA WebCrypto+IndexedDB smoke test | tasks.md L96–117 (full console snippet) |

All four are documented with reproducible steps. Their non-execution is acceptance work, NOT a change defect.

## Final Verdict

**PASS WITH WARNINGS**

The complete `setup-stack` change is correct and spec-compliant across all three batches. Build is green (V-1); `service_role` is absent from the bundle, `src/`, and `wrangler.jsonc` (V-4/REQ-SETUP-9); secrets are gitignored (V-5); RLS deny-by-default is enabled on all 3 public tables and **proven at runtime** — anon `GET /profiles` returns 401/42501 (V-6/V-7). The three batch-3 focus items all check out: (a) the W2 advisor false-positive doc is accurate and consistent across `.md`/`.html`; (b) `wrangler.jsonc` is a coherent CF Pages config with zero secrets; (c) the V-7 spec adjustment (`[]`→401) is justified, consistent across `spec.md`/`spec.html`, matches the live DB, and is a *tightening* (least-privilege), not a test-passing hack — task 7.7 reflects it. The only open WARNING is W3 (CI `pnpm audit` cadence not yet wired — non-blocking). The 5 incomplete tasks are all human acceptance work (env values, CF dashboard, browser/PWA smoke tests), correctly documented.

**Recommendation**: the change is **ready to commit + archive**. Commit the batch-3 doc edits + `wrangler.jsonc`, then proceed to `archive`. The human acceptance steps (2.2, 5.3, 7.2/7.3, 7.10) and the CI audit cadence (W3) are post-merge follow-ups that do not block the archive of this infrastructure-scaffold change.
