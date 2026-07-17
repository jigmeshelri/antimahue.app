---
change: catalogo
phase: tasks
status: in_progress
depends_on: [data-model, auth-pin]
persistence: openspec
updated_at: 2026-07-17
---

# Tasks: catálogo

## Phase 0 — Housekeeping
- [x] T-0.1 Regenerate `src/lib/database.types.ts` from live schema.
- [x] T-0.2 Verify typecheck/lint/format/test/build baseline is green.
- [x] T-0.3 Create `openspec/changes/catalogo/` structure.

## Phase 1 — SDD artifacts
- [x] T-1.1 Write `proposal.md`.
- [x] T-1.2 Write `design.md`.
- [x] T-1.3 Update `openspec/project.yaml` active_changes.
- [x] T-1.4 Write `tasks.md`.

## Phase 2 — Shared UI components (TDD)
- [ ] T-2.1 `StockBadge` atom + tests.
- [ ] T-2.2 `Stepper` molecule + tests.
- [ ] T-2.3 `SearchInput` molecule + tests.
- [ ] T-2.4 `ProductCard` molecule + tests.
- [ ] T-2.5 `BottomNav` organism + tests.
- [ ] T-2.6 `ScreenHeader` organism + tests.

## Phase 3 — Catalog API and utilities (TDD)
- [ ] T-3.1 Define `catalogoTypes.ts`.
- [ ] T-3.2 Write `catalogoApi.test.ts` with mocked Supabase.
- [ ] T-3.3 Implement `catalogoApi.ts` to pass tests.
- [ ] T-3.4 Write utility tests (price formatting, stock status).
- [ ] T-3.5 Implement utilities.
- [ ] T-3.6 Extend `saleDraft` store if needed + tests.

## Phase 4 — Catalog screen
- [ ] T-4.1 Implement `CatalogScreen.tsx`.
- [ ] T-4.2 Add integration tests for list/search/filter/role visibility.
- [ ] T-4.3 Wire navigation to product detail.

## Phase 5 — Product detail screen
- [ ] T-5.1 Implement `ProductDetailScreen.tsx`.
- [ ] T-5.2 Add tests for admin/employee views and "add to sale".

## Phase 6 — Product form screen
- [ ] T-6.1 Write form validation tests.
- [ ] T-6.2 Implement `ProductFormScreen.tsx`.
- [ ] T-6.3 Add integration tests for create/edit flows.

## Phase 7 — Scanner screen
- [ ] T-7.1 Write `barcodeDetection.test.ts`.
- [ ] T-7.2 Implement `barcodeDetection.ts`.
- [ ] T-7.3 Implement `ScannerScreen.tsx`.
- [ ] T-7.4 Add integration tests with mocked detector.

## Phase 8 — Integration
- [ ] T-8.1 Update `src/lib/router.tsx` with new routes.
- [ ] T-8.2 Add `BottomNav` to Dashboard/Sale/Catalog skeletons.
- [ ] T-8.3 Run full CI pipeline and fix issues.

## Phase 9 — Verify
- [ ] T-9.1 Manual dev verification: create, list, search, detail, edit, scan.
- [ ] T-9.2 Security verification: employee cannot write/read admin data.
- [ ] T-9.3 Write `verify-report.md`.
- [ ] T-9.4 Update `state.yaml`.

## Phase 10 — Archive
- [ ] T-10.1 Update `openspec/specs/catalogo/spec.md` with UI/API contracts.
- [ ] T-10.2 Move change to `openspec/changes/archive/`.
- [ ] T-10.3 Update `openspec/project.yaml`.
