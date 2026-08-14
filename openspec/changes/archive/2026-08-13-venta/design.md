---
change: venta
phase: design
status: completed
depends_on: [data-model, auth-pin, catalogo]
supersedes: ~
persistence: openspec
updated_at: 2026-08-07
resolves_open_questions: [OQ-1, OQ-2, OQ-3, OQ-4]
carries_forward: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11]
design_decisions: [DD-1, DD-2, DD-3, DD-4, DD-5, DD-6, DD-7, DD-8, DD-9, DD-10]
---

# Design: venta — sale flow (cart, charge, undo, ticket)

## 1. Technical approach

Pure frontend on a complete backend (D1): `confirmar_venta(p_items jsonb, p_medio_pago text)` and `deshacer_venta(p_venta_id uuid)` are live in prod (`supabase/migrations/20260714000000_auth_pin_multirole.sql:128,169`); `ventas`/`venta_items`/`configuracion` are SELECT-readable by any active `authenticated` user. The client sends only `{producto_id, cantidad}[]` + medio de pago — never price or total.

Three layers, mirroring catalogo: **API layer** (`ventaApi.ts`, mocks only Supabase), **pure utils** (`ventaUtils.ts`, TDD), **screens** (`SaleScreen`, `TicketView` — thin containers over shared components). Method: TDD, tests first for API/utils/store/atoms.

## 2. Design decisions

| ID | Resolves | Decision | Rejected |
|----|----------|----------|----------|
| DD-1 | OQ-1 | **Print-only hidden markup** in TicketView + `.no-print`/`.print-only` + `@page 80mm` in `index.css` | Print-styling the on-screen card (color layout unsuited to thermal); separate print route |
| DD-2 | OQ-2 | **Stock refetch on SaleScreen mount** for draft productIds → refresh `stockSnapshot` (advisory Stepper max + warning) | No refetch (stale maxes); Realtime (D10) |
| DD-3 | OQ-3 | Undo = **danger-outline button in TicketView actions stack** (between Imprimir and + Nueva venta), two-tap inline confirm, only while `estado='confirmada'` | Modal dialog (heavier); button on SaleScreen (D5) |
| DD-4 | OQ-4 | Post-undo: **stay on TicketView, refetch, "Venta deshecha" banner**; hide WhatsApp/Imprimir/Deshacer; keep + Nueva venta. Draft stays cleared (cleared at confirm) | Navigate to /venta with restored draft (implies editing a cancelled sale) |
| DD-5 | D9 | `parseRpcError` matches **stable prefixes + uuid regex**; `ventaApi` throws preserving the raw RPC message | catalogoApi-style generic throws (loses the parse contract) |
| DD-6 | D2 | `saleDraft` += `medioPago` (default `'efectivo'`), `stockSnapshot` per line, `setQuantity`/`removeLine`/`clearDraft`/`setMedioPago` | Separate store |
| DD-7 | D5 | New **`Toast` organism** rendering the designed-but-unrendered `$ui.toastMessage` + `showToast()` helper; mounted in `AppShell` | Inline banners per screen (duplicated; `$ui` already exists for this) |
| DD-8 | D4 | WhatsApp = plain-text ticket via `buildWhatsAppText()` → `window.open('https://wa.me/?text=' + encodeURIComponent(t))` | wa.me with phone number (no fixed customer number exists) |
| DD-9 | OQ-1 | Print ticket font = **system `ui-monospace` stack** — zero new binary assets, print-only; screens stay DM Sans | Self-host DM Mono woff2 (faithful to handoff but adds binaries for a print-only path) |
| DD-10 | D8 / handoff | **SaleScreen renders `BottomNav active="venta"`** — same chrome as catalogo screens, not full-screen | Full-screen sale flow (breaks the established app-shell pattern) |

### DD-3 — Undo button (handoff deviation, user-validated)

Actions stack order: **Compartir por WhatsApp** (green, handoff), **Imprimir ticket** (secondary outline — also absent from the in-app handoff, required by D4), **Deshacer última venta** (danger outline, `text-error`/`border-error`), **+ Nueva venta** (dark primary). Two-tap confirm: first tap switches label to "¿Confirmar? Toca de nuevo"; second tap calls `undoSale`. The global last-sale rule is enforced server-side; rejection `'solo se puede deshacer la última venta confirmada'` surfaces via toast and the button hides (the ticket is no longer undoable).

### DD-5 — RPC error contract (from the actual SQL)

Stable prefixes → discriminated union:

```ts
type ParsedRpcError =
  | { kind: 'stock_insuficiente'; productId: string; available: number; requested: number }
  | { kind: 'not_last_sale' }        // 'solo se puede deshacer la última venta confirmada'
  | { kind: 'not_confirmed' }        // 'la venta no está confirmada'
  | { kind: 'usuario_inactivo' }     // also 'no autenticado' → session problem, force lock
  | { kind: 'unknown'; message: string }
```

uuid regex: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i` (first match in the message); `hay N, pide M` captured from `'stock insuficiente % (hay %, pide %)'`. Other prefixes (`'venta sin items'`, `'medio de pago inválido'`, `'producto inexistente'`, `'cantidad inválida'`) map to `unknown` with the original message — the draft invariants make them unreachable in practice. Supabase-js surfaces `RAISE EXCEPTION` text in `error.message`, so `ventaApi` throws `new Error(error.message)` verbatim (deviation from catalogoApi's generic messages, justified by this contract).

## 3. Data model and API contracts

```ts
// src/features/venta/ventaTypes.ts
export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'
export interface VentaItem { id: string; cantidad: number; precio_unitario: number; nombre: string }
export interface Venta {
  id: string; created_at: string; medio_pago: MedioPago; total: number
  estado: 'confirmada' | 'deshecha'; actor_id: string | null; items: VentaItem[]
}

// src/features/venta/ventaApi.ts (mocks only the Supabase boundary, catalogoApi pattern)
confirmSale(lines: SaleLine[], medioPago: MedioPago): Promise<string>  // rpc confirmar_venta, maps {producto_id, cantidad}
undoSale(ventaId: string): Promise<void>                                // rpc deshacer_venta
fetchVenta(id: string): Promise<Venta | null>      // ventas select *, venta_items(cantidad, precio_unitario, productos(nombre))
fetchStoreName(): Promise<string>                  // configuracion singleton → nombre_tienda
fetchStock(productIds: string[]): Promise<Record<string, number>>      // DD-2: productos.select('id,stock').in('id', ids)
```

`database.types.ts` has `Relationships: []`, so embeds are cast like catalogoApi does (`data as Venta`). Medio-pago chip labels per handoff: `efectivo→Efectivo`, `transferencia→Transfer`, `debito→Débito`, `credito→Crédito` (Efectivo preselected).

```ts
// src/features/venta/ventaUtils.ts (pure, TDD)
parseRpcError(message: string): ParsedRpcError
buildWhatsAppText(v: Venta, store: string, seller?: string): string  // seller omitted when absent; falls back to email local-part if display_name missing
draftTotal(lines: SaleLine[]): number
shortRef(uuid: string): string          // first 8 chars — D8 ("Ticket #a1b2c3d4")
formatTicketDate(iso: string): string   // Intl.DateTimeFormat es-CL
MEDIO_PAGO_LABELS: Record<MedioPago, string>
```

WhatsApp text: store name, date, `Ticket #<shortRef>`, `Atiende: <seller>` (own sale only, D7; fallback to email local-part if `display_name` is absent; omit line if no seller identifier is available), one block per item (`nombre` / `qty × $unit = $subtotal` via `formatPrice`), dashed separators, `TOTAL $…`, medio de pago label, `¡Gracias por tu compra!`.

## 4. `saleDraft` extension (DD-6)

```ts
interface SaleLine { productId; sku; name; quantity; unitPrice; stockSnapshot: number | null }
interface SaleDraft { lines: SaleLine[]; note: string; medioPago: MedioPago }

setQuantity(productId: string, qty: number)  // qty <= 0 removes the line
removeLine(productId: string)
clearDraft()                                  // lines=[], note='', medioPago='efectivo'
setMedioPago(mp: MedioPago)
```

`stockSnapshot` is advisory only (Stepper `max`, "sin stock suficiente" warning); the server stays authoritative (D2/D10). `ScannerScreen` and `ProductDetailScreen` addLine calls gain `stockSnapshot: product.stock`.

## 5. Components and screens

- **SaleScreen** (`/venta`): `ScreenHeader("Nueva venta")`, `BottomNav active="venta"` (DD-10), `SearchInput` + scanner button (`navigate('/escaner')`), search results (reuse `fetchProducts({search})`, tap → `addLine` qty 1), cart lines (name, subtitle, `qty × $unit`, line total, `Stepper` with `max=stockSnapshot`), footer: total, medio-pago chips, CTA `Confirmar venta · $total` (disabled when empty/any line over snapshot; enters loading state once tapped). Confirm → set in-flight guard → `confirmSale` → `clearDraft()` → `navigate('/venta/' + id + '/ticket', { replace: true })`. `stock_insuficiente` → flag matching line red, keep draft (R5); other errors → toast. Mount → DD-2 refetch.
  - *Cost note:* search reuses the catalogo `fetchProducts` helper; for empleados its cost columns are unreadable via RLS, and no cost data is rendered or stored inside `src/features/venta/**`.
- **TicketView** (`/venta/:id/ticket`, deep-linkable): fetch `fetchVenta` + `fetchStoreName`. `null` result → "Venta no encontrada o no accesible" empty state with "Nueva venta" CTA to `/venta`. Success banner, receipt card per handoff (store header, items, total, medio de pago, `Ticket #<shortRef>`, seller name iff `venta.actor_id === $auth.user.id` — D7; fallback to email local-part if `display_name` missing, omit line if unavailable), actions stack (DD-3), print-only `<PrintTicket>` block (DD-1). Deshecha state per DD-4.
- **Toast** (new organism): reads `$ui`, auto-dismiss ~4 s; `showToast(message, type)` helper in `stores/ui.ts`. Mounted once in `AppShell`.

## 6. Data flow

```
/venta ──scan btn──▶ /escaner ──addLine──▶ $saleDraft ◀── ProductDetail
  │                       ▲                     │ setQuantity/removeLine/medioPago
  ▼ confirm               └──────── back ───────┘
confirmSale(lines, medioPago) ──ok──▶ clearDraft ─▶ /venta/:id/ticket (replace)
  └── 'stock insuficiente <uuid>…' ─▶ parseRpcError ─▶ flag line, draft intact
/venta/:id/ticket ──fetchVenta──▶ receipt ──deshacer──▶ undoSale ─▶ refetch ─▶ 'deshecha'
```

## 7. Print CSS (DD-1)

`index.css` gains: `.print-only { display: none }` and `@media print { .no-print { display: none !important } .print-only { display: block } @page { size: 80mm auto; margin: 4mm } }`. `PrintTicket` replicates `Ticket Térmico.dc.html` (store header, fecha, ticket ref, vendedora, items, TOTAL, medio de pago, footer) in `ui-monospace`, black on white, fixed ~72mm content width. App chrome and the on-screen card carry `no-print`. No dependencies, no CSP change (D4).

## 8. Security and role handling

Admin and empleado see an identical sale flow (D11): `SaleLine` carries no cost, no admin cost component is reused inside `src/features/venta/**`, and the ticket embed selects only `nombre`. The real boundary stays RLS/RPC (`is_active()` gates both RPCs; `producto_costos` is never queried from venta). Search reuses catalogo `fetchProducts`, whose cost columns are unreadable to empleados via RLS. Route guards unchanged (`<RequireSession>` already wraps both routes).

## 9. Migration / schema impact

None. Zero migrations; rollback = revert PR.

## 10. Testing strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `ventaApi` (query shapes, RPC args, raw-message throw) | Mock only `@/lib/supabase` (catalogoApi.test pattern) |
| Unit | `ventaUtils` (parseRpcError all prefixes + uuid/regex, WhatsApp text, totals, shortRef) | Pure vitest |
| Unit | `saleDraft` (setQuantity 0-removes, medioPago, clearDraft, snapshot) | Extend existing store tests |
| Component | `Toast`, medio-pago chips, line-flag state | Testing Library |
| Screen | SaleScreen (add/search/confirm/error-flag), TicketView (render, undo two-tap, deshecha state, own-sale seller name) | Mock `ventaApi`/`saleDraft` |
| Manual | Full sale → print-to-PDF → WhatsApp share → undo; empleado sees no cost | Browser |

## 11. Open questions resolved

- OQ-1 → DD-1 + DD-9 (print-only block + `@page 80mm`, system monospace).
- OQ-2 → DD-2 (refetch on mount, advisory).
- OQ-3 → DD-3 (danger-outline button in actions stack, two-tap confirm).
- OQ-4 → DD-4 (stay on TicketView, deshecha banner, draft stays cleared).
