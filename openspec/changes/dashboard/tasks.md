---
change: dashboard
phase: tasks
status: ready
depends_on: [proposal, specs, design]
persistence: openspec
sequencing_source: "design.md §6 session plan"
phase_count: 3
session_count: 3
task_count: 18
progress: "18/18"
updated_at: 2026-08-18
---

# Tasks: dashboard — pantalla principal

El apply se divide en **3 sesiones acotadas** para no repetir el problema de contexto de `venta`. Cada sesión es independiente y deja el repo verde.

**Gate por sesión:** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

---

## Sesión 1 — Foundation: schema + API + types + utils (TDD)

Objetivo: todo lo que no tiene UI. Al terminar, el dashboard aún no se ve distinto, pero el contrato de datos está listo y testeado.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| S1-T-1 | Migration: crear RPC `resumen_dashboard()` con ventas del día (Santiago), valor inventario admin-only, alertas top 10. | `supabase/migrations/20260818000000_resumen_dashboard_rpc.sql` | REQ-DASH-1, REQ-DASH-2, REQ-DASH-3 | `supabase db reset` local opcional; SQL validado | [x] |
| S1-T-2 | Actualizar `src/lib/database.types.ts` con tipo del RPC. | `src/lib/database.types.ts` | REQ-DASH-1 | typecheck green | [x] |
| S1-T-3 | Crear `dashboardTypes.ts` con `DashboardSummary`, `VentasHoy`, `ValorInventario`, `StockAlert`, `AlertLevel`, `MedioPago`. | `src/features/dashboard/dashboardTypes.ts` | design.md §3 | typecheck green | [x] |
| S1-T-4 | RED: tests `dashboardApi.fetchDashboardSummary` mockeando Supabase — parseo correcto del JSON, `valor_inventario` puede ser null, error propagado. | `src/features/dashboard/dashboardApi.test.ts` | design.md §3 | tests fail | [x] |
| S1-T-5 | GREEN: implementar `dashboardApi.ts`. | `src/features/dashboard/dashboardApi.ts` | design.md §3 | S1-T-4 pasa | [x] |
| S1-T-6 | RED: tests `dashboardUtils` — `classifyAlert` (agotado/bajo), `completePaymentBreakdown` completa 4 medios, `greetingForHour` (mañana/tarde/noche). | `src/features/dashboard/dashboardUtils.test.ts` | REQ-DASH-4, REQ-DASH-5 | tests fail | [x] |
| S1-T-7 | GREEN: implementar `dashboardUtils.ts`. | `src/features/dashboard/dashboardUtils.ts` | REQ-DASH-4, REQ-DASH-5 | S1-T-6 pasa | [x] |
| S1-T-8 | Gate: lint + format + typecheck + test + build green. | — | — | cinco gates green | [x] |

**Commit sugerido:** `feat(dashboard): add resumen_dashboard RPC and API layer`

---

## Sesión 2 — UI Components

Objetivo: componentes puros y testeados, sin conectar al screen aún.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| S2-T-1 | Crear `DashboardHeader` con saludo dinámico, icono app, campana + badge. | `src/features/dashboard/components/DashboardHeader.tsx` | REQ-DASH-UI-1, REQ-DASH-5 | test + snapshot visual manual | [x] |
| S2-T-2 | Test `DashboardHeader`: saludo según hora, nombre, badge según alertas. | `src/features/dashboard/components/DashboardHeader.test.tsx` | REQ-DASH-UI-1 | tests pass | [x] |
| S2-T-3 | Crear `StatCard` reutilizable. | `src/features/dashboard/components/StatCard.tsx` | REQ-DASH-UI-3 | test | [x] |
| S2-T-4 | Crear `PaymentBreakdown` con 4 columnas y divisores. | `src/features/dashboard/components/PaymentBreakdown.tsx` | REQ-DASH-UI-4 | test | [x] |
| S2-T-5 | Crear `StockAlertList` con clasificación agotado/bajo y navegación. | `src/features/dashboard/components/StockAlertList.tsx` | REQ-DASH-3, REQ-DASH-4, REQ-DASH-8, REQ-DASH-UI-5 | test | [x] |
| S2-T-6 | Crear `QuickSearch` que navega a `/catalogo?search=...`. | `src/features/dashboard/components/QuickSearch.tsx` | REQ-DASH-7 | test | [x] |
| S2-T-7 | Crear `AlertStrip` condicional con link a catálogo. | `src/features/dashboard/components/AlertStrip.tsx` | REQ-DASH-UI-2 | test | [x] |
| S2-T-8 | Gate: lint + format + typecheck + test + build green. | — | — | cinco gates green | [x] |

**Commit sugerido:** `feat(dashboard): add dashboard UI components`

---

## Sesión 3 — Screen integration + Verify

Objetivo: armar `DashboardScreen`, tests de screen, verify report y PR.

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| S3-T-1 | Reescribir `DashboardScreen.tsx`: carga de datos, estados loading/error/empty, layout handoff, refresh manual, adaptación por rol. | `src/features/dashboard/DashboardScreen.tsx` | design.md §4, REQ-DASH-UI-1..6 | visual manual | [x] |
| S3-T-2 | Screen test: loading, datos admin, datos empleado, error, refresh, navegación desde alertas y búsqueda. | `src/features/dashboard/DashboardScreen.test.tsx` | REQ-DASH-6, REQ-DASH-7, REQ-DASH-8 | tests pass | [x] |
| S3-T-3 | Agregar `src/features/dashboard/components/index.ts` si aplica. | `src/features/dashboard/components/index.ts` | — | typecheck green | [x] |
| S3-T-4 | Actualizar `openspec/changes/dashboard/state.yaml` a fase `apply: completed`. | `openspec/changes/dashboard/state.yaml` | — | — [x] |
| S3-T-5 | Generar `verify-report.md` con gates y screenshots descriptivos. | `openspec/changes/dashboard/verify-report.md` | — | — | [x] |
| S3-T-6 | Gate final: lint, format, typecheck, test, build. | — | — | cinco gates green | [x] |
| S3-T-7 | Crear PR a `main` con commits atómicos por sesión. | — | AGENTS.md | PR #47 creado; CI en ejecución | [x] |

**Commits sugeridos:**
- `feat(dashboard): wire DashboardScreen with data and role adaptation`
- `test(dashboard): add DashboardScreen integration tests`
- `docs(dashboard): add verify report and update openspec state`

---

## Notas de sesión

- Si una sesión se corta por contexto, se puede retomar exactamente donde quedó porque cada una tiene gate propio.
- No se mezclan tareas de sesiones distintas en un mismo commit.
- Al finalizar cada sesión se corre el gate correspondiente; no se posterga todo al final.
