---
change: venta
phase: tasks
status: ready
depends_on: [proposal, specs, design]
persistence: openspec+engram
sequencing_source: "design.md §1 layer order (utils/store → api → ui → screens) + catalogo TDD precedent"
phase_count: 11
task_count: 26
progress: "26/26"
updated_at: 2026-08-13
---

# Tasks: venta — sale flow (cart, charge, undo, ticket)

Pure frontend over the LIVE backend (D1 — zero migrations). Method: **TDD** — every RED task (tests)
precedes its GREEN task (implementation), per the catalogo D7 precedent. Refs trace to `proposal.md`
decisions (D-n), `design.md` decisions (DD-n), and `specs/venta/spec.md` requirements (REQ-VENTA-UI-n).

**Phase gate (every phase):** all five gates green — `pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm test`, `pnpm build` — then ONE squash-merged PR to `main`.
CI must be green on the PR before merge (the transient outage around 2026-07-17 has
resolved; local gate output is not a substitute for CI green).
**Exception:** Phase 0 is verification-only (read-only baseline checks) and has no
code changes of its own; it is folded into Phase 1's PR.

## Phase 0 — Baseline & housekeeping

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-0.1 | Confirm baseline: five gates green on `main`; `confirmar_venta`/`deshacer_venta` present in `src/lib/database.types.ts` RPC types. | — | D1 | `pnpm test` green; both RPCs typed | [x] |
| T-0.2 | Verify RPC error strings in `supabase/migrations/20260714000000_auth_pin_multirole.sql` match DD-5's stable prefixes (`'stock insuficiente'`, `'solo se puede deshacer'`, `'la venta no está confirmada'`, `'usuario inactivo'`). | — | DD-5 | prefixes match the SQL verbatim | [x] |

## Phase 1 — `saleDraft` extension (DD-6, TDD)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-1.1 | RED: extend store tests — `setQuantity` (qty ≤ 0 removes line), `removeLine`, `clearDraft` (resets lines/note/medioPago to `'efectivo'`), `setMedioPago`, `addLine` stores `stockSnapshot`, merge-repeat keeps snapshot. | `src/stores/saleDraft.test.ts` | DD-6, REQ-VENTA-UI-1 | new tests fail against current store | [x] |
| T-1.2 | GREEN: implement — `SaleLine.stockSnapshot: number \| null`, `SaleDraft.medioPago` (default `'efectivo'`), the four actions. | `src/stores/saleDraft.ts` | DD-6 | T-1.1 tests pass; typecheck green | [x] |

## Phase 2 — `ventaTypes` + `ventaUtils` (pure, TDD; DD-5, DD-8)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-2.1 | RED: pure tests — `parseRpcError` every DD-5 prefix + uuid regex + `hay N, pide M` capture + unknown fallback; `draftTotal`; `shortRef` (first 8 chars); `formatTicketDate` (es-CL); `MEDIO_PAGO_LABELS`; `buildWhatsAppText` (store/date/ref/items/total/medio/gracias; `Atiende:` only when seller passed; seller fallback to email local-part; omitted when no seller identifier). | `src/features/venta/ventaUtils.test.ts` | DD-5, DD-8, D7, D8 | tests fail (module absent) | [x] |
| T-2.2 | GREEN: implement types (`MedioPago`, `VentaItem`, `Venta`, `ParsedRpcError`) and all utils. | `src/features/venta/ventaTypes.ts`, `src/features/venta/ventaUtils.ts` | DD-5, DD-8 | T-2.1 tests pass | [x] |

## Phase 3 — `ventaApi` (DD-5 error contract, catalogoApi pattern)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-3.1 | RED: API tests mocking ONLY `@/lib/supabase` — `confirmSale` sends `{producto_id, cantidad}[]` + medio, never price/total; `undoSale` args; `fetchVenta` embed shape + null; `fetchStoreName`; `fetchStock`; RPC error thrown as `new Error(error.message)` verbatim. | `src/features/venta/ventaApi.test.ts` | DD-5, REQ-VENTA-UI-2, REQ-DM-VENTA-3 | tests fail (module absent) | [x] |
| T-3.2 | GREEN: implement the five functions; embed cast `data as Venta` (catalogoApi idiom, `Relationships: []`). | `src/features/venta/ventaApi.ts` | DD-5 | T-3.1 tests pass | [x] |

## Phase 4 — `Toast` organism + `showToast` (DD-7, TDD)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-4.1 | RED: component tests — renders `$ui.toastMessage` with type styling, hidden when null, auto-dismiss ~4 s; `showToast(message, type)` sets the atom. | `src/components/organisms/Toast.test.tsx` | DD-7 | tests fail | [x] |
| T-4.2 | GREEN: implement `Toast` organism + `showToast()` in `src/stores/ui.ts`; export from organisms `index.ts`; mount once in `AppShell` (`src/main.tsx`). | `src/components/organisms/Toast.tsx`, `src/stores/ui.ts`, `src/components/organisms/index.ts`, `src/main.tsx` | DD-7 | T-4.1 tests pass; toast visible app-wide | [x] |

## Phase 5 — SaleScreen: cart UI (REQ-VENTA-UI-1, TDD)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-5.1 | RED: screen tests (mock `ventaApi`/`saleDraft`) — repeated product merges into one line; stepper to 0 removes; empty state blocks confirm; medio-pago chips with Efectivo preselected; total updates live; Stepper `max=stockSnapshot` + over-snapshot warning; confirm CTA disabled/loading while RPC in flight. | `src/features/venta/SaleScreen.test.tsx` | REQ-VENTA-UI-1, REQ-VENTA-UI-2, DD-6 | tests fail against skeleton | [x] |
| T-5.2 | GREEN: implement cart UI — `ScreenHeader("Nueva venta")`, `SearchInput` + `fetchProducts({search})` tap→`addLine`, scanner button → `/escaner`, cart lines (name, `qty × $unit`, line total, `Stepper`), footer total + chips + CTA `Confirmar venta · $total` disabled when empty/over-snapshot. | `src/features/venta/SaleScreen.tsx` | REQ-VENTA-UI-1, REQ-VENTA-UI-2 | T-5.1 tests pass | [x] |

## Phase 6 — SaleScreen: confirm flow + stock refetch + call sites (REQ-VENTA-UI-2, DD-2)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-6.1 | RED: confirm-flow tests — happy path (RPC gets only ids+cantidades+medio → `clearDraft` → navigate `/venta/:id/ticket` replace); confirm CTA disabled/loading from tap until RPC settles and blocks duplicate taps; `stock_insuficiente` flags matching line red, draft intact; `unknown` → toast; `usuario_inactivo` → force lock; mount refetches `fetchStock` for draft productIds and refreshes snapshots. | `src/features/venta/SaleScreen.test.tsx` | REQ-VENTA-UI-2, DD-2, DD-5 | tests fail | [x] |
| T-6.2 | GREEN: wire confirm handler + DD-2 mount refetch into `SaleScreen`. | `src/features/venta/SaleScreen.tsx` | REQ-VENTA-UI-2, DD-2 | T-6.1 tests pass | [x] |
| T-6.3 | Update `addLine` call sites to pass `stockSnapshot: product.stock`; adjust their existing tests. | `src/features/escaner/ScannerScreen.tsx`, `src/features/catalogo/ProductDetailScreen.tsx` (+ tests) | DD-6 | five gates green | [x] |

## Phase 7 — TicketView: render + deep link (REQ-VENTA-UI-4, TDD)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-7.1 | RED: tests (mock `ventaApi`, `$auth`) — receipt renders store name, lines, total, medio label, fecha, `Ticket #<shortRef>`; seller name iff `venta.actor_id === $auth.user.id`; fallback to email local-part when `display_name` is absent; deep-link by id loads any readable venta; success banner; `fetchVenta` returning `null` renders "Venta no encontrada o no accesible" with a "Nueva venta" CTA. | `src/features/venta/TicketView.test.tsx` | REQ-VENTA-UI-4, D7, D8 | tests fail against skeleton | [x] |
| T-7.2 | GREEN: implement receipt card per handoff + `fetchVenta`/`fetchStoreName` wiring. | `src/features/venta/TicketView.tsx` | REQ-VENTA-UI-4 | T-7.1 tests pass | [x] |

## Phase 8 — TicketView: undo + deshecha state (REQ-VENTA-UI-3, DD-3, DD-4, TDD)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-8.1 | RED: tests — two-tap confirm (label switches, second tap calls `undoSale`); success → refetch, "Venta deshecha" banner, WhatsApp/Imprimir/Deshacer hidden, + Nueva venta kept; `not_last_sale` → toast, sale stays `confirmada`, button hides; undo button only while `estado='confirmada'`. | `src/features/venta/TicketView.test.tsx` | REQ-VENTA-UI-3, DD-3, DD-4 | tests fail | [x] |
| T-8.2 | GREEN: implement actions stack (WhatsApp / Imprimir / Deshacer danger-outline / + Nueva venta) and the undo flow. | `src/features/venta/TicketView.tsx` | REQ-VENTA-UI-3, DD-3, DD-4 | T-8.1 tests pass | [x] |

## Phase 9 — TicketView: print + WhatsApp output (REQ-VENTA-UI-5, DD-1, DD-8, DD-9)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-9.1 | RED: tests — Imprimir calls `window.print()`; WhatsApp button opens `wa.me/?text=<encoded buildWhatsAppText output>` (`window.open` mocked); `PrintTicket` markup carries `.print-only`, chrome/card carry `.no-print`. | `src/features/venta/TicketView.test.tsx` | REQ-VENTA-UI-5, DD-1, DD-8 | tests fail | [x] |
| T-9.2 | GREEN: `PrintTicket` hidden print block (`ui-monospace`, ~72mm, replicates `Ticket Térmico.dc.html`) + `index.css` rules (`.print-only`, `@media print`, `@page 80mm auto, margin 4mm`) + button wiring. | `src/features/venta/TicketView.tsx`, `src/index.css` | DD-1, DD-9 | T-9.1 tests pass; manual print-to-PDF fits 80mm | [x] |

## Phase 10 — Role boundary + verify prep (REQ-VENTA-UI-6, D11)

| ID | Task | Files | Refs | Verification | Status |
|---|---|---|---|---|---|
| T-10.1 | Role-boundary tests: empleado session walks search → cart → confirm → ticket with zero product cost rendered; static guard that `src/features/venta/**` imports no cost components / never queries `producto_costos`. (Catalogo `fetchProducts` may expose cost to admins; empleados are blocked by RLS — the static guard covers only the sale feature boundary.) | `src/features/venta/*.test.tsx` | REQ-VENTA-UI-6, D11, REQ-DM-SEG-3 | tests pass; grep finds no cost reference inside `src/features/venta/**` | [x] |
| T-10.2 | Manual browser pass: full sale → print-to-PDF → WhatsApp share → undo; empleado sees no cost. Ensure CI is green before merge. | — | success criteria | walkthrough noted in PR; CI green | [x] |
| T-10.3 | Mark all tasks `[x]`, update `state.yaml` (apply: completed, verify: pending); hand off to sdd-verify. | `tasks.md`, `state.yaml` | — | state consistent | [x] |
