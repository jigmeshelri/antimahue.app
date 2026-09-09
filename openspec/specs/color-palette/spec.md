---
change: color-palette-assistant
phase: spec
status: pending
depends_on: [catalogo]
supersedes: ~
persistence: openspec
domain: color-palette
---

# Color Palette Assistant — Specification

## Purpose

In-store tool for Angélica to build harmonic yarn palettes mapped to live inventory.

## Requirements

### Requirement: REQ-CPA-1 — Seed color selection

The system MUST let the user pick a seed product from the catalog. Only products with a non-null `color_hex` MUST be eligible.

#### Scenario: eligible seed appears in selector
- GIVEN the catalog contains a product with `color_hex = '#C84A3A'`
- WHEN the seed selector loads
- THEN that product is listed

#### Scenario: product without color is excluded
- GIVEN the catalog contains a product with `color_hex IS NULL`
- WHEN the seed selector loads
- THEN that product is not shown

### Requirement: REQ-CPA-2 — Harmony rule selection

The system MUST offer three rules: analogous, complementary, and triadic.

#### Scenario: user picks a rule
- GIVEN a seed color is selected
- WHEN the user taps "Complementarios"
- THEN the assistant uses the complementary rule for palette generation

### Requirement: REQ-CPA-3 — Theoretical palette generation

The system MUST compute target HSL colors from the seed and the selected rule.

#### Scenario: complementary rule yields opposite hue
- GIVEN seed HSL `(0, 70%, 50%)`
- WHEN rule is "complementary"
- THEN one target color has hue `180` (within rounding tolerance)

#### Scenario: triadic rule yields three evenly spaced hues
- GIVEN seed HSL `(0, 70%, 50%)`
- WHEN rule is "triadic"
- THEN target hues are spaced approximately `120°` apart

### Requirement: REQ-CPA-4 — Inventory mapping

The system MUST suggest catalog products whose stored HSL is closest to each target color, ordered by color distance.

#### Scenario: closest color is ranked first
- GIVEN target HSL `(180, 70%, 50%)` and products at `(175, 68%, 52%)` and `(90, 50%, 50%)`
- WHEN suggestions are computed
- THEN the first product is ranked above the second

#### Scenario: exact match wins
- GIVEN a target HSL exactly matches a product's stored HSL
- WHEN suggestions are computed
- THEN that product is the top suggestion with distance zero

### Requirement: REQ-CPA-5 — Stock awareness

The system MUST visually flag each suggestion as available, low stock, or out of stock using the same thresholds as the catalog.

#### Scenario: out-of-stock suggestion is flagged
- GIVEN a suggested product has `stock = 0`
- WHEN suggestions render
- THEN it is marked as out of stock

### Requirement: REQ-CPA-6 — Palette builder

The system MUST let the user add, remove, and reorder selected products into a palette.

#### Scenario: add suggestion to palette
- GIVEN a suggestion is displayed
- WHEN the user taps "Agregar"
- THEN the product appears in the palette list

#### Scenario: remove product from palette
- GIVEN a product is in the palette
- WHEN the user taps "Quitar"
- THEN the product is removed

### Requirement: REQ-CPA-7 — Share palette

The system MUST export the palette as plain text suitable for WhatsApp.

#### Scenario: share plain text
- GIVEN a palette with two products
- WHEN the user taps "Compartir"
- THEN a `wa.me/?text=` link opens with product names and color info

### Requirement: REQ-CPA-8 — Out-of-stock note

The system SHOULD let the user save a customer note when a desired color is out of stock.

#### Scenario: save note for missing color
- GIVEN a desired color has no available product
- WHEN the user enters a customer note
- THEN the note is saved for later reference
