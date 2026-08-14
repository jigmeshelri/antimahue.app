---
change: color-palette-assistant
phase: spec
status: pending
depends_on: [data-model]
supersedes: ~
persistence: openspec
domain: catalogo
delta_of: openspec/specs/catalogo/spec.md
---

# Delta for catalogo — HSL color components

## ADDED Requirements

### Requirement: REQ-DM-CAT-6 — HSL color components

The system MUST add `color_h int NULL CHECK (color_h BETWEEN 0 AND 360)`, `color_s int NULL CHECK (color_s BETWEEN 0 AND 100)`, and `color_l int NULL CHECK (color_l BETWEEN 0 AND 100)` to `productos`. All three MUST be NULL when `color_hex` is NULL. When `color_hex` is present, the RPC MUST compute and store the equivalent HSL values.

#### Scenario: product with color gets HSL computed
- GIVEN `crear_producto` receives `color_hex = '#FF0000'`
- WHEN the row is created
- THEN `color_h = 0`, `color_s = 100`, `color_l = 50`

#### Scenario: product without color has null HSL
- GIVEN `crear_producto` receives no color fields
- WHEN the row is created
- THEN `color_h`, `color_s`, and `color_l` are NULL

#### Scenario: invalid hue rejected
- GIVEN an UPDATE sets `color_h = 400`
- WHEN the statement runs
- THEN Postgres rejects it with a check constraint violation

#### Scenario: invalid saturation rejected
- GIVEN an UPDATE sets `color_s = 150`
- WHEN the statement runs
- THEN Postgres rejects it with a check constraint violation
