---
change: data-model
phase: explore
status: completed
depends_on: ~
supersedes: ~
persistence: openspec
---

# Exploration: Data Model — schema completo del dominio MVP (Antimahue)

## Estado actual (verificado, no asumido)

Se verificó el proyecto Supabase real (`aruteznqhdaaxxvllvzm`, `sa-east-1`, Postgres 17.6) vía MCP, no solo el archivo de migración:

- Tablas vivas: `public.profiles`, `public.auth_attempts`, `public.audit_log` — coinciden 1:1 con `supabase/migrations/20260621000000_initial_scaffold.sql`. 0 filas en las tres (esperado, MVP recién arrancado).
- RLS habilitado en las tres, **sin policies** (deny-by-default correcto, confirmado por `get_advisors(security)`: 3 INFO `rls_enabled_no_policy`, exactamente las 3 tablas — intencional, ya documentado en `openspec/specs/setup-stack/spec.md` REQ-SETUP-7/V-7).
- 2 WARN pre-existentes (`rls_auto_enable` SECURITY DEFINER callable por anon/authenticated) son un event trigger de Supabase, no un objeto nuestro — ya aceptados como falso positivo en `verify-report.md` de `setup-stack`. No hay hallazgos de seguridad nuevos pendientes antes de empezar `data-model`.
- Extensiones relevantes ya instaladas: `pgcrypto` (1.3, para `gen_random_uuid()`, ya usado en `auth_attempts`/`audit_log`), `uuid-ossp`, `pg_stat_statements`. Extensiones disponibles pero **no instaladas**: `vector` (pgvector 0.8.0) y `cube`/`earthdistance` — relevantes solo si `color-palette-assistant` necesitara en el futuro búsqueda KNN de color server-side; NO se instalan en este change (YAGNI, el proposal de esa feature ya define el cálculo de distancia en frontend).
- Solo hay una migración aplicada (`20260621000000_initial_scaffold`), confirmado con `list_migrations`.

## Affected Areas

- `supabase/migrations/` — nuevas migraciones para el dominio de negocio (productos, proveedores, ventas, movimientos de stock, configuración).
- `openspec/specs/setup-stack/spec.md` (REQ-SETUP-7, V-7) — este change es quien cierra explícitamente lo diferido ahí: GRANTs a `anon`/`authenticated` + policies con `auth.uid()`.
- `src/features/{catalogo,venta,proveedor,dte}/*.tsx` — actualmente skeletons puros (`CatalogScreen`, `ProductDetailScreen`, `SupplierScreen`, `SaleScreen`, `DteImportScreen`), sin tipos ni llamadas a Supabase todavía — el schema que se defina acá es la primera pieza real que los alimenta.
- `src/stores/saleDraft.ts` — ya define `SaleLine { productId, sku, name, quantity, unitPrice }` y un comentario explícito: *"Cleared when the sale is confirmed (atomic RPC — future data-model change)"*. Esto es una confirmación en código (no solo en docs) de que la venta se cierra vía RPC atómica, y ya usa el nombre de campo `sku` (no `barcode` ni `codigo_barras`) — dato a tener en cuenta para consistencia de naming al definir la tabla `productos`.
- `openspec/changes/archive/2026-06-22-setup-stack/design.md` (§Threat Model T1, T7) — ya anticipa "RPC atómica para venta" y "audit log poblado por `data-model`" como mitigaciones diseñadas, no inventadas ahora.
- `openspec/changes/color-palette-assistant/proposal.md` §4 — pide explícitamente campos de color en `productos` (`color_hex` o componentes HSL) y ya asume nombres de tabla en **español** (`productos`), a diferencia de las tablas de infra existentes que están en **inglés** (`profiles`, `audit_log`, `auth_attempts`) — tensión de naming a resolver en `proposal`/`design`, no en explore.

## Approaches

### 1. Ocultamiento de costos por rol (admin ve costo/proveedor, vendedor no)

1. **GRANT/REVOKE por columna** (Postgres `GRANT SELECT (col) ON t TO role`)
   - Pros: nativo, cero tablas/vistas extra.
   - Cons: **inviable en este proyecto** — Supabase/PostgREST mapea TODOS los usuarios de la app (admin y vendedor) al mismo rol de Postgres `authenticated`. No existe un rol de Postgres separado por "vendedor" vs "admin" de negocio (esa distinción vive en `profiles.rol`, no en el rol de conexión). Un GRANT/REVOKE de columna es por rol de Postgres, no por fila/usuario — no puede diferenciar a Angélica de un empleado. Descartado, no es un tradeoff, es un callejón sin salida técnico.
   - Effort: N/A (no aplica).

2. **Vista con `security_invoker = true` + CASE de enmascarado por columna**
   - Ej.: `productos_vista` selecciona todas las columnas públicas + `CASE WHEN is_admin() THEN costo ELSE NULL END AS costo`. `security_invoker=true` (Postgres 15+, disponible en PG 17 del proyecto) hace que la vista evalúe RLS como el invocador, no como el dueño de la vista — sin esto, las vistas SIEMPRE bypasean RLS.
   - Pros: una sola tabla física `productos`, un único endpoint para ambos roles (el cliente hace una query, el vendedor recibe `null` en costo en vez de tener que ramificar la UI por rol a nivel de queries).
   - Cons: el masking vive en SQL (CASE por columna) — cada columna sensible nueva exige recordar agregar el CASE en la vista (drift si se olvida); necesita una función `is_admin()` (SECURITY DEFINER, lee `profiles`) con cuidado de no crear recursión de RLS; los WRITES no pasan por la vista (updates de producto van directo a la tabla con su propia policy UPDATE).
   - Effort: Medio.

3. **Tabla separada `producto_costos` (1:1 con `productos`, RLS admin-only)** — RECOMENDADO
   - `productos` guarda solo columnas seguras (nombre, tipo, marca, color, stock, precio_venta, sku). `producto_costos(producto_id PK/FK, costo, proveedor_id, updated_at)` con RLS `USING (is_admin())` — solo Angélica puede leer/escribir esa tabla.
   - Pros: separación de responsabilidades explícita (SRP a nivel de esquema, no de query); PostgREST embedding (`productos?select=*,producto_costos(costo)`) **degrada con gracia** — si el vendedor no tiene acceso, `producto_costos` vuelve como `[]` vacío, no como error 403. Esto calza con el principio de producto "tolerante a errores" (nada de try/catch ni pantallas de error para el vendedor, el bloque de costo simplemente no se renderiza). No hay riesgo de "olvidar un CASE" — si una columna está en `producto_costos`, es sensible por construcción.
   - Cons: escritura de un producto nuevo toca 2 tablas (mitigable con una función RPC `crear_producto(...)`/`actualizar_producto(...)` que escribe ambas atómicamente — mismo patrón ya anticipado para la venta atómica, no es un patrón nuevo para el proyecto). Un JOIN extra en lecturas admin (irrelevante al volumen de un catálogo de tienda de barrio).
   - Effort: Medio (similar a la opción 2, pero con menos riesgo de drift a futuro).

**Recomendación**: opción 3 (tabla separada `producto_costos`). Column-GRANT queda descartado por incompatibilidad estructural (mismo rol Postgres para ambos roles de negocio). Entre vista-masking y tabla separada, la tabla separada es más robusta a largo plazo porque el "secreto" es estructural (no depende de que alguien recuerde poner un `CASE` correcto en cada columna nueva) y se degrada de forma no-error ante PostgREST embedding, coherente con el principio "deshacer, no diálogos de error" del producto.

### 2. Modelo de stock: columna mutable vs ledger vs híbrido

1. **Columna mutable pura** (`productos.stock int`, `UPDATE ... SET stock = stock - qty`)
   - Pros: lecturas instantáneas, cero JOIN/agregación, trivial de implementar.
   - Cons: sin un rastro histórico de *por qué* cambió el stock más allá del `audit_log` genérico (jsonb no tipado); "deshacer" funciona solo si `venta_items` guarda el detalle exacto (factible, pero el ajuste de stock queda "oculto" dentro de la lógica de la función, no como dato consultable por sí mismo).
   - Effort: Bajo.

2. **Ledger puro** (stock derivado, `SUM(delta)` sobre `movimientos_stock`)
   - Pros: auditoría total, "undo" = insertar movimiento compensatorio, sin mutar nada existente; abre la puerta a reportes tipo "stock a la fecha X" (fuera del MVP, pero gratis si el ledger existe).
   - Cons: leer el stock actual requiere agregación (o un rollup cacheado, lo que reintroduce una columna mutable de todos modos) — para el dashboard ("alertas de stock bajo" en cada apertura de la app) esto es innecesariamente caro sin cache.
   - Effort: Alto (si se quiere mantener lecturas rápidas, termina siendo el híbrido de todos modos).

3. **Híbrido: columna `stock` (lectura rápida) + tabla `movimientos_stock` (auditoría)** — RECOMENDADO
   - `productos.stock` sigue siendo la fuente de verdad para lecturas (dashboard, catálogo, escáner). `movimientos_stock(producto_id, tipo enum('venta','deshacer_venta','compra','ajuste'), cantidad, referencia_id, actor_id, created_at)` registra cada cambio, mantenido transaccionalmente dentro de las mismas funciones RPC que tocan `productos.stock` (no un trigger separado que podría desincronizarse).
   - "Deshacer última venta" = insertar movimiento `deshacer_venta` (+qty) referenciando la venta original, dentro de la misma función que revierte `productos.stock`. La futura importación DTE aterriza naturalmente como movimiento `tipo='compra'`. Este ledger es, en efecto, el `audit_log` *tipado* para el activo más sensible del negocio (A4 en el threat model del `setup-stack`: "stock integrity") — separado del `audit_log` genérico que puede seguir cubriendo acciones no relacionadas a stock.
   - Cons: más superficie de schema que la opción 1 (una tabla y un enum más), pero el trabajo de "función RPC atómica" ya estaba anticipado en el design de `setup-stack` (T1) — no es complejidad nueva, es el lugar correcto para ponerla.
   - Effort: Medio.

**Recomendación**: híbrido (2). Es el único que resuelve limpiamente "deshacer última venta" + dejar espacio natural para el import DTE, sin sacrificar velocidad de lectura en el dashboard. Riesgo a vigilar en `design`: la columna y el ledger deben escribirse SIEMPRE juntos dentro de la misma transacción/función — nunca desde dos puntos de entrada distintos, o se desincronizan.

### 3. Venta + ítems + "deshacer"

- Modelo clásico: `ventas(id, actor_id, medio_pago enum, total, estado enum('confirmada','deshecha'), created_at)` + `venta_items(id, venta_id FK, producto_id FK, cantidad, precio_unitario)`. `precio_unitario` se **congela** (snapshot) en el momento de la venta — el ticket no debe cambiar si mañana Angélica actualiza el precio del producto.
- **Soft-cancel** (`estado='deshecha'`, filas se conservan, se insertan movimientos de stock compensatorios) vs **hard delete** (borrar filas de `ventas`/`venta_items`, revertir stock).
  - Soft-cancel — RECOMENDADO: preserva el rastro de auditoría (mitiga T7 del threat model de `setup-stack`: "Operator denies a money/stock action"), es coherente semánticamente con "deshacer" del principio de diseño #5 (deshacer ≠ que nunca pasó), y dado que las columnas de auditoría (`audit_log`, `movimientos_stock`) ya están pensadas para registrar toda operación de dinero/stock, un hard delete las dejaría huérfanas o inconsistentes.
  - Hard delete: más simple de consultar (no hay que filtrar por `estado` en todos lados), pero contradice directamente T7 y pierde historia que un futuro "ventas del día, desglosado" (ya en el MVP, Dashboard §5) necesitaría explicar si el total cambia tras un deshacer.
- Regla de negocio "solo se puede deshacer la ÚLTIMA venta": no debe vivir solo en la UI (un botón que solo aparece para la última fila) — debe **enforced en la función RPC** `deshacer_venta(venta_id)`, verificando que `venta_id` sea efectivamente la venta `confirmada` más reciente antes de revertir. Cliente no confiable (principio rector del proyecto) aplica igual acá: un request directo a la función no debe poder deshacer una venta antigua solo porque la UI no mostraba el botón.

**Recomendación**: soft-cancel + regla "solo la última" verificada dentro de la función RPC, no solo en el frontend.

### 4. Atributo color: texto libre vs estructurado

- Solo texto libre (`color_nombre text`, ej. "celeste", "damasco"): costo cero ahora, pero bloquea por completo `color-palette-assistant` (que ya en su propio `proposal.md` §2 asume representación HSL/RGB para calcular distancia euclidiana/CIELAB). Retrofitear color_hex a mano sobre un catálogo ya cargado es trabajo manual y con pérdida para Angélica.
- Estructurado desde el día 1 — RECOMENDADO: agregar `color_nombre text` (nullable, para búsqueda/display en el lenguaje que Angélica ya usa) **y** `color_hex text CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$')` (nullable — no todos los productos necesitan estar etiquetados de entrada, no bloquea creación de producto). Costo: una columna + un CHECK, nada de cómputo server-side. El cálculo de distancia sigue viviendo en el frontend (tal como ya lo define el proposal de `color-palette-assistant`) — no se instalan `pgvector` ni `cube` ahora (están disponibles en el proyecto si algún día se necesita KNN server-side, pero sería YAGNI hoy).
- **Recomendación**: agregar ambos campos ahora. Es la única opción de las tres exploradas que no genera una migración de rework futura, y el costo marginal es prácticamente nulo.

### 5. Stock mínimo: default global + override por producto

- Default como `DEFAULT` literal de columna (`stock_minimo integer DEFAULT 5`): el valor se **congela en el INSERT**, no seguiría un cambio posterior del "default global" para las filas que ya lo heredaron — rompe la semántica de "default global editable" que pide el producto.
- Tabla `configuracion`/`tienda_ajustes` (singleton, 1 fila, patrón `CHECK (id = 1)`) con `stock_minimo_default int` + columna `productos.stock_minimo integer NULL` (NULL = "usa el default global") — RECOMENDADO. El valor efectivo se resuelve en lectura: `COALESCE(productos.stock_minimo, (SELECT stock_minimo_default FROM configuracion))`. Si Angélica cambia el default global, se aplica retroactivamente a todo producto sin override — que es exactamente lo que pide el producto ("hereda un default global; cada producto puede tener el propio"). Barato de calcular a esta escala de catálogo (sin necesidad de vista materializada).

**Recomendación**: singleton `configuracion` + columna nullable de override. Resuelve la semántica de "default retroactivo" que un `DEFAULT` de columna no puede dar.

### 6. Convenciones a mantener (de `20260621000000_initial_scaffold.sql`)

- PK: `uuid PRIMARY KEY DEFAULT gen_random_uuid()` (vía `pgcrypto`, ya instalado) para tablas propias; `profiles` es la excepción por ser extensión 1:1 de `auth.users` (`id` es FK, no tiene default propio).
- `created_at timestamptz NOT NULL DEFAULT now()` en toda tabla.
- `ALTER TABLE public.X ENABLE ROW LEVEL SECURITY;` inmediatamente después del `CREATE TABLE`, con comentario referenciando el REQ/tarea que lo motiva — mantener esta trazabilidad.
- Funciones `SECURITY DEFINER` con `SET search_path = ''` + identificadores completamente calificados por esquema — patrón a replicar en cualquier función nueva (`is_admin()`, `confirmar_venta()`, `deshacer_venta()`, etc.).
- Gotcha específico a documentar en `design`: una función tipo `is_admin()` usada DENTRO de una cláusula `USING` de RLS necesita EXECUTE otorgado a `authenticated` (Postgres debe poder evaluarla en nombre del rol invocador) — a diferencia de `handle_new_user()`, que es trigger-only y correctamente revoca EXECUTE de todos los roles API (los triggers se invocan como el dueño de la función, no vía rol). No tratar ambos casos igual.
- **Naming en español vs inglés — abierto para `proposal`/`design`, no resuelto acá**: las tablas de infraestructura existentes están en inglés (`profiles`, `audit_log`, `auth_attempts`), pero el proposal de `color-palette-assistant` y el `product-definition.md` ya usan nombres de dominio en español (`productos`, `color_hex`). Recomiendo Español para las tablas de negocio nuevas (coherente con el lenguaje familiar que pide el producto — "ovillo", "madeja" — y con lo que ya asume el change vecino), mantener inglés para lo que ya existe (no rename retroactivo). Esto debe quedar explícito como decisión en `proposal.md`, no asumido implícitamente.
- Migraciones: se aplicó una sola (`20260621000000_initial_scaffold`) hasta ahora — `data-model` puede optar por 1 migración grande (como hizo `setup-stack`) o varias por sub-dominio (catálogo, ventas, proveedores/DTE); decisión de `design`, no de `explore`.

## Recommendation

El schema de `data-model` debería componerse de (nombres tentativos en español, a confirmar en `proposal`):

- `productos` (columnas seguras: sku/código de barras, nombre, tipo, marca, grosor, color_nombre, color_hex, peso_metraje, precio_venta, stock, stock_minimo NULL, imagen_url NULL, proveedor_id FK — proveedor_id podría considerarse sensible también, evaluar en `design` si va en `productos` o se mueve a `producto_costos` junto con costo)
- `producto_costos` (producto_id PK/FK, costo, proveedor_id si se decide moverlo, updated_at) — RLS admin-only
- `proveedores` (nombre, contacto, telefono) — RLS admin-only (misma sensibilidad que costos)
- `compras` + `compra_items` (para historial de compras y futuro import DTE: fecha, proveedor_id, tipo_dte, folio, xml_hash opcional)
- `ventas` + `venta_items` (con `estado` para soft-cancel, `precio_unitario` congelado)
- `movimientos_stock` (ledger tipado, alimenta undo + futuro import DTE + dashboard de auditoría)
- `configuracion` (singleton, `stock_minimo_default`)
- Funciones RPC: `is_admin()` (helper para RLS), `confirmar_venta(...)`, `deshacer_venta(venta_id)`, y probablemente `crear_producto`/`actualizar_producto` si se separa `producto_costos`.

Todo esto es de `proposal`/`design`, no una decisión cerrada de `explore` — se deja como punto de partida concreto en vez de una lista abstracta.

## Risks

- **Naming en español vs inglés sin resolver explícitamente** puede generar inconsistencia si distintas fases (proposal, spec, design) asumen nombres distintos sin que quede una decisión escrita — resolver en `proposal.md` antes de `spec`.
- **Sincronización columna+ledger de stock**: si la actualización de `productos.stock` y la inserción en `movimientos_stock` no ocurren dentro de la MISMA transacción/función, quedan desincronizados silenciosamente — no hay un mecanismo de Postgres que lo detecte solo; debe imponerse por disciplina de diseño (una única función RPC por operación de stock).
- **`producto_costos` como tabla separada añade un JOIN a cada lectura admin del catálogo** — irrelevante al volumen actual (catálogo de tienda física, no e-commerce masivo), pero si el catálogo creciera mucho, revisar índices (`producto_costos.producto_id` ya sería PK/FK, cubierto).
- **`is_admin()` mal implementado puede crear recursión de RLS** si internamente hace `SELECT` sobre una tabla que también tiene RLS dependiente de `is_admin()` — debe ser `SECURITY DEFINER` para leer `profiles` sin pasar por sus propias policies (patrón estándar de Supabase, pero fácil de hacer mal).
- **Extensión `vector`/`cube` no instalada** — no es un riesgo del MVP, pero si `color-palette-assistant` evoluciona a necesitar KNN server-side sobre catálogos grandes, instalar la extensión más adelante es una migración adicional (bajo costo, ya confirmado disponible en el proyecto).

## Ready for Proposal

Sí. El terreno está mapeado con evidencia verificada (estado real de Supabase, no solo el archivo de migración) y las 6 decisiones exploradas tienen una recomendación concreta cada una. Lo único que `proposal.md` debe zanjar explícitamente antes de `spec` es la convención de naming español/inglés para las tablas nuevas — todo lo demás (ocultamiento de costos, modelo de stock, venta/deshacer, color estructurado, stock mínimo) tiene un ganador claro con tradeoffs documentados.
