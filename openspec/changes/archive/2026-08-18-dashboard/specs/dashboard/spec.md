---
change: dashboard
phase: spec
status: pending
depends_on: proposal
supersedes: ~
persistence: openspec
domain: dashboard
tables: []
rpc: [resumen_dashboard]
---

# Dashboard — Specification

## Purpose

Pantalla principal de Antimahue: resumen del día, alertas de stock y valor de inventario. Es read-only; toda la lógica de agregación y autorización vive en el RPC `resumen_dashboard()`.

## Requirements

### Requirement: REQ-DASH-1 — RPC `resumen_dashboard` unificado y rol-aware

El sistema DEBE exponer `resumen_dashboard()` (SECURITY DEFINER, `SET search_path = ''`) que retorne un JSON con: ventas del día, valor de inventario (admin only) y alertas de stock. La función DEBE usar `public.is_admin()` para decidir si incluye `valor_inventario.a_costo`. El cliente NO DEBE enviar parámetros de autorización.

#### Scenario: admin recibe valor a costo y a venta
- GIVEN un usuario autenticado con `rol = 'admin'`
- WHEN llama a `resumen_dashboard()`
- THEN `valor_inventario` contiene `{ a_costo, a_venta }`

#### Scenario: empleado no recibe valor a costo
- GIVEN un usuario autenticado con `rol = 'empleado'`
- WHEN llama a `resumen_dashboard()`
- THEN `valor_inventario` es `null`
- AND no se ejecuta ninguna lectura de `producto_costos.costo`

### Requirement: REQ-DASH-2 — Ventas del día por medio de pago

El RPC DEBE calcular las ventas del día comercial de Santiago (`America/Santiago`) donde `estado = 'confirmada'`. Debe retornar `total` (suma), `cantidad` (count) y `por_medio_pago` (suma por cada medio con al menos una venta).

#### Scenario: una venta en efectivo y otra con transferencia
- GIVEN dos ventas confirmadas hoy: $10.000 efectivo y $5.000 transferencia
- WHEN se llama al RPC
- THEN `ventas_hoy.total = 15000`, `ventas_hoy.cantidad = 2`, `ventas_hoy.por_medio_pago` tiene `{ efectivo: 10000, transferencia: 5000 }`

#### Scenario: sin ventas hoy
- GIVEN ninguna venta confirmada hoy
- WHEN se llama al RPC
- THEN `ventas_hoy.total = 0`, `ventas_hoy.cantidad = 0`, `ventas_hoy.por_medio_pago = {}`

### Requirement: REQ-DASH-3 — Alertas de stock

El RPC DEBE listar productos donde `stock <= stock_minimo_efectivo`, ordenados por `stock ASC, nombre ASC`, limitados a 10. `stock_minimo_efectivo` se define como `COALESCE(productos.stock_minimo, configuracion.stock_minimo_default)`.

#### Scenario: producto agotado y producto bajo stock
- GIVEN producto A con `stock = 0` y mínimo 5; producto B con `stock = 2` y mínimo 5
- WHEN se llama al RPC
- THEN ambos aparecen en `alertas_stock`; A tiene stock 0, B tiene stock 2

#### Scenario: sin alertas
- GIVEN todos los productos por encima de su mínimo
- WHEN se llama al RPC
- THEN `alertas_stock = []`

### Requirement: REQ-DASH-4 — Clasificación de alertas

El frontend DEBE clasificar cada alerta como `agotado` cuando `stock = 0`, o `bajo` cuando `0 < stock <= stock_minimo`.

#### Scenario: stock cero es agotado
- GIVEN una alerta con `stock = 0`
- WHEN el componente la clasifica
- THEN el nivel es `agotado`

#### Scenario: stock positivo pero bajo el mínimo
- GIVEN una alerta con `stock = 2, stock_minimo = 5`
- WHEN el componente la clasifica
- THEN el nivel es `bajo`

### Requirement: REQ-DASH-5 — Header con saludo personalizado

La pantalla DEBE mostrar un saludo que varía según la hora local del dispositivo: "Buenos días" (06:00-11:59), "Buenas tardes" (12:00-19:59), "Buenas noches" (20:00-05:59), seguido del nombre del usuario.

#### Scenario: Angélica abre a las 9:00
- GIVEN hora local 09:30
- WHEN renderiza el header
- THEN muestra "Buenos días, Angélica"

### Requirement: REQ-DASH-6 — Adaptación por rol

La pantalla DEBE mostrar el valor a costo solo cuando `valor_inventario` no es `null`. Para empleados, el stat de costo DEBE omitirse o mostrarse como no disponible, sin intentar leer `a_costo`.

#### Scenario: empleado no ve costo
- GIVEN un usuario empleado con `valor_inventario = null`
- WHEN renderiza el dashboard
- THEN no aparece "Valor inventario a costo" ni ninguna cifra de costo

### Requirement: REQ-DASH-7 — Búsqueda rápida

El dashboard DEBE incluir un input de búsqueda que, al presionar Enter, navegue a `/catalogo?search=<query>`.

#### Scenario: búsqueda desde dashboard
- GIVEN el usuario escribe "lana" y presiona Enter
- THEN la app navega a `/catalogo?search=lana`

### Requirement: REQ-DASH-8 — Navegación desde alertas

Cada ítem de alerta DEBE ser clickeable y navegar a `/catalogo/:id` para ver el detalle del producto.

#### Scenario: tocar una alerta
- GIVEN una alerta de stock para el producto X
- WHEN el usuario toca el ítem
- THEN navega a `/catalogo/<id-de-X>`

## UI Requirements

Hereda el handoff "Terraza" (`docs/design_handoff_antimahue/README.md` §02 · Dashboard).

### Requirement: REQ-DASH-UI-1 — Header terracota

El header DEBE tener fondo terracota, icono de app 36×36, saludo + nombre, y botón de campana con badge rojo cuando `alertas_stock.length > 0`.

### Requirement: REQ-DASH-UI-2 — Alerta strip

Cuando existan alertas, DEBE mostrarse un strip con fondo terracota-alert, ícono `WarningCircle`, texto "Tienes productos con stock bajo" y link "Ver →" que navega a `/catalogo`.

### Requirement: REQ-DASH-UI-3 — Stats cards

DEBEN mostrarse al menos dos tarjetas: "Ventas hoy" (total + cantidad de ventas) y "Valor inventario" (a precio de venta; a costo solo admin). Layout en fila 2 tarjetas, `flex:1` cada una.

### Requirement: REQ-DASH-UI-4 — Desglose de pagos

DEBE mostrarse una tarjeta ancha con 4 columnas (Efectivo, Transferencia, Débito, Crédito) separadas por divisores verticales. Medios sin ventas muestran `$0`.

### Requirement: REQ-DASH-UI-5 — Lista de alertas

DEBE mostrar hasta 10 alertas con badge de estado. Si no hay alertas, mostrar empty state amigable: "No hay alertas de stock".

### Requirement: REQ-DASH-UI-6 — Loading y error

Durante la carga DEBE mostrarse un estado skeleton o spinner. Si la llamada falla, DEBE mostrar un mensaje de error y un botón "Reintentar".

## Security

- `resumen_dashboard` DEBE ser SECURITY DEFINER para poder leer `producto_costos` sin depender de RLS por fila.
- `a_costo` solo se calcula para admin.
- `REVOKE EXECUTE ... FROM PUBLIC` y `GRANT EXECUTE TO authenticated` como los demás RPCs.
