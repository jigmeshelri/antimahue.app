# Auth-Pin — Archive Report

**Date**: 2026-07-15
**Status**: Archived with verify PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 2 SUGGESTION)
**Deployed**: Production (`aruteznqhdaaxxvllvzm`, sa-east-1) — 8/8 migrations confirmed live

## Cycle Summary

The second MVP change of Antimahue completed its full SDD cycle:
- ✅ **Explore/Proposal** → PIN unlock (local-only, PBKDF2 600k) + admin/empleado roles + revocation, scoped against data-model's day-one-inert admin-only RLS
- ✅ **Specs** → 3 delta specs: `setup-stack` (REQ-SETUP-8 MODIFIED), `seguridad` (REQ-AP-SEG-1..5 ADDED), `auth` (REQ-AUTH-1..4, new domain)
- ✅ **Design** → migration SQL for `profiles.activo`, `is_active()`, `enroll-empleado`/`actualizar_activo_perfil`, self-revoke guard, client PIN vault architecture (DD-7/DD-8)
- ✅ **Tasks** → phases 0-9, closing data-model's own deferred T-5.1–T-5.5 JWT battery
- ✅ **Apply** → phases 0-9 implemented, deployed via 8 migrations + 1 Edge Function (`enroll-empleado`)
- ✅ **Verify** → 0 CRITICAL; 10/12 requirements PASS, 2 PARTIAL (REQ-AUTH-1 network-trace capture, Success Criterion #1 employee-specific prod PIN-unlock — neither a code/design defect); REQ-AP-SEG-5 JWT battery executed for real (7/7) against a local Supabase stack with genuine GoTrue JWTs; live-prod enroll→roster→revoke→self-revoke-guard cycle run against the deployed Edge Function with Angélica's own JWT, closing W-2
- ✅ **Archive** → specs consolidated, change moved to `archive/`

## Schema/Behavior Deployed

| Domain | What shipped |
|--------|--------------|
| setup-stack | `profiles.rol` CHECK widened `admin`/`empleado`; `handle_new_user()` hardened to `COALESCE(app_metadata->>'rol', 'empleado')` — least-privilege default, closing a live privilege-escalation hole found empirically during apply |
| seguridad | `profiles.activo boolean NOT NULL DEFAULT true`; `is_active()`/`is_admin()` fold `activo` into every authz path; `enroll-empleado` Edge Function (enroll + revoke, service_role); `actualizar_activo_perfil` RPC with a self-revoke guard at both the Edge Function and RPC layers; multi-role JWT verification matrix (closes data-model's deferred T-5.1–T-5.5) |
| auth (new) | Local-only PIN unlock (PBKDF2 600k, AES-GCM, zero network on daily unlock); progressive lockout with server-mirrored `auth_attempts`; client-side idle auto-lock; fresh `profiles.rol/activo` re-read on every unlock (never trusts a cached value for authz) |

**Specs consolidated to**:
- `openspec/specs/setup-stack/spec.md` — REQ-SETUP-8 replaced (MODIFIED) with the multi-role, least-privilege version. Inline note documents the mid-change correction (the first delta draft still defaulted self-signup to `'admin'`; the approved design won after apply found the live privilege-escalation hole).
- `openspec/specs/seguridad/spec.md` — REQ-AP-SEG-1 through REQ-AP-SEG-5 appended (ADDED). Two wording corrections applied per verify Discoveries D2/D3 (both explicitly recommended in the verify report, applied here because REQ-AP-SEG-5 and REQ-DM-SEG-3's embedding scenario are being finalized in this same consolidation pass):
  - REQ-DM-SEG-3's "embedded query degrades gracefully" scenario corrected from `[]` to `null` for the `producto_costos` embed (it is a to-one relationship — PK=FK — not to-many; PostgREST degrades a RLS-filtered to-one embed to an object-or-null).
  - REQ-AP-SEG-5's T-5.2 row corrected from a hypothetical value-range boundary (never implemented) to the real `is_admin()`-gated USING/WITH CHECK boundary that ships in prod.
- `openspec/specs/auth/spec.md` — **new file**, full copy of the delta (new domain, nothing to merge against). Front-matter and a verify-status note added per requirement, matching the consolidated-spec convention already used by `catalogo`/`venta`/`configuracion`.

## Known Issues & Decisions (by-design / residual)

### Advisor baseline growth: 7 → 10 WARN
- 1 pre-existing (`anon_security_definer_function_executable`, uncallable platform trigger)
- 9 `authenticated_security_definer_function_executable` (6 data-model-era + 3 new auth-pin DEFINER functions) — by-design, internal authz gates verified live
- 1 NEW: `auth_leaked_password_protection` disabled — flagged as W-4, recommend enabling (admin sets employee passwords directly via `enroll-empleado`)

### Residuals carried forward (none blocking, all recorded in verify-report.md §8)
- **W-1** — No live HAR/devtools network-trace capture of a PIN unlock (REQ-AUTH-1, Success Criterion #5). Architecture + unit tests give strong indirect assurance. Recommend before the next change that touches auth.
- **W-3** — Gap 11: `admin.createUser()`'s `app_metadata` write is a separate post-INSERT UPDATE that `handle_new_user()` never observes at trigger time — the battery's own setup had to work around it with a direct SQL promotion. No live impact today (enroll-empleado only ever requests `'empleado'`), but a genuine defect if a "provision a second admin" flow is ever built. Recommend a companion `AFTER UPDATE OF raw_app_meta_data ON auth.users` trigger before that happens.
- **W-4** — `auth_leaked_password_protection` disabled in Supabase Auth config. Recommend enabling.
- **W-5** — CORS `Access-Control-Allow-Methods` header value confirmed correct by inspection and exercised live, but no literal browser `OPTIONS` preflight was captured (a JWT-authenticated fetch does not trigger one).
- **Gap 4** — idle-lock threshold value (5 min default) still awaits explicit user confirmation. Non-blocking; mechanism itself is fully tested.
- **S-1** — `src/lib/database.types.ts` stale since Phase 1; regenerate before frontend code calls `listar_perfiles`/`actualizar_activo_perfil` directly.
- **S-2** — No component-level tests for `useIdleLock.ts`/`RequireSession`/`RequireAdmin` JSX wiring (no React Testing Library in this repo, precedent since Phase 4). Underlying pure logic is fully unit-tested.

## Traceability

| Artifact | Location |
|----------|----------|
| Proposal | `openspec/changes/archive/2026-07-15-auth-pin/proposal.md` |
| Specs (delta, pre-merge) | `openspec/changes/archive/2026-07-15-auth-pin/specs/{setup-stack,seguridad,auth}/spec.md` |
| Specs (consolidated, source of truth) | `openspec/specs/{setup-stack,seguridad,auth}/spec.md` |
| Design | `openspec/changes/archive/2026-07-15-auth-pin/design.md` |
| Tasks | `openspec/changes/archive/2026-07-15-auth-pin/tasks.md` |
| Verify Report | `openspec/changes/archive/2026-07-15-auth-pin/verify-report.md` |

## Next Change

The next active change is `color-palette-assistant` (proposal phase). No dependency on
`auth-pin`'s residuals blocks it. Before any future change touches auth or provisions a
second admin, address W-1 (network-trace capture) and W-3 (second-admin trigger fix).
