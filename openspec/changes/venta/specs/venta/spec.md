---
change: venta
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec+engram
domain: venta
delta_of: openspec/specs/venta/spec.md
---

# Delta for venta — sale UI flow (cart, confirm, undo, ticket)

Client behavior over the LIVE backend (GH #6+#9); REQ-DM-VENTA-1..4 unchanged.
**Out of scope (declared):** offline sale queue; reprint-from-history (deferred
to `dashboard`); product photos/Storage.

## ADDED Requirements

### Requirement: REQ-VENTA-UI-1 — Cart: entry, quantity, live total

The sale screen MUST add lines via scan or manual search, merging repeats into
one line. Lines MUST show name, unit price, stepper, subtotal; the total MUST
update live. Quantity 0 or remove MUST drop the line. Empty cart MUST show an
empty state and block confirm.

#### Scenario: repeated product merges into one line
- GIVEN a cart with 2 × "Lana Andina"
- WHEN scanned again
- THEN one line shows cantidad 3 and the updated total

#### Scenario: stepper to zero removes the line
- GIVEN a line with cantidad 1
- WHEN the user taps "−"
- THEN the line is removed and the total updates

#### Scenario: empty cart blocks confirm
- GIVEN an empty draft
- WHEN the screen renders
- THEN empty state shown, confirm unavailable

### Requirement: REQ-VENTA-UI-2 — Confirm: payment method + atomic RPC

A payment method MUST be selected before confirm (`efectivo` preselected).
Confirm MUST call `confirmar_venta` with only `{producto_id, cantidad}[]` +
medio de pago — never price/total (REQ-DM-VENTA-3). Success MUST clear the draft
and navigate to `/venta/:id/ticket`. Out-of-stock rejection MUST flag the
offending line (`'stock insuficiente'` prefix + uuid regex, D9) and keep the
draft intact.

#### Scenario: confirm happy path
- GIVEN a cart with medio de pago selected
- WHEN the user confirms
- THEN the RPC gets only ids+cantidades+medio de pago; the draft clears and the ticket opens

#### Scenario: stock failure flags the line
- GIVEN a rejection `'stock insuficiente … <uuid>'`
- WHEN it is parsed
- THEN that line is flagged, the draft unchanged; unparseable errors show a generic message, no flag

### Requirement: REQ-VENTA-UI-3 — Undo last sale from the ticket

A just-confirmed sale's TicketView MUST show "Deshacer última venta",
calling `deshacer_venta` (REQ-DM-VENTA-4). Last-sale-only rejection (prefix
`'solo se puede deshacer'`, D9) MUST surface as a toast; the sale MUST stay
`confirmada`. Success MUST show the sale cancelled (post-undo UX per OQ-4).

#### Scenario: undo the just-confirmed sale
- GIVEN the TicketView of the global last confirmed sale
- WHEN the user taps undo
- THEN the RPC succeeds and the UI shows the sale cancelled

#### Scenario: a newer sale slipped in
- GIVEN a newer sale was confirmed (any device)
- WHEN the user taps undo
- THEN the RPC rejects, a toast explains the rule, and the sale stays `confirmada`

### Requirement: REQ-VENTA-UI-4 — Ticket rendering and deep link

The ticket MUST render store name, lines (nombre, cantidad, precio unitario,
subtotal), total, medio de pago, fecha/hora, reference = first 8 uuid chars
(D8). MUST be reachable at `/venta/:id/ticket` by any authenticated role.
Seller name MUST appear only on the user's own sale (D7).

#### Scenario: seller name only on own sale
- GIVEN a rendered ticket
- WHEN the sale is the user's own
- THEN their display name is shown
- AND for someone else's deep-linked sale the seller field is omitted

### Requirement: REQ-VENTA-UI-5 — Print and WhatsApp output

The ticket MUST print via `window.print()` with 80mm print CSS (`@page` 80mm,
controls hidden). WhatsApp share MUST open `wa.me/?text=` with the ticket as
legible plain text — no HTML dependency.

#### Scenario: print to 80mm
- GIVEN a rendered ticket
- WHEN the user taps "Imprimir"
- THEN the print dialog opens; output fits 80mm without action buttons

#### Scenario: WhatsApp share
- GIVEN a confirmed sale
- WHEN the user taps "Compartir por WhatsApp"
- THEN a `wa.me` link opens with the full ticket as plain text

### Requirement: REQ-VENTA-UI-6 — Employee cost concealment

An empleado MUST NOT see product cost anywhere in the sale flow. The UI MUST
conceal by construction — sale lines carry no cost, no admin cost components
reused (D11); RLS/RPC stays the real boundary (REQ-DM-SEG-3).

#### Scenario: empleado completes a full sale
- GIVEN an empleado session
- WHEN they search, build a cart, confirm, and view the ticket
- THEN no product cost is visible at any step
