---
change: dashboard
phase: proposal
status: pending
depends_on: [data-model, auth-pin, catalogo, venta]
supersedes: ~
persistence: openspec
updated_at: 2026-08-18
---

# Proposal: dashboard — pantalla principal (Antimahue MVP)

## Intent

Entregar la **pantalla de inicio** que Angélica ve apenas desbloquea la app: un resumen del día, alertas de stock, valor del inventario y desglose de ventas. Es la superficie más visible del producto y la que mejor le permite "mostrarle más de la aplicación" a Angélica sin entrar a flujos operativos.

El change aprovecha el backend ya LIVE (`ventas`, `venta_items`, `productos`, `producto_costos`, `configuracion`, RLS/RPC) y se enfoca en un **read-only dashboard** con autorización por rol: el valor del inventario a costo solo se muestra a admin; empleados ven ventas y alertas, pero nunca costos ni margen.

## Scope

### In scope
- `DashboardScreen` real en `/dashboard` siguiendo el handoff "Terraza" (header terracota con saludo, alerta strip, stats, desglose de pagos, lista de alertas de stock).
- Nuevo RPC `resumen_dashboard()` que entrega todo en una sola llamada y aplica la autorización por rol server-side.
- API layer `dashboardApi.ts`, tipos `dashboardTypes.ts` y utilidades puras `dashboardUtils.ts` (TDD).
- Componentes reutilizables bajo `src/features/dashboard/components/`: `DashboardHeader`, `StatCard`, `PaymentBreakdown`, `StockAlertList`, `QuickSearch`.
- Adaptación por rol: empleados no ven valor a costo ni margen.
- Tests unitarios para API, utils y componentes; screen test para `DashboardScreen`.

### Out of scope
- Notificaciones push o centro de notificaciones real — el botón de campana es un affordance visual con badge de alertas pendientes.
- Gráficos históricos o reportes por período — solo "ventas del día".
- Edición de productos o ajuste de stock desde el dashboard — redirige a catálogo.
- Realtime/live updates automáticas — se recarga al montar y con pull-to-refresh/manual refresh.
- Secuencia de ticket/folio.

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Backend contract | **Nuevo RPC `resumen_dashboard()`** SECURITY DEFINER, rol-aware, un solo round-trip | Múltiples queries PostgREST desde el cliente; lógica de autorización en el frontend |
| D2 | Valor de inventario a costo | **Solo admin vía RPC**; empleados reciben `valor_inventario: null` | Cliente decide ocultar costo (menos seguro); nuevo campo en productos |
| D3 | Stock mínimo efectivo | **COALESCE(productos.stock_minimo, configuracion.stock_minimo_default)** resuelto en SQL | Calcular en frontend; duplicar lógica de negocio |
| D4 | Alertas de stock | **Dos niveles**: `agotado` (stock = 0) y `bajo` (0 < stock <= mínimo) | Un solo nivel; usar solo stock mínimo sin distinguir agotado |
| D5 | Búsqueda rápida | **Input que navega a `/catalogo?search=...`** al presionar Enter; reusa catálogo existente | Implementar búsqueda inline en dashboard |
| D6 | Pull-to-refresh | **Botón de refresh explícito** en header + recarga al montar | Librería de pull-to-refresh; Realtime |
| D7 | Fecha "del día" | **Zona horaria de Santiago de Chile (`America/Santiago`)** en el RPC; el cliente no ajusta | Fecha UTC; fecha local del navegador (inconsistente entre dispositivos) |
| D8 | Caché | **Sin caché**; cada visita al dashboard refresca desde el servidor | Caché local con TTL; stale data |

### D1 — RPC unificado (MUST)
Un solo RPC reduce latencia en móvil y centraliza la autorización. El cliente envía solo el rol implícito (por sesión); el servidor usa `public.is_admin()` para decidir si incluye `valor_inventario.a_costo`.

### D2 — Costo oculto por construcción (MUST)
El campo `a_costo` se omite del JSON de retorno para no-admin. El frontend nunca recibe el dato, evitando filtraciones por errores de render condicional.

### D7 — Zona horaria Santiago (MUST)
Las ventas del día deben coincidir con el día comercial de Angélica, no con UTC. El RPC usa `timezone('America/Santiago', now())::date` para definir "hoy".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/dashboard/DashboardScreen.tsx` | Modified | Skeleton → dashboard real con datos. |
| `src/features/dashboard/dashboardApi.ts` | New | Wrapper del RPC `resumen_dashboard`. |
| `src/features/dashboard/dashboardTypes.ts` | New | Tipos del resumen, alertas, medios de pago. |
| `src/features/dashboard/dashboardUtils.ts` | New | Utilidades puras: clasificación de alertas, formatters. |
| `src/features/dashboard/components/*` | New | Header, stat cards, desglose de pagos, lista de alertas, búsqueda rápida. |
| `supabase/migrations/` | New | Migration con RPC `resumen_dashboard()` + index helper opcional. |
| `src/lib/database.types.ts` | Modified | Agregar tipo del RPC `resumen_dashboard`. |
| `openspec/changes/dashboard/` | New | Artefactos SDD del change. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | RPC retorna datos sensibles a empleados si el filtro de rol falla | Low | D2: `a_costo` se excluye en el `SELECT` para no-admin; tests de API con ambos roles. |
| R2 | Zona horaria inconsistente entre cliente y servidor | Low | D7: toda la lógica de "hoy" vive en el RPC con `America/Santiago`. |
| R3 | Dashboard vacío el primer día sin ventas | Med | Empty states amigables; stats muestran `$0` y `0 ventas`. |
| R4 | Muchos productos bajo stock ralentizan la lista | Low | Limitar alertas a las primeras N (ej. 10) con "Ver todo" que navega a catálogo filtrado. |
| R5 | Scope crece hacia reportes avanzados | Med | Declarar explícitamente out of scope historial y gráficos. |

## Rollback Plan

El change agrega un RPC nuevo y archivos frontend. Rollback = revertir el PR; el skeleton del dashboard vuelve. El RPC quedaría huérfano en la base de datos pero no afecta datos existentes; si es necesario, eliminarlo en una migration posterior.

## Dependencies

- `data-model` (archived, LIVE) — tablas, RLS, `is_admin()`.
- `auth-pin` (archived, LIVE) — roles, sesión, `$auth`.
- `catalogo` (archived, LIVE) — productos, búsqueda, navegación a catálogo.
- `venta` (archived, LIVE) — ventas confirmadas, medios de pago.

## Success Criteria

- [ ] Admin ve saludo, ventas del día, desglose por medio de pago, valor de inventario a costo y a precio de venta, y alertas de stock.
- [ ] Empleado ve el mismo dashboard excepto valor a costo (oculto por el RPC, no solo por CSS).
- [ ] Dashboard se ajusta al handoff "Terraza" (colores, tipografía, espaciado, componentes).
- [ ] Empty states y estados de carga son visibles y amigables.
- [ ] CI green: lint, format:check, typecheck, test, build.
- [ ] Change documentado y archivado en `openspec/`.
