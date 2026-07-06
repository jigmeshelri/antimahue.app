# Data Model — Archive Report

**Date**: 2026-07-06  
**Status**: Archived with verify PASS (0 CRITICAL)  
**Deployed**: Production (PRs #17, #18, #19 merged)

## Cycle Summary

The first MVP change of Antimahue completed its full SDD cycle:
- ✅ **Explore** → identify product domains (catalogo, venta, configuracion, seguridad)
- ✅ **Proposal** → compare architectural trade-offs (table isolation, RPC atomicity, security layering)
- ✅ **Specs** → 4 delta specs (128 requirements across domains)
- ✅ **Design** → migration SQL, RLS policies, SECURITY DEFINER functions
- ✅ **Tasks** → 48 atomic tasks (schema, functions, tests, hardening)
- ✅ **Apply** → deployed to production (`aruteznqhdaaxxvllvzm`, sa-east-1)
- ✅ **Verify** → 0 CRITICAL issues (3 INFO, 5 low-risk WARN on advisors by-design)
- ✅ **Archive** → specs consolidated, change moved to archive/

## Schema Deployed

| Domain | Tables | Functions | Rows |
|--------|--------|-----------|------|
| catalogo | productos, producto_costos, proveedores | crear_producto, actualizar_producto | 3 tables + 2 RPC |
| venta | ventas, venta_items, movimientos_stock | confirmar_venta, deshacer_venta | 3 tables + 2 RPC |
| configuracion | configuracion | — | 1 table (singleton) |
| seguridad | — | is_admin() | 1 function + RLS policies |

**Specs consolidated to**: `openspec/specs/{catalogo,venta,configuracion,seguridad}/spec.md`

## Known Issues & Decisions (by-design)

### Baseline Advisors: 2 → 7 WARN
- 2 pre-existing WARNs (auth.users audit, encryption at-rest)
- 5 new WARNs (0029 rules on SECURITY DEFINER functions) — by-design, gates verified in design phase
- 0 CRITICAL, 3 INFO (session/prepared statement cache checks)

### Hardening Residuals
Post-implementation discovered minor residual constraints. Low priority — see follow-ups.

## Follow-ups (inherit future changes)

### (A) Hardening Migration W-A
**Priority**: LOW  
**Scope**: Cleanup of grant privilege edges discovered post-apply  
Residual `REVOKE TRUNCATE/REFERENCES/TRIGGER` and `ALTER DEFAULT PRIVILEGES` not fully hardened in the initial migration. Fine for MVP (money/stock integrity enforced at RPC level), but a follow-up hardening pass should:
- [ ] Audit all remaining DEFAULT PRIVILEGES
- [ ] REVOKE unneeded top-level grants on `public` schema
- [ ] Lock down any dangling EXECUTE grants on non-definer functions

**Owned by**: Next hardening change or as part of T-6 (auth-pin multi-role)

---

### (B) TypeScript Types from Supabase (T-6.1)
**Priority**: HIGH  
**Scope**: Code generation before first UI feature  
The `supabase gen types` CLI must run and its output (TsRequest, TsResponse, etc.) checked into the repo **before** the `color-palette-assistant` or `cart-checkout` changes write component code. This ensures:
- [ ] All table/RPC signatures are type-safe in the frontend
- [ ] No `any` types in API calls
- [ ] Mismatch between spec and TypeScript caught at build time

**Reference**: `T-6.1` in tasks.md  
**Owner**: UI framework change (likely color-palette-assistant or cart-checkout, phase `design`)

---

### (C) JWT Runtime Suite (T-5.1…T-5.5)
**Priority**: HIGH  
**Scope**: Verify auth-pin / multi-role behavior end-to-end  
The JWT embedding tests deferred from `T-5.1` through `T-5.5` (raw `[]` vs. 403 on cost tables, admin vs. vendedor role enforcement, `is_admin()` recursion-free evaluation) MUST pass before shipping any feature that reads restricted data.

Test scenario: `GET /producto_costos?select=*` as vendedor → expects `[]` (RLS silently filters), never a 403.

**Owned by**: `auth-pin` and `multi-role` changes (phases `apply` → `verify`)

---

### (D) Advisor Baseline Refresh
**Priority**: LOW  
**Scope**: Accept 7-WARN baseline as new normal  
Update CI/CD gates and advisory thresholds: the 5 new `0029` warnings (SECURITY DEFINER strictness checks) are by-design and have been audited. Next Supabase advisory run against this schema should expect WARN ≥ 7.

---

## Traceability

| Artifact | Location |
|----------|----------|
| Proposal | `openspec/changes/archive/2026-07-06-data-model/proposal.md` |
| Specs | `openspec/specs/{catalogo,venta,configuracion,seguridad}/spec.md` |
| Design | `openspec/changes/archive/2026-07-06-data-model/design.md` |
| Tasks | `openspec/changes/archive/2026-07-06-data-model/tasks.md` |
| Verify Report | `openspec/changes/archive/2026-07-06-data-model/verify-report.md` |

---

## Next Change

The archived schema is stable for feature work. The next active change is `color-palette-assistant` (currently in `proposal` phase):
- [ ] Ensure TS types are generated before UI code touches the schema
- [ ] Audit RPC signatures match spec requirements
- [ ] Plan post-launch: JWT test suite (T-5), hardening pass (T-6 partial)
