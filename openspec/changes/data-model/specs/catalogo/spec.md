---
change: data-model
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domain: catalogo
tables: [productos, producto_costos, proveedores]
rpc: [crear_producto, actualizar_producto]
---

# Catálogo — Specification

## Purpose

Product catalog data: employee-safe `productos` columns, admin-only cost/supplier
isolation (`producto_costos`, `proveedores` — D2), structured color attribute (D5),
and the atomic dual-table write RPC. RLS/GRANT enforcement for these tables is
specified in `seguridad` (REQ-DM-SEG-3); this domain defines table shape + invariants.

## Requirements

### Requirement: REQ-DM-CAT-1 — `productos` employee-safe columns

The system MUST create `productos` with only employee-visible columns. `costo` and
`proveedor_id` MUST NOT exist on this table (moved to `producto_costos`, D2).
`stock` MUST NOT go negative.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| sku | text | barcode field (D1) |
| nombre, tipo, marca, grosor | text | |
| color_nombre | text NULL | REQ-DM-CAT-4 |
| color_hex | text NULL | REQ-DM-CAT-4 |
| peso_metraje | text/numeric | |
| precio_venta | numeric | |
| stock | int | `CHECK (stock >= 0)` |
| stock_minimo | int NULL | override, see `configuracion` domain |
| imagen_url | text NULL | |
| created_at, updated_at | timestamptz | |

#### Scenario: producto created without cost columns
- GIVEN a client inserts a row via `crear_producto`
- WHEN the returned row is inspected
- THEN it has no `costo` or `proveedor_id` column

#### Scenario: negative stock rejected at table level
- GIVEN `productos.stock` has `CHECK (stock >= 0)`
- WHEN an UPDATE would set `stock = -1`
- THEN Postgres rejects it with a check constraint violation

### Requirement: REQ-DM-CAT-2 — `producto_costos` 1:1 admin-only table

The system MUST create `producto_costos(producto_id uuid PK REFERENCES productos(id), costo numeric NOT NULL, proveedor_id uuid NULL REFERENCES proveedores(id), updated_at timestamptz)`. Read/write exposure is admin-only (enforced in REQ-DM-SEG-3).

#### Scenario: one cost row per product
- GIVEN `producto_costos.producto_id` is PRIMARY KEY and FK to `productos.id`
- WHEN a second row is inserted for the same `producto_id`
- THEN Postgres rejects the duplicate PK

### Requirement: REQ-DM-CAT-3 — `proveedores` table

The system MUST create `proveedores(id uuid PK, nombre text NOT NULL, contacto text NULL, telefono text NULL, created_at timestamptz)`. Exposure is admin-only (REQ-DM-SEG-3).

#### Scenario: proveedor holds contact info
- GIVEN a `proveedores` row is created with `nombre` and `telefono`
- WHEN it is read by an admin
- THEN both fields are present

### Requirement: REQ-DM-CAT-4 — structured color, day 1 (D5)

The system MUST add `color_nombre text NULL` and `color_hex text NULL CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$')`. Both columns MUST be nullable — color tagging MUST NOT block product creation.

#### Scenario: producto created without color
- GIVEN `color_nombre` and `color_hex` are both NULL
- WHEN `crear_producto` runs without color fields
- THEN the insert succeeds

#### Scenario: invalid hex rejected
- GIVEN the CHECK constraint on `color_hex`
- WHEN a value like `"blue"` or `"#12"` is inserted
- THEN Postgres rejects it with a check constraint violation

#### Scenario: valid hex accepted
- GIVEN `color_hex = '#3A6E45'`
- WHEN inserted
- THEN the row is created

### Requirement: REQ-DM-CAT-5 — `crear_producto` / `actualizar_producto` atomic RPC

The system MUST expose `crear_producto(...)` and `actualizar_producto(...)` as SECURITY DEFINER RPC (`SET search_path = ''`) that write `productos` and `producto_costos` in ONE transaction. A product with cost data MUST NOT exist in `productos` without its matching `producto_costos` row, or vice versa.

#### Scenario: create succeeds, both tables written
- GIVEN `crear_producto` is called with product + cost fields
- WHEN it completes
- THEN a row exists in `productos` AND a matching row exists in `producto_costos`

#### Scenario: invalid cost rolls back the whole write
- GIVEN `crear_producto` is called with a negative `costo`
- WHEN the RPC executes
- THEN the transaction rolls back
- AND no orphan row is left in `productos`
