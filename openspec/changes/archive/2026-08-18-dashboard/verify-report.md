---
change: dashboard
phase: verify
status: completed
depends_on: [data-model, auth-pin, catalogo, venta]
supersedes: ~
persistence: openspec
updated_at: 2026-08-18
---

# Verification Report — dashboard

## Change

**dashboard** — pantalla principal de Antimahue: resumen del día, alertas de stock, valor de inventario y búsqueda rápida.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete | 18 |
| Tasks incomplete | 0 |

All tasks in `tasks.md` are marked `[x]`.

## Build & Tests Execution

**Lint**: ✅ Passed
```
$ eslint .
```

**Format check**: ✅ Passed
```
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

**Type check**: ✅ Passed
```
$ tsc -p tsconfig.app.json --noEmit
```

**Build**: ✅ Passed
```
$ tsc -p tsconfig.app.json && vite build
vite v6.4.3 building for production...
✓ 4691 modules transformed.
✓ built in 8.37s
```

Build emitted one non-blocking warning: the `index` chunk is ~509 kB after minification (slightly above Vite's default 500 kB chunk-size warning limit). This is pre-existing application-level bundling behavior and does not affect functionality.

**Tests**: ✅ 271 passed / ❌ 0 failed / ⚠️ 7 skipped
```
$ vitest run
Test Files  37 passed | 1 skipped (38)
     Tests  271 passed | 7 skipped (278)
```

The 7 skipped tests are `src/lib/authPinRlsBattery.test.ts`, which only runs when `RUN_LOCAL_RLS_BATTERY=1` is set against a local Supabase stack (documented project convention).

**Coverage**: ➖ Not configured

No `coverage_threshold` is set in `openspec/config.yaml` (file does not exist).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-DASH-1 — RPC `resumen_dashboard` unificado y rol-aware | admin recibe valor a costo y a venta | `src/features/dashboard/dashboardApi.test.tsx > should_return_parsed_summary_for_admin` | ✅ COMPLIANT |
| REQ-DASH-1 — RPC `resumen_dashboard` unificado y rol-aware | empleado no recibe valor a costo | `src/features/dashboard/dashboardApi.test.tsx > should_handle_null_inventory_value_for_employee` | ✅ COMPLIANT |
| REQ-DASH-2 — Ventas del día por medio de pago | una venta en efectivo y otra con transferencia | `src/features/dashboard/DashboardScreen.test.tsx > should_show_loading_state_then_render_admin_dashboard` | ✅ COMPLIANT |
| REQ-DASH-3 — Alertas de stock | producto agotado y producto bajo stock | `src/features/dashboard/components/StockAlertList.test.tsx > should_classify_agotado_and_navigate_to_product_detail` | ✅ COMPLIANT |
| REQ-DASH-4 — Clasificación de alertas | stock cero es agotado | `src/features/dashboard/dashboardUtils.test.tsx > should_return_agotado_when_stock_is_zero` | ✅ COMPLIANT |
| REQ-DASH-4 — Clasificación de alertas | stock positivo pero bajo el mínimo | `src/features/dashboard/dashboardUtils.test.tsx > should_return_bajo_when_stock_is_positive_but_at_or_below_minimum` | ✅ COMPLIANT |
| REQ-DASH-5 — Header con saludo personalizado | Angélica abre a las 9:00 (mocked) | `src/features/dashboard/components/DashboardHeader.test.tsx > should_render_greeting_and_user_name` | ✅ COMPLIANT |
| REQ-DASH-6 — Adaptación por rol | empleado no ve costo | `src/features/dashboard/DashboardScreen.test.tsx > should_hide_cost_value_for_employee` | ✅ COMPLIANT |
| REQ-DASH-7 — Búsqueda rápida | búsqueda desde dashboard | `src/features/dashboard/DashboardScreen.test.tsx > should_navigate_to_catalog_on_quick_search_submit` | ✅ COMPLIANT |
| REQ-DASH-8 — Navegación desde alertas | tocar una alerta | `src/features/dashboard/DashboardScreen.test.tsx > should_navigate_to_product_detail_when_alert_clicked` | ✅ COMPLIANT |
| REQ-DASH-UI-1 — Header terracota | header renders with greeting, app icon, bell badge | `src/features/dashboard/components/DashboardHeader.test.tsx` | ✅ COMPLIANT |
| REQ-DASH-UI-2 — Alerta strip | strip appears when alerts exist | `src/features/dashboard/components/AlertStrip.test.tsx` | ✅ COMPLIANT |
| REQ-DASH-UI-3 — Stats cards | ventas hoy + valor inventario cards render | `src/features/dashboard/DashboardScreen.test.tsx` | ✅ COMPLIANT |
| REQ-DASH-UI-4 — Desglose de pagos | four columns with values | `src/features/dashboard/components/PaymentBreakdown.test.tsx` | ✅ COMPLIANT |
| REQ-DASH-UI-5 — Lista de alertas | alerts list with badges | `src/features/dashboard/components/StockAlertList.test.tsx` | ✅ COMPLIANT |
| REQ-DASH-UI-6 — Loading y error | loading skeleton and error retry | `src/features/dashboard/DashboardScreen.test.tsx` | ✅ COMPLIANT |

**Compliance summary**: 16/16 scenarios compliant

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-DASH-1 | ✅ Implemented | `resumen_dashboard()` RPC in `supabase/migrations/20260818000000_resumen_dashboard_rpc.sql` aggregates sales, inventory value, and alerts in one call; uses `public.is_admin()` to exclude `a_costo` from non-admin payloads. |
| REQ-DASH-2 | ✅ Implemented | RPC filters `ventas` by `estado = 'confirmada'` and `timezone('America/Santiago', created_at)::date = today`; returns `total`, `cantidad`, and `por_medio_pago`. |
| REQ-DASH-3 | ✅ Implemented | RPC computes effective minimum with `COALESCE(productos.stock_minimo, configuracion.stock_minimo_default)` and returns top 10 alerts ordered by stock ascending. |
| REQ-DASH-4 | ✅ Implemented | `dashboardUtils.classifyAlert` returns `'agotado'` when `stock === 0`, otherwise `'bajo'`; used by `StockAlertList` for badge and styling. |
| REQ-DASH-5 | ✅ Implemented | `DashboardHeader` uses `greetingForHour` to show "Buenos días"/"Buenas tardes"/"Buenas noches" plus the user's display name or email local-part. |
| REQ-DASH-6 | ✅ Implemented | `DashboardScreen` only renders the cost stat when `auth.rol === 'admin'` AND `valor_inventario` is non-null; the RPC itself never returns cost data to employees. |
| REQ-DASH-7 | ✅ Implemented | `QuickSearch` navigates to `/catalogo?search=<query>` on submit. |
| REQ-DASH-8 | ✅ Implemented | `StockAlertList` items navigate to `/catalogo/:id` on click. |
| REQ-DASH-UI-1..6 | ✅ Implemented | `DashboardScreen` composes `DashboardHeader`, `AlertStrip`, `StatCard`, `PaymentBreakdown`, `QuickSearch`, `StockAlertList`, and `BottomNav`; handles loading skeleton, error retry, and role-based layout. |

## Security

| Check | Status | Notes |
|-------|--------|-------|
| RPC SECURITY DEFINER | ✅ | `resumen_dashboard()` is `SECURITY DEFINER SET search_path = ''` and rechecks auth via `public.is_admin()`. |
| Cost data hidden from employees | ✅ | `valor_inventario` JSON is `'null'::jsonb` when `NOT is_admin()`; the client never receives cost figures for non-admin roles. |
| EXECUTE grants | ✅ | `REVOKE ... FROM PUBLIC; GRANT EXECUTE TO authenticated;` mirrors the existing RPC hygiene. |

## Visual Verification

Screenshots were verified manually during development against the "Terraza" handoff:

- **Dashboard header**: terracotta background with app icon, "Buenos días, Angélica" greeting, and notification bell with badge when alerts exist.
- **Alert strip**: appears only when `alertas_stock.length > 0`, with warning icon and "Ver →" link.
- **Stats row**: "Ventas hoy" and "Valor inventario" cards side by side; admin sees an additional "Valor inventario a costo" card.
- **Payment breakdown**: four-column card with Efectivo, Transfer., Débito, Crédito and vertical dividers.
- **Quick search**: SearchInput styled like the catalog screen.
- **Stock alerts**: list of products with orange/red status dot, stock info, and "Bajo"/"Agotado" badges.
- **Bottom nav**: "Inicio" active with Home icon.

## Rollback

All changes are client-side files plus one new RPC migration. Reverting the PR restores the skeleton `DashboardScreen` and removes the new files; the RPC would remain in the database but is harmless and can be dropped in a follow-up migration if required.
