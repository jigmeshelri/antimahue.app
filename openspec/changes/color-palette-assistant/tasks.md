# Tasks: Asistente de Combinación de Colores (color-palette-assistant)

## Phase 1: Foundation — schema, types, catalog wiring

- [x] 1.1 Create migration `supabase/migrations/20260908000000_color_palette_hsl.sql` (**deviation**: design named it `20260813000000_...`; renamed to `20260908000000_...` because production's latest applied migration is `20260818000000_resumen_dashboard_rpc.sql` — `supabase db push` skips any migration older than the latest applied one, so the 0813 timestamp would silently never deploy): add `color_h/s/l` to `productos`, backfill from `color_hex`, update `crear_producto`/`actualizar_producto`, create `pedidos_pendientes` with RLS.
- [x] 1.2 Regenerate `src/lib/database.types.ts` with `supabase gen types` (against the local stack — `--local --schema public`, matching the previous `--schema public` convention; local generation has no project-id so the `__InternalSupabase.PostgrestVersion` block is absent, which no code in this repo reads).
- [x] 1.3 Add `color_h/s/l` to `Product` in `src/features/catalogo/catalogoTypes.ts` (**deviation**: NOT added to `ProductInput` — HSL is server-computed per design D1 and the RPC contract from 1.1 only accepts `p_producto.color_hex`, never client-supplied HSL; adding write fields the API silently drops would be misleading).
- [x] 1.4 Forward `color_hex` to catalog RPCs in `src/features/catalogo/catalogoApi.ts` — already implemented by the `catalogo` change; verified `toRpcProduct`/`toRpcProductPatch` include `color_hex` for both `crear_producto` and `actualizar_producto`, no code change needed.
- [x] 1.5 Add optional color picker to `src/features/catalogo/ProductFormScreen.tsx` and set `color_hex` — the native `<input type="color">` field already existed from the `catalogo` change; added screen tests confirming it sets `color_hex` on submit and that leaving it untouched submits `null` (not a forced default).

## Phase 2: Core palette logic — utils, store, API

- [ ] 2.1 Write failing tests for `src/features/paleta/paletaUtils.ts` (hex↔hsl, Euclidean distance, target generation for analogous/complementary/triadic, WhatsApp formatter).
- [ ] 2.2 Implement `src/features/paleta/paletaUtils.ts` to make tests pass.
- [ ] 2.3 Create `src/features/paleta/paletaStore.ts` with `$colorPalette` nanostore (seed, rule, selected, note, add/remove/reorder/clear actions) and write store tests.
- [ ] 2.4 Create `src/features/paleta/paletaApi.ts`: fetch colored products, save `pedidos_pendientes`; mock `@/lib/supabase` in tests.

## Phase 3: UI components and screen

- [ ] 3.1 Create `src/features/paleta/SeedPicker.tsx`: list products with `color_hex`, allow selection.
- [ ] 3.2 Create `src/features/paleta/HarmonySelector.tsx`: chips for analogous/complementary/triadic.
- [ ] 3.3 Create `src/features/paleta/SuggestionGrid.tsx`: show closest products per target with stock badges.
- [ ] 3.4 Create `src/features/paleta/PaletteBuilder.tsx`: selected products with remove and reorder.
- [ ] 3.5 Create `src/features/paleta/PaletaScreen.tsx` orchestrating the three steps with share and encargo note actions.
- [ ] 3.6 Add `/paleta` lazy route wrapped in `<RequireSession>` in `src/lib/router.tsx`.
- [ ] 3.7 Add paleta tab to `src/components/organisms/BottomNav.tsx`.

## Phase 4: Testing and verification

- [ ] 4.1 Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; fix failures.
- [ ] 4.2 Apply migration to local Supabase and verify `crear_producto` computes HSL for `#FF0000`.
- [ ] 4.3 Manually verify palette flow end-to-end: seed → rule → suggestions → build palette → share WhatsApp → save encargo.

## Phase 5: Cleanup and documentation

- [ ] 5.1 Update `docs/product-definition.md` with color assistant (v1) and future portal/community (v2+).
- [ ] 5.2 Resolve design open questions: out-of-stock display and WhatsApp message format.
- [ ] 5.3 Update `openspec/changes/color-palette-assistant/state.yaml` to mark `tasks` completed.
