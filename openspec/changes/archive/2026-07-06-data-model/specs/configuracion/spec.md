---
change: data-model
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domain: configuracion
tables: [configuracion]
rpc: []
---

# Configuración — Specification

## Purpose

Store-wide singleton settings and the per-product minimum-stock override (D6):
a global default that MUST propagate retroactively, with a nullable per-product
override that takes precedence when set.

## Requirements

### Requirement: REQ-DM-CFG-1 — `configuracion` singleton table

The system MUST create `configuracion(id int PRIMARY KEY CHECK (id = 1), stock_minimo_default int NOT NULL, updated_at timestamptz)`. Exactly one row MUST exist for the app to resolve a default threshold; migration seeding vs. first-admin-write creation is a design decision (OQ-4), not a spec constraint.

#### Scenario: second singleton row rejected
- GIVEN `configuracion` already has a row with `id = 1`
- WHEN an INSERT with `id = 2` is attempted
- THEN Postgres rejects it (`CHECK (id = 1)` / PK violation)

### Requirement: REQ-DM-CFG-2 — `productos.stock_minimo` nullable override, resolved via COALESCE

The system MUST add `productos.stock_minimo int NULL`. The effective threshold at read time MUST be `COALESCE(productos.stock_minimo, configuracion.stock_minimo_default)`. A column `DEFAULT` literal MUST NOT be used for this purpose — it would freeze the value at INSERT and not propagate a later global change (D6).

#### Scenario: producto without override follows the global default
- GIVEN a producto with `stock_minimo IS NULL`
- WHEN the effective threshold is read
- THEN it equals `configuracion.stock_minimo_default`

#### Scenario: global default change propagates retroactively
- GIVEN producto X has `stock_minimo IS NULL`
- WHEN `configuracion.stock_minimo_default` changes from `5` to `10`
- THEN the effective threshold for producto X immediately reads `10`, with no UPDATE to `productos`

### Requirement: REQ-DM-CFG-3 — per-product override takes precedence

A non-NULL `productos.stock_minimo` MUST take precedence over `configuracion.stock_minimo_default` regardless of later changes to the global default.

#### Scenario: override ignores a later global default change
- GIVEN producto Y has `stock_minimo = 20`
- WHEN `configuracion.stock_minimo_default` changes from `5` to `10`
- THEN the effective threshold for producto Y remains `20`
