# Tasks: Asistente de Combinación de Colores (color-palette-assistant)

## Phase 1: Foundation — schema, types, catalog wiring

- [x] 1.1 Create migration `supabase/migrations/20260908000000_color_palette_hsl.sql` (**deviation**: design named it `20260813000000_...`; renamed to `20260908000000_...` because production's latest applied migration is `20260818000000_resumen_dashboard_rpc.sql` — `supabase db push` skips any migration older than the latest applied one, so the 0813 timestamp would silently never deploy): add `color_h/s/l` to `productos`, backfill from `color_hex`, update `crear_producto`/`actualizar_producto`, create `pedidos_pendientes` with RLS.
- [x] 1.2 Regenerate `src/lib/database.types.ts` with `supabase gen types` (against the local stack — `--local --schema public`, matching the previous `--schema public` convention; local generation has no project-id so the `__InternalSupabase.PostgrestVersion` block is absent, which no code in this repo reads).
- [x] 1.3 Add `color_h/s/l` to `Product` in `src/features/catalogo/catalogoTypes.ts` (**deviation**: NOT added to `ProductInput` — HSL is server-computed per design D1 and the RPC contract from 1.1 only accepts `p_producto.color_hex`, never client-supplied HSL; adding write fields the API silently drops would be misleading).
- [x] 1.4 Forward `color_hex` to catalog RPCs in `src/features/catalogo/catalogoApi.ts` — already implemented by the `catalogo` change; verified `toRpcProduct`/`toRpcProductPatch` include `color_hex` for both `crear_producto` and `actualizar_producto`, no code change needed.
- [x] 1.5 Add optional color picker to `src/features/catalogo/ProductFormScreen.tsx` and set `color_hex` — the native `<input type="color">` field already existed from the `catalogo` change; added screen tests confirming it sets `color_hex` on submit and that leaving it untouched submits `null` (not a forced default).

## Phase 2: Core palette logic — utils, store, API

- [x] 2.1 Write failing tests for `src/features/paleta/paletaUtils.ts` (hex↔hsl, Euclidean distance, target generation for analogous/complementary/triadic, WhatsApp formatter).
- [x] 2.2 Implement `src/features/paleta/paletaUtils.ts` to make tests pass (**deviation**: added `hslToHex` and `rotateHue` as exported helpers not named in design's interface list — needed for round-trip testing and to keep target generation readable; also added `stockStatus` to `SuggestedProduct`, reusing `resolveStockStatus` from `catalogoUtils`, to satisfy REQ-CPA-5 and the open-question resolution that out-of-stock suggestions are returned flagged, not hidden).
- [x] 2.3 Create `src/features/paleta/paletaStore.ts` with `$colorPalette` nanostore (seed, rule, selected, note, add/remove/reorder/clear actions) and write store tests.
- [x] 2.4 Create `src/features/paleta/paletaApi.ts`: fetch colored products, save `pedidos_pendientes`; mock `@/lib/supabase` in tests.

## Phase 3: UI components and screen

- [x] 3.1 Create `src/features/paleta/SeedPicker.tsx`: list products with `color_hex`, allow selection. Presentational only — the caller (`PaletaScreen`) is responsible for passing already-colored products (from `fetchColoredProducts`); adds a local text-search filter over the given list.
- [x] 3.2 Create `src/features/paleta/HarmonySelector.tsx`: chips for analogous/complementary/triadic. Mirrors `FilterChips`' visual pattern exactly.
- [x] 3.3 Create `src/features/paleta/SuggestionGrid.tsx`: show closest products per target with stock badges. Groups `SuggestedProduct[]` by `targetIndex`, caps each group at 5 suggestions (`maxPerTarget`, **deviation**: not spec-mandated, a UX bound to keep the screen scrollable on a phone), and renders out-of-stock suggestions disabled per the open-question resolution.
- [x] 3.4 Create `src/features/paleta/PaletteBuilder.tsx`: selected products with remove and reorder. Reorder is up/down buttons per D6 (no drag-and-drop), disabled at the list boundaries.
- [x] 3.5 Create `src/features/paleta/PaletaScreen.tsx` orchestrating the three steps with share and encargo note actions. Share uses `window.open(url, '_blank', 'noopener')`; the encargo note + button section is gated to `auth.rol === 'admin'` only (UX concealment — `pedidos_pendientes` RLS is the real admin-only boundary, matching the `RequireAdmin`/route-guard convention documented in `routeGuards.ts`).
- [x] 3.6 Add `/paleta` lazy route wrapped in `<RequireSession>` in `src/lib/router.tsx`.
- [x] 3.7 Add paleta tab to `src/components/organisms/BottomNav.tsx` (**deviation**: the design_handoff hi-fi prototype fixes exactly 4 tabs — Inicio/Venta/Catálogo/Más — and "Más" has no built destination yet (`path: '#'`), so a genuine 5th tab is the faithful choice for this task rather than inventing an out-of-scope "Más" menu screen; bar height and therefore tap-target height are unchanged, only per-tab width shrinks, which stays well above 44px on any phone-sized viewport). Updated `BottomNav.test.tsx` from "should_render_four_tabs" to five, plus a new navigation assertion for `/paleta`.

## Phase 4: Testing and verification

- [x] 4.1 Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; fix failures. All green — see slice-3 apply-progress entry for exact counts.
- [x] 4.2 Apply migration to local Supabase and verify `crear_producto` computes HSL for `#FF0000` — already executed and verified in slice 1 (pulled forward as a slice-1 gate; see apply-progress.md "Local-stack SQL verification" section, item 2: `crear_producto` with `color_hex='#FF0000'` → row has `color_h=0, color_s=100, color_l=50`). Not re-run in slice 3 — no schema changes since slice 1.
- [ ] 4.3 Manually verify palette flow end-to-end: seed → rule → suggestions → build palette → share WhatsApp → save encargo. **Not performed by this agent** — requires a real device/browser session, out of scope for an apply-phase agent; the orchestrator/user does this during `sdd-verify` or before merge.

## Phase 5: Cleanup and documentation

- [x] 5.1 Update `docs/product-definition.md` with color assistant (v1) and future portal/community (v2+). Section 8 and the v2+ portal/community bullets already existed from an earlier phase; this task refined section 8's wording for accuracy against the actual implementation (tap-to-move, not drag-and-drop; out-of-stock suggestions shown disabled, not filtered to "in stock" only; added the admin-only encargo note and the WhatsApp share bullet).
- [x] 5.2 Resolve design open questions: out-of-stock display and WhatsApp message format. Both marked resolved in `design.md`'s Open Questions section, referencing the exact slice-2 code and slice-3 UI that encode each decision.
- [x] 5.3 Update `openspec/changes/color-palette-assistant/state.yaml` to mark `tasks` completed. Already `completed` (set during the `sdd-tasks` phase); confirmed unchanged, `apply_progress` updated for slice 3.
