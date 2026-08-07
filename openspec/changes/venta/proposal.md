---
change: venta
phase: proposal
status: in_progress
depends_on: [data-model, auth-pin, catalogo]
supersedes: ~
persistence: openspec+engram
updated_at: 2026-08-06
---

# Proposal: venta — sale flow (cart, charge, stock decrement, undo, ticket) (Antimahue MVP)

## Intent

GH issue #6 asks for the sale flow; issue #9 (ticket) is folded in per the approved SDD roadmap (`docs/product-definition.md`: "carrito, cobro, descuento de stock, deshacer, ticket"). Issue #9's reprint-from-history AC is **deferred to the `dashboard` change** (no history screen exists today; TicketView stays deep-linkable by id).

**Backend is DONE, live in prod — zero migrations.** `confirmar_venta(p_items jsonb, p_medio_pago text)` and `deshacer_venta(p_venta_id uuid)` enforce validation, per-item `FOR UPDATE` stock locks, frozen pricing, and `activo` gates server-side. RLS already lets any `authenticated` role read `ventas`/`venta_items`/`configuracion` for the ticket. This change is **pure frontend**: turn the `SaleScreen`/`TicketView` skeletons and the `saleDraft` atom into the real flow, following the catalogo groundwork (TDD, API layer pattern, reusable components).

Governing principle inherited: **the client bundle is UNTRUSTED — authorization and stock truth live in Postgres (RLS/RPC).** The client sends only `{producto_id, cantidad}[]` + medio de pago; never price or total.

## Scope

### In scope
- Real `SaleScreen` (`/venta`): search (`SearchInput` + `fetchProducts`), scanner entry, cart lines with `Stepper`, payment-method chips (`efectivo` default), CTA "Confirmar venta · $total".
- Extend `src/stores/saleDraft.ts`: `setQuantity` (0 = remove), `removeLine`, `clearDraft`, `medioPago` in-draft (survives scanner navigation), advisory stock snapshot per line.
- New `ventaApi.ts` (RPC wrappers + fetch venta/items/config, catalogo `catalogoApi.ts` pattern) and `ventaUtils.ts` (WhatsApp plain-text formatter, RPC error parser, totals — pure, TDD).
- Real `TicketView` (`/venta/:id/ticket`): receipt card per design handoff, `window.print()` with 80mm print CSS, WhatsApp share via `wa.me/?text=`, **"Deshacer última venta" button**, "+ Nueva venta".
- Out-of-stock handling: parse RPC rejection, flag the failing line, keep the draft intact for retry.
- Tests for API layer, pure utils, store, atomic components (TDD).

### Out of scope
- **Offline sale queue** — explicitly deferred (YAGNI: single store, good connectivity; issue #6 stretch goal stays unmet by design). Network failure leaves the draft intact for manual retry.
- **Reprint from sale history** — deferred to the `dashboard` change (declares issue #9's reprint AC unmet here by design).
- Any backend/schema/migration work (backend is complete).
- Realtime stock subscriptions (RPC `FOR UPDATE` covers oversell).
- Sequential ticket folio (would need a schema change).

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Backend work | **None** — RPCs + RLS already live in prod | Any migration or new RPC |
| D2 | Cart state | **Extend `saleDraft`** (setQuantity/remove/clear + `medioPago` in-draft + advisory stock snapshot) | New separate store |
| D3 | Data/logic layer | **New `ventaApi.ts` + `ventaUtils.ts`** following catalogo TDD pattern | Logic inside screens |
| D4 | Ticket output | **`window.print()` + 80mm print CSS + `wa.me` plain text** — zero dependencies | PDF library; thermal printer integration |
| D5 | Undo UX | **Button in TicketView only** (user-validated); RPC rejection mapped to toast | Also on SaleScreen; per-user undo |
| D6 | Offline queue | **OUT of scope** (user-validated YAGNI) | IndexedDB queue with sync/conflict handling |
| D7 | Seller name on ticket | **Show only for own sale** (session `user_metadata.display_name`); omit otherwise | Schema change to make names readable |
| D8 | Ticket reference | **Short uuid fragment** (first 8 chars) as on-screen/print reference | Fake sequential folio ("Ticket N° 0047") |
| D9 | RPC error handling | **Match stable prefixes** (`'stock insuficiente'`, `'solo se puede deshacer'`) + uuid regex to flag the line | Parse full free-text; opaque generic errors |
| D10 | Oversell / realtime | **No Realtime** — server `FOR UPDATE` is the truth; optional stock refetch on SaleScreen mount | Supabase Realtime subscription |
| D11 | Employee cost visibility | **Conceal by construction** — `SaleLine` carries no cost; reuse no admin cost components. Boundary stays RLS/RPC | Client-side role branching over cost data |

### D1 — Pure frontend (MUST)
`confirmar_venta` validates `medio_pago` against the same set as the `ventas.medio_pago` CHECK, locks each item row `FOR UPDATE`, freezes price from `productos.precio_venta`, recomputes the total, and returns the venta uuid. `deshacer_venta` soft-cancels with a compensating ledger. Both are gated by `is_active()`. Nothing is missing server-side.

### D2 — Extend `saleDraft` (MUST)
The atom already exists with tests, and both entry points (ScannerScreen, ProductDetailScreen) already write to it via `addLine`. `medioPago` must live **in** the draft because scanning navigates away from `/venta` mid-sale. The stock snapshot is advisory only (Stepper max + visual warning) — the server remains authoritative.

### D4 — Ticket output (MUST)
The handoff ships a printable 80mm thermal layout (`Ticket Térmico.dc.html`: `@page 80mm`, DM Mono, torn edges). Replicating it with print CSS + `window.print()` satisfies issue #9's "at least downloadable PDF" via the browser's print-to-PDF with zero bundle cost. WhatsApp share is a pure string formatter — fully unit-testable.

### D5 — Undo in TicketView (MUST, user-validated)
The RPC rule is **global last-sale-only** (any later confirmed sale, from any device, invalidates undo). By construction, the TicketView of a just-confirmed sale shows the global last sale; if another sale slipped in, `deshacer_venta` rejects with `'solo se puede deshacer la última venta confirmada'` and the UI surfaces it as a toast. Minor deviation from the design handoff (which doesn't draw the button) — validated by the user.

### D7 — Seller name own-sale-only (SHOULD)
Seller display name lives in session `user_metadata.display_name`; `profiles` has no name column and its RLS is own-row, so there is no readable source for other sellers' names. The ticket shows the name on the just-confirmed (own) sale and omits the field when deep-linking someone else's sale.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/venta/SaleScreen.tsx` | Modified | Skeleton → real cart/search/payment/confirm screen. |
| `src/features/venta/TicketView.tsx` | Modified | Skeleton → receipt + print + WhatsApp + undo + nueva venta. |
| `src/features/venta/ventaApi.ts` | New | RPC wrappers + venta/items/config fetch (catalogo pattern). |
| `src/features/venta/ventaUtils.ts` | New | WhatsApp text, RPC error parser, totals (pure, TDD). |
| `src/stores/saleDraft.ts` | Modified | setQuantity/removeLine/clearDraft, medioPago, stock snapshot. |
| `src/index.css` (or print stylesheet) | Modified | 80mm `@media print` / `@page` rules + `.no-print`. |
| `src/lib/router.tsx` | Unchanged | `/venta` and `/venta/:id/ticket` already wired. |
| Supabase | Unchanged | Zero migrations. |
| `openspec/changes/venta/` | New | SDD artifacts for this change. |
| `openspec/specs/venta/spec.md` | Modified | Add UI/API contracts to the existing domain spec. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | Global undo rule: concurrent sale on another device invalidates undo | Med | Map RPC rejection to a clear toast; spec the scenario (Given/When/Then). |
| R2 | Free-text RPC error parsing is fragile | Med | Match only stable prefixes + uuid regex (D9); fall back to generic error without line flag. |
| R3 | Seller name unreadable for others' sales | Low | D7: show name only on own sale, omit otherwise. |
| R4 | Issue #9 reprint-from-history AC unmet here | High (by design) | Declared deferred to `dashboard`; TicketView deep-linkable by id so history can link it later. |
| R5 | Stale stock snapshot in a long-lived draft | Med | Advisory only; server rejects on confirm and the failing line is flagged (D2/D9). |
| R6 | `BarcodeDetector` unsupported on iOS/Safari | Low | Manual fallback already inherited from catalogo; not a new risk. |

## Rollback Plan

This change adds/modifies only client files and openspec artifacts — no schema, no migrations. Rollback = revert the PR; skeleton screens restored, `saleDraft` additions removed. No data migration or database rollback needed.

## Dependencies

- `data-model` (archived, LIVE) — `ventas`/`venta_items`/`movimientos_stock`, `confirmar_venta`, `deshacer_venta`, RLS.
- `auth-pin` (archived, LIVE) — roles, route guards, `is_active()` gates.
- `catalogo` (archived, LIVE) — components (`BottomNav`, `ScreenHeader`, `SearchInput`, `Stepper`, …), `catalogoApi` pattern, scanner flow, `saleDraft` atom.

## Success Criteria

- [ ] Admin and empleado can build a cart (search + scanner), pick medio de pago, and confirm a sale.
- [ ] Confirm decrements stock server-side; client never sends price/total.
- [ ] Out-of-stock confirm failure flags the affected line and keeps the draft intact.
- [ ] "Deshacer última venta" works on the just-confirmed TicketView; global-rule rejection surfaces as a toast.
- [ ] Ticket renders per handoff; prints to 80mm/PDF via `window.print()`; shares via WhatsApp plain text.
- [ ] Empleado sees no product cost anywhere in the sale flow (issue #6 AC).
- [ ] TicketView is deep-linkable by id (enables future reprint from history).
- [ ] CI green: lint, format, typecheck, test, build.
- [ ] TDD discipline: tests exist for `ventaApi`, `ventaUtils`, `saleDraft`, atomic components.
- [ ] Change documented and archived in `openspec/`.

## Open Questions for design

- OQ-1: Exact print CSS structure — single print stylesheet vs. a hidden print-only ticket component.
- OQ-2: Whether SaleScreen refetches stock on mount to refresh Stepper maxes (advisory polish).
- OQ-3: Undo button placement/styling within TicketView (handoff doesn't draw it).
- OQ-4: Post-undo UX — navigate where, and does the ticket view show the cancelled state.
