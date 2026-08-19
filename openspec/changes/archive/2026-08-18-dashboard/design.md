---
change: dashboard
phase: design
status: pending
depends_on: [data-model, auth-pin, catalogo, venta]
supersedes: ~
persistence: openspec
updated_at: 2026-08-18
resolves_open_questions: [OQ-1, OQ-2, OQ-3]
design_decisions: [DD-1, DD-2, DD-3, DD-4, DD-5, DD-6, DD-7, DD-8, DD-9]
---

# Design: dashboard — pantalla principal

## 1. Technical approach

Read-only screen sobre backend LIVE. Se agrega **un solo RPC** `resumen_dashboard()` que encapsula toda la lógica de agregación y autorización. El frontend queda delgado: API layer, utilidades puras y componentes de presentación.

Arquitectura en capas, misma que `venta` y `catalogo`:
- **SQL/RPC**: aggregations + rol-aware filtering.
- **API layer**: `dashboardApi.ts` (solo mockea `@/lib/supabase`).
- **Pure utils**: `dashboardUtils.ts` (TDD) — clasificación de alertas, formatters.
- **UI components**: `src/features/dashboard/components/*`.
- **Screen**: `DashboardScreen.tsx` — contenedor que orquesta carga y errores.

## 2. Design decisions

| ID | Resolves | Decision | Rejected |
|----|----------|----------|----------|
| DD-1 | D1 | **RPC `resumen_dashboard()`** retorna `DashboardSummary` completo en una llamada | Múltiples queries desde el cliente |
| DD-2 | D2 | **Costo omitido del payload para empleados** (`valor_inventario: null` cuando `NOT is_admin()`) | Filtrar en React con `auth.rol` |
| DD-3 | D3 | **`stock_minimo_efectivo` calculado en SQL** con `COALESCE(p.stock_minimo, c.stock_minimo_default)` | Calcular en frontend |
| DD-4 | D4 | **Alertas con dos niveles**: `agotado` (stock = 0) y `bajo` (0 < stock <= mínimo), con estilos distintos | Nivel único |
| DD-5 | D5 | **QuickSearch navega a `/catalogo?search=...`** al submit | Búsqueda inline en dashboard |
| DD-6 | D6 | **Refresh manual** vía icono en header + carga al montar | Pull-to-refresh nativo; Realtime |
| DD-7 | D7 | **Fecha comercial en `America/Santiago`** resuelta en el RPC | Fecha UTC o fecha del navegador |
| DD-8 | Header | **`DashboardHeader` propio** con saludo, icono app, campana con badge de alertas (no navega aún) | Reusar `ScreenHeader` genérico |
| DD-9 | Limit | **Máximo 10 alertas en dashboard** + link "Ver todo →" a `/catalogo?alertas=true` (filtro futuro) | Renderizar todo el catálogo bajo stock |

### DD-1 — RPC `resumen_dashboard()`

```sql
CREATE OR REPLACE FUNCTION public.resumen_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hoy date := timezone('America/Santiago', now())::date;
  v_es_admin boolean := (select public.is_admin());
  v_ventas_hoy jsonb;
  v_valor_inv jsonb := 'null'::jsonb;
  v_alertas jsonb;
BEGIN
  -- ventas del día
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(total), 0),
    'cantidad', COUNT(*),
    'por_medio_pago', jsonb_object_agg(medio_pago, COALESCE(subtotal, 0))
  )
  INTO v_ventas_hoy
  FROM (
    SELECT medio_pago, SUM(total) as subtotal
    FROM public.ventas
    WHERE estado = 'confirmada'
      AND timezone('America/Santiago', created_at)::date = v_hoy
    GROUP BY medio_pago
  ) t;

  -- valor de inventario (admin only)
  IF v_es_admin THEN
    SELECT jsonb_build_object(
      'a_costo', COALESCE(SUM(p.stock * pc.costo), 0),
      'a_venta', COALESCE(SUM(p.stock * p.precio_venta), 0)
    )
    INTO v_valor_inv
    FROM public.productos p
    LEFT JOIN public.producto_costos pc ON pc.producto_id = p.id;
  END IF;

  -- alertas de stock (top 10)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'nombre', nombre,
      'stock', stock,
      'stock_minimo', stock_minimo_efectivo
    ) ORDER BY stock ASC, nombre ASC), '[]'::jsonb)
  INTO v_alertas
  FROM (
    SELECT p.id, p.nombre, p.stock,
      COALESCE(p.stock_minimo, c.stock_minimo_default) as stock_minimo_efectivo
    FROM public.productos p, public.configuracion c
    WHERE p.stock <= COALESCE(p.stock_minimo, c.stock_minimo_default)
    ORDER BY p.stock ASC, p.nombre ASC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'ventas_hoy', v_ventas_hoy,
    'valor_inventario', v_valor_inv,
    'alertas_stock', v_alertas
  );
END; $$;
```

Notas:
- `ventas_hoy.por_medio_pago` solo contendrá las claves con ventas > 0; el frontend completa los cuatro medios con `0`.
- `valor_inventario` es `null` para empleados.
- `alertas_stock` puede ser `[]`.

### DD-2 — Costo oculto por construcción

El RPC no ejecuta el `SUM` de costo si no es admin. El tipo TS refleja:

```ts
interface ValorInventario {
  a_costo: number
  a_venta: number
}

interface DashboardSummary {
  ventas_hoy: VentasHoy
  valor_inventario: ValorInventario | null
  alertas_stock: StockAlert[]
}
```

El frontend renderiza `valor_inventario.a_venta` siempre; `a_costo` solo si el objeto no es `null`.

## 3. Data model and API contracts

```ts
// src/features/dashboard/dashboardTypes.ts
export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export interface VentasHoy {
  total: number
  cantidad: number
  por_medio_pago: Partial<Record<MedioPago, number>>
}

export interface ValorInventario {
  a_costo: number
  a_venta: number
}

export interface StockAlert {
  id: string
  nombre: string
  stock: number
  stock_minimo: number
}

export interface DashboardSummary {
  ventas_hoy: VentasHoy
  valor_inventario: ValorInventario | null
  alertas_stock: StockAlert[]
}

export type AlertLevel = 'agotado' | 'bajo'
```

```ts
// src/features/dashboard/dashboardApi.ts
export async function fetchDashboardSummary(): Promise<DashboardSummary>
```

```ts
// src/features/dashboard/dashboardUtils.ts
export function classifyAlert(alert: StockAlert): AlertLevel
export function completePaymentBreakdown(
  porMedioPago: Partial<Record<MedioPago, number>>
): Record<MedioPago, number>
export function greetingForHour(date?: Date): string
export function formatCurrency(value: number): string
```

## 4. Components and screens

### DashboardHeader
- Fondo terracota `#C17B4A` (ya existe token `bg-terracota`).
- Status bar: 54px de altura implícita, contenido `px-[22px] pt-[6px] pb-[18px]`.
- Izquierda: icono app 36×36px sobre `bg-black/[0.18]` + columna:
  - label "Buenos días" 12px/400 `rgba(250,240,224,0.6)`
  - nombre 24px/700 `#FAF0E0`
- Derecha: botón campana 38×38px `bg-black/[0.14]` rounded-[11px] + badge rojo `#F5D780` si hay alertas.
- El saludo cambia según hora: "Buenos días" / "Buenas tardes" / "Buenas noches".

### StatCard
- Tarjeta `flex:1`, `bg-bg-card`, border `border-sand`, rounded-card, padding `13px 14px`.
- Icono + label 10px uppercase tracking 0.06em `text-secondary`.
- Valor 22px/700 `text-primary`.
- Subtítulo opcional 11px `text-secondary`.

### PaymentBreakdown
- Tarjeta ancha con 4 columnas (Efectivo, Transferencia, Débito, Crédito).
- Divisores verticales `1px solid #D9C3A0` entre columnas.
- Label 10px `text-secondary`, valor 16px/600 `text-primary`.

### StockAlertList
- Header "Alertas de stock" + link "Ver todo" a `/catalogo`.
- Ítems: dot de estado (naranja/rojo), nombre 13px/500, info 11px `text-secondary`, badge "Bajo"/"Agotado".
- Ítems agotados con fondo `#FEF5F2` y borde rojo suave.
- Click en ítem navega a `/catalogo/:id`.

### QuickSearch
- Input search estilo catálogo con placeholder "Buscar producto…".
- Al submit (`Enter`), navega a `/catalogo?search=<query>`.

### DashboardScreen
- Layout: `flex flex-col h-screen bg-bg-pantalla`.
- `DashboardHeader`.
- Body scrollable con alerta strip (solo si hay alertas), stats row, desglose, búsqueda rápida, alertas de stock.
- Estados:
  - `loading`: skeleton placeholders o spinner.
  - `error`: mensaje + botón reintentar.
  - `empty`: stats en `$0` y lista de alertas vacía (sin mensaje triste).
- Refresh manual en header.
- `BottomNav active="inicio"`.

## 5. Data flow

```
PinScreen unlock ──▶ /dashboard
DashboardScreen mount ──▶ fetchDashboardSummary()
  └── resumen_dashboard() (RPC)
        ├── ventas del día (confirmadas, hoy Santiago)
        ├── valor inventario (admin only)
        └── alertas stock (top 10)
  └── DashboardScreen render
        ├── DashboardHeader (saludo + badge alertas)
        ├── alerta strip (si hay alertas)
        ├── StatCards (ventas hoy, valor venta, valor costo admin)
        ├── PaymentBreakdown
        ├── QuickSearch
        ├── StockAlertList
        └── BottomNav
```

## 6. Session plan (apply split)

Para evitar quedarnos sin contexto como pasó con `venta` (26 tareas, 8 commits, dos pantallas grandes), el apply se divide en **tres sesiones acotadas**, cada una con su propio commit/PR o un commit dentro del mismo PR final.

### Sesión 1 — Foundation (schema + API + types + utils tests)
- Migration `supabase/migrations/20260818000000_resumen_dashboard_rpc.sql`.
- Actualizar `src/lib/database.types.ts`.
- Crear `src/features/dashboard/dashboardTypes.ts`.
- Crear `src/features/dashboard/dashboardApi.ts` + `dashboardApi.test.ts`.
- Crear `src/features/dashboard/dashboardUtils.ts` + `dashboardUtils.test.ts`.
- Verificar: `pnpm typecheck && pnpm test`.

### Sesión 2 — UI Components
- Crear `src/features/dashboard/components/DashboardHeader.tsx` + test.
- Crear `src/features/dashboard/components/StatCard.tsx` + test.
- Crear `src/features/dashboard/components/PaymentBreakdown.tsx` + test.
- Crear `src/features/dashboard/components/StockAlertList.tsx` + test.
- Crear `src/features/dashboard/components/QuickSearch.tsx` + test.
- Verificar: `pnpm typecheck && pnpm test`.

### Sesión 3 — Screen + Verify
- Reescribir `src/features/dashboard/DashboardScreen.tsx`.
- Crear `src/features/dashboard/DashboardScreen.test.tsx`.
- Actualizar `openspec/changes/dashboard/state.yaml` y generar `verify-report.md`.
- Verificar: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
- Crear PR a `main`.

Cada sesión debe poder cerrarse sin dejar el repo rojo.
