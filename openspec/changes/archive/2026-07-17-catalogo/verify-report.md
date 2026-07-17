> change: catalogo
> phase: verify
> status: completed
> updated_at: 2026-07-17

# Verify report — catálogo

## Scope

Client-side catalog feature: list/search/filter products, product detail with role-based cost card, create/edit form (admin-only), and barcode scanner with manual fallback.

## Automated verification

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | ✓ passed |
| Format | `pnpm format:check` | ✓ passed |
| Typecheck | `pnpm typecheck` | ✓ passed |
| Tests | `pnpm test` | ✓ 166 passed, 7 skipped (local-only RLS battery) |
| Build | `pnpm build` | ✓ passed |

## New test coverage

- `src/features/catalogo/catalogoApi.test.ts` — 11 tests
- `src/features/catalogo/catalogoUtils.test.ts` — 18 tests
- `src/features/catalogo/CatalogScreen.test.tsx` — 10 tests
- `src/features/catalogo/ProductDetailScreen.test.tsx` — 6 tests
- `src/features/catalogo/ProductFormScreen.test.tsx` — 6 tests
- `src/features/escaner/barcodeDetection.test.ts` — 6 tests
- `src/features/escaner/ScannerScreen.test.tsx` — 4 tests
- `src/stores/saleDraft.test.ts` — 3 tests

## Manual / design verification

- `CatalogScreen` debounces search at 300 ms (DD-1).
- Client-side pagination loads first 50 products with "Cargar más" (DD-2).
- Default sort is `nombre ASC` via `fetchProducts` (DD-3).
- Create (+) button is hidden for employees (DD-4).
- Reads use PostgREST; writes use `crear_producto` / `actualizar_producto` RPC (DD-5).
- `producto_costos` embed degrades to `null` for employees (DD-6).
- SKU matching is exact after normalization (DD-7).
- Admin sees cost/margin card and edit button; employee sees only product info and "Agregar a la venta".
- Scanner falls back to manual SKU input when `BarcodeDetector` is unavailable.

## Notes

- No new database migrations; feature builds on existing `data-model` schema.
- Route-level `<RequireAdmin>` wraps `/catalogo/new` and `/catalogo/:id/edit`; real authorization boundary remains the RPC/RLS layer.
