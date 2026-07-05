---
change: data-model
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domain: venta
tables: [ventas, venta_items, movimientos_stock]
rpc: [confirmar_venta, deshacer_venta]
---

# Venta — Specification

## Purpose

Sale lifecycle: `ventas`/`venta_items` with frozen price snapshot (D4), the typed
stock ledger `movimientos_stock` (D3), and the two RPCs enforcing money/stock
integrity server-side — `confirmar_venta` (atomic close) and `deshacer_venta`
(soft-cancel, last-sale-only).

## Requirements

### Requirement: REQ-DM-VENTA-1 — `ventas` / `venta_items`, frozen price

The system MUST create `ventas(id uuid PK, actor_id uuid FK auth.users, medio_pago text CHECK, total numeric, estado text CHECK IN ('confirmada','deshecha') DEFAULT 'confirmada', created_at)` and `venta_items(id uuid PK, venta_id FK, producto_id FK, cantidad int CHECK (cantidad > 0), precio_unitario numeric)`. `precio_unitario` MUST be captured at sale time and MUST NOT change if `productos.precio_venta` changes later.

#### Scenario: ticket price stays frozen after a later price change
- GIVEN a confirmed sale with `venta_items.precio_unitario = 1000`
- WHEN `productos.precio_venta` is later updated to `1200`
- THEN the existing `venta_items` row still reads `precio_unitario = 1000`

### Requirement: REQ-DM-VENTA-2 — `movimientos_stock` typed ledger (D3)

The system MUST create `movimientos_stock(id uuid PK, producto_id FK, tipo text CHECK IN ('venta','deshacer_venta','compra','ajuste'), cantidad int, referencia_id uuid NULL, actor_id FK, created_at)`. The value `'compra'` MUST be reserved now even though no `compras` table exists yet (forward-compat for a future `dte-import` change — proposal §Out of scope).

#### Scenario: ledger written in the same transaction as the stock mutation
- GIVEN `confirmar_venta` runs for a sale
- WHEN it completes
- THEN `productos.stock` is decreased AND a `movimientos_stock` row with `tipo='venta'` referencing that sale exists
- AND both changes are visible together (same transaction — never two entry points, per D3/R1)

### Requirement: REQ-DM-VENTA-3 — `confirmar_venta` atomic RPC, stock never negative

The system MUST expose `confirmar_venta(...)` (SECURITY DEFINER, `SET search_path = ''`) that creates `ventas` + `venta_items`, decrements `productos.stock`, and inserts `movimientos_stock('venta')` as ONE transaction. `total` MUST be recomputed server-side from `venta_items × precio_unitario` — the client-sent total MUST NOT be trusted. `productos.stock` MUST NOT go negative as a result of this RPC.

#### Scenario: sale confirmed atomically
- GIVEN a cart with 2 valid items and sufficient stock
- WHEN `confirmar_venta` is called
- THEN `ventas`, `venta_items`, `productos.stock`, and `movimientos_stock` all reflect the sale, or none do

#### Scenario: insufficient stock rejected — stock never negative
- GIVEN a producto with `stock = 2`
- WHEN `confirmar_venta` requests `cantidad = 5` for that producto
- THEN the RPC raises an error
- AND no rows are created in `ventas`/`venta_items`/`movimientos_stock`, and `stock` remains `2`

#### Scenario: total computed server-side, client value ignored
- GIVEN a request sends a forged `total` different from `Σ(cantidad × precio_unitario)`
- WHEN `confirmar_venta` executes
- THEN the persisted `ventas.total` is the server-computed value, not the client-sent one

### Requirement: REQ-DM-VENTA-4 — `deshacer_venta` soft-cancel, last-sale-only

The system MUST expose `deshacer_venta(venta_id)` (SECURITY DEFINER) that: verifies `venta_id` is the most-recent `estado='confirmada'` sale (by `created_at`); sets `estado='deshecha'` (soft-cancel — rows are kept, no hard delete, D4); inserts a compensating `movimientos_stock('deshacer_venta', +cantidad)` per item; restores `productos.stock`. The last-sale rule MUST be enforced inside the RPC, not only in the UI (untrusted client).

#### Scenario: undo the last sale succeeds
- GIVEN sale B is the most recent `confirmada` sale
- WHEN `deshacer_venta(B.id)` is called
- THEN `B.estado` becomes `'deshecha'`, stock is restored, and a compensating ledger row is inserted

#### Scenario: undo a non-last sale is rejected by the RPC
- GIVEN sale A (older) and sale B (newest), both `confirmada`
- WHEN `deshacer_venta(A.id)` is called
- THEN the RPC returns an error
- AND `A.estado` remains `'confirmada'` (no partial effect)

#### Scenario: undo an already-cancelled sale is rejected
- GIVEN sale A has `estado = 'deshecha'`
- WHEN `deshacer_venta(A.id)` is called again
- THEN the RPC returns an error and no duplicate compensating ledger row is inserted
