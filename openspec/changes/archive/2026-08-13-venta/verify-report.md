---
change: venta
phase: verify
status: completed
depends_on: [data-model, auth-pin, catalogo]
supersedes: ~
persistence: openspec
updated_at: 2026-08-13
---

# Verification Report — venta

## Change

**venta** — sale flow (cart, charge, undo, ticket) frontend over the live backend.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 26 |
| Tasks complete | 26 |
| Tasks incomplete | 0 |

All tasks in `tasks.md` are marked `[x]`. Note: the file's front-matter says `progress: "0/26"`, which is inconsistent with the task list; it should read `progress: "26/26"`.

## Build & Tests Execution

**Lint**: ✅ Passed
```
$ eslint .
```

**Format check**: ✅ Passed
```
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

**Type check**: ✅ Passed
```
$ tsc -p tsconfig.app.json --noEmit
```

**Build**: ✅ Passed
```
$ tsc -p tsconfig.app.json && vite build
vite v6.4.3 building for production...
✓ 4682 modules transformed.
✓ built in 5.95s
```

Build emitted one non-blocking warning: the `index` chunk is 508.66 kB after minification (slightly above Vite's default 500 kB chunk-size warning limit). This is pre-existing application-level bundling behavior and does not affect functionality.

**Tests**: ✅ 233 passed / ❌ 0 failed / ⚠️ 7 skipped
```
$ vitest run
Test Files  28 passed | 1 skipped (29)
     Tests  233 passed | 7 skipped (240)
```

The 7 skipped tests are `src/lib/authPinRlsBattery.test.ts`, which only runs when `RUN_LOCAL_RLS_BATTERY=1` is set against a local Supabase stack (documented project convention).

**Coverage**: ➖ Not configured

No `coverage_threshold` is set in `openspec/config.yaml` (file does not exist).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-VENTA-UI-1 — Cart: entry, quantity, live total | repeated product merges into one line | `src/features/venta/SaleScreen.test.tsx > should_merge_repeated_product_into_one_line` | ✅ COMPLIANT |
| REQ-VENTA-UI-1 — Cart: entry, quantity, live total | stepper to zero removes the line | `src/features/venta/SaleScreen.test.tsx > should_remove_line_when_stepper_goes_to_zero` | ✅ COMPLIANT |
| REQ-VENTA-UI-1 — Cart: entry, quantity, live total | empty cart blocks confirm | `src/features/venta/SaleScreen.test.tsx > should_show_empty_state_and_block_confirm_when_cart_is_empty` | ✅ COMPLIANT |
| REQ-VENTA-UI-2 — Confirm: payment method + atomic RPC | confirm happy path | `src/features/venta/SaleScreen.test.tsx > should_confirm_sale_and_navigate_to_ticket` | ✅ COMPLIANT |
| REQ-VENTA-UI-2 — Confirm: payment method + atomic RPC | confirm in-flight guard | `src/features/venta/SaleScreen.test.tsx > should_disable_confirm_while_rpc_is_in_flight_and_block_duplicate_taps` | ✅ COMPLIANT |
| REQ-VENTA-UI-2 — Confirm: payment method + atomic RPC | stock failure flags the line | `src/features/venta/SaleScreen.test.tsx > should_flag_line_and_keep_draft_on_stock_insuficiente` | ✅ COMPLIANT |
| REQ-VENTA-UI-3 — Undo last sale from the ticket | undo the just-confirmed sale | `src/features/venta/TicketView.test.tsx > should_call_undoSale_on_second_tap` | ✅ COMPLIANT |
| REQ-VENTA-UI-3 — Undo last sale from the ticket | a newer sale slipped in | `src/features/venta/TicketView.test.tsx > should_show_toast_and_hide_undo_on_not_last_sale` | ✅ COMPLIANT |
| REQ-VENTA-UI-4 — Ticket rendering and deep link | seller name only on own sale | `src/features/venta/TicketView.test.tsx > should_show_seller_name_only_on_own_sale` | ✅ COMPLIANT |
| REQ-VENTA-UI-4 — Ticket rendering and deep link | seller name only on own sale (someone else's) | `src/features/venta/TicketView.test.tsx > should_omit_seller_for_someone_elses_sale` | ✅ COMPLIANT |
| REQ-VENTA-UI-4 — Ticket rendering and deep link | missing or inaccessible sale | `src/features/venta/TicketView.test.tsx > should_render_not_found_state` | ✅ COMPLIANT |
| REQ-VENTA-UI-5 — Print and WhatsApp output | print to 80mm | `src/features/venta/TicketView.test.tsx > should_call_window_print` | ✅ COMPLIANT |
| REQ-VENTA-UI-5 — Print and WhatsApp output | WhatsApp share | `src/features/venta/TicketView.test.tsx > should_open_whatsapp_with_encoded_text` | ✅ COMPLIANT |
| REQ-VENTA-UI-6 — Employee cost concealment | empleado completes a full sale | `src/features/venta/SaleScreen.test.tsx > should_never_render_cost_for_employee_session` | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-VENTA-UI-1 | ✅ Implemented | `SaleScreen.tsx` renders search, scanner button, cart lines with `Stepper`, live total, empty state; `saleDraft.ts` exposes `setQuantity`, `removeLine`, `clearDraft`, `setMedioPago`, and `addLine` merges repeated products. |
| REQ-VENTA-UI-2 | ✅ Implemented | `SaleScreen.tsx` calls `confirmSale(lines, medioPago)`; CTA is disabled while submitting and shows loading text; RPC error is parsed by `parseRpcError` and stock failures flag the matching line; draft is not cleared on error. |
| REQ-VENTA-UI-3 | ✅ Implemented | `TicketView.tsx` exposes "Deshacer última venta" with two-tap confirmation; calls `undoSale`; success refetches and shows the cancelled state; `not_last_sale` surfaces via toast and hides the undo button. |
| REQ-VENTA-UI-4 | ✅ Implemented | `TicketView.tsx` fetches `fetchVenta(id)` and `fetchStoreName()`; renders store name, items, total, payment label, date/time, short ref, and seller name only for own sale; bad/missing id renders the empty state with a "Nueva venta" CTA. |
| REQ-VENTA-UI-5 | ✅ Implemented | `TicketView.tsx` calls `window.print()` and opens `https://wa.me/?text=` with `buildWhatsAppText`; `index.css` defines `.print-only`, `.no-print`, and `@page { size: 80mm auto; margin: 4mm }`. |
| REQ-VENTA-UI-6 | ✅ Implemented | `src/features/venta/**` carries no cost data; `SaleScreen` lines only store `unitPrice`; `TicketView` embed selects only `nombre`; `ScannerScreen`/`ProductDetailScreen` call sites pass only sell-side fields. |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| DD-1 — Print-only hidden markup + `@page 80mm` | ✅ Yes | `PrintTicket` is rendered inside `print-only hidden`; `index.css` has the print media query. |
| DD-2 — Stock refetch on `SaleScreen` mount | ✅ Yes | `useEffect` with empty deps calls `fetchStock(productIds)` and refreshes `stockSnapshot`. |
| DD-3 — Undo danger-outline button in TicketView, two-tap confirm | ✅ Yes | Button switches label to "¿Confirmar? Toca de nuevo" on first tap. |
| DD-4 — Post-undo stay on TicketView, deshecha banner | ✅ Yes | Success refetches venta, shows "Venta deshecha" banner, hides action buttons, keeps "+ Nueva venta". |
| DD-5 — RPC error contract (stable prefixes + uuid regex) | ✅ Yes | `parseRpcError` in `ventaUtils.ts` matches the documented prefixes and regexes; `ventaApi.ts` throws RPC messages verbatim. |
| DD-6 — `saleDraft` extension | ✅ Yes | `medioPago`, `stockSnapshot`, `setQuantity`, `removeLine`, `clearDraft`, `setMedioPago` all present. |
| DD-7 — `Toast` organism + `showToast` | ✅ Yes | `Toast.tsx` reads `$ui`, auto-dismisses in 4s, mounted once in `AppShell`. |
| DD-8 — WhatsApp plain-text formatter | ✅ Yes | `buildWhatsAppText` produces plain text and is used by `handleWhatsApp`. |
| DD-9 — System monospace for print ticket | ✅ Yes | `PrintTicket` uses `font-mono` (system monospace stack) with no new font assets. |
| DD-10 — `BottomNav active="venta"` on `SaleScreen` | ✅ Yes | `SaleScreen.tsx` renders `<BottomNav active="venta" />`. |

## Issues Found

**CRITICAL** (must fix before archive):
- None

**WARNING** (should fix):
- `tasks.md` front-matter `progress: "0/26"` does not match the 26 `[x]` task rows. Update to `progress: "26/26"` for consistency.
- Build warning: `dist/assets/index-CTPUDZeB.js` is 508.66 kB after minification (above Vite's 500 kB default warning limit). This is not a failure, but chunking could be revisited in a future polish change.

**SUGGESTION** (nice to have):
- None

## Verdict

**PASS**

All five project gates (lint, format, typecheck, test, build) are green, and every spec scenario in the delta spec has a passing test proving the behavior at runtime. The implementation matches the design decisions documented in `design.md` and the proposal scope. The change is ready for archive.
