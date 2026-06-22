---
change: setup-stack
phase: verify
scope: apply batch 2 (DB security scaffold — tasks 2.4, 3.1–3.6)
status: completed
verdict: PASS_WITH_WARNINGS
verified_against: [spec.md, design.md, tasks.md, live DB aruteznqhdaaxxvllvzm]
date: 2026-06-21
---

# Verification Report — setup-stack (apply batch 2)

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
