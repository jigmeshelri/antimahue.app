---
change: color-palette-assistant
phase: verify
status: completed
depends_on: [catalogo]
supersedes: ~
persistence: openspec
updated_at: 2026-09-09
---

# Verification Report — color-palette-assistant

## Change

**color-palette-assistant** — in-store color-harmony assistant for Antimahue: pick a seed yarn, choose an analogous/complementary/triadic rule, get catalog suggestions ranked by HSL distance, build a palette, share it by WhatsApp, and (admin-only) log an out-of-stock customer note (`pedidos_pendientes`).

Delivered as 3 stacked PRs merged to `main`: #50 (foundation — migration, LIVE in prod), #51 (core logic, `size:exception` on changed-lines), #52 (UI). Post-apply corrections in PR #54 (seed search now matches `color_nombre`, accent-insensitive; distinct no-results copy; voseo → tuteo across paleta/venta copy). Unrelated same-day fixes (#55 catalogo stock delta, #56 scanner camera policy, #57 dashboard RPC) touch other domains and are out of scope for this report.

## Task Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

All tasks in `tasks.md` (phases 1–5) are marked `[x]`. Task 4.3 (manual end-to-end device verification) was performed by the maintainer on Android against production on 2026-09-09, after PR #54 shipped the seed-search-by-color fix — confirmed via the change's final-state facts and `tasks.md`'s own note. Task 4.2 (local-stack SQL verification of `crear_producto`'s HSL computation) was pulled forward and executed in slice 1 against a local Supabase stack; not re-executed in this verify pass (see Security/Lessons below).

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

**Tests**: ✅ 385 passed / ❌ 0 failed / ⚠️ 7 skipped
```
$ vitest run
Test Files  47 passed | 1 skipped (48)
     Tests  385 passed | 7 skipped (392)
```
The 7 skipped tests are the local-only RLS multi-role battery (`RUN_LOCAL_RLS_BATTERY=1` gate), unrelated to this change and untouched by it.

**Build**: ✅ Passed
```
$ tsc -p tsconfig.app.json && vite build
✓ built in 12.54s
PWA v0.21.2 — precache 37 entries (673.22 KiB)
```
Build emits one non-blocking warning: `dist/assets/index-*.js` is ~509 kB after minification, above Vite's default 500 kB chunk-size warning. This is pre-existing application-level bundling behavior (present before this change, confirmed against the `dashboard` verify-report baseline) and does not affect functionality.

**Coverage**: ➖ Not configured (no `coverage_threshold` in `openspec/config.yaml`).

## Spec Compliance Matrix — domain `color-palette`

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-CPA-1 — Seed color selection | eligible seed appears in selector | `paletaApi.test.ts > should_return_products_with_a_color_ordered_by_name`; `SeedPicker.test.tsx > should_list_every_product_it_receives` | ✅ COMPLIANT |
| REQ-CPA-1 | product without color is excluded | `paletaApi.test.ts > should_return_products_with_a_color_ordered_by_name` (asserts `.not('color_hex','is',null)` filter — enforcement is server-side in Postgres, not client-side re-filtering) | ✅ COMPLIANT |
| REQ-CPA-2 — Harmony rule selection | user picks a rule | `HarmonySelector.test.tsx > should_call_onChange_when_a_different_rule_is_tapped`; `paletaStore.test.ts > should_set_the_harmony_rule` | ✅ COMPLIANT |
| REQ-CPA-3 — Theoretical palette generation | complementary rule yields hue 180 | `paletaUtils.test.ts > should_generate_one_opposite_hue_for_complementary` | ✅ COMPLIANT |
| REQ-CPA-3 | triadic rule yields hues ~120° apart | `paletaUtils.test.ts > should_generate_two_hues_spaced_120_degrees_apart_for_triadic` | ✅ COMPLIANT |
| REQ-CPA-4 — Inventory mapping | closest color ranked first | `paletaUtils.test.ts > should_rank_the_closest_product_first` | ✅ COMPLIANT |
| REQ-CPA-4 | exact match wins, distance zero | `paletaUtils.test.ts > should_return_distance_zero_for_an_exact_match` | ✅ COMPLIANT |
| REQ-CPA-5 — Stock awareness | out-of-stock suggestion is flagged | `paletaUtils.test.ts > should_include_out_of_stock_products_flagged_instead_of_hiding_them`; `SuggestionGrid.test.tsx > should_show_out_of_stock_suggestions_disabled_instead_of_hiding_them` | ✅ COMPLIANT |
| REQ-CPA-6 — Palette builder | add suggestion to palette | `paletaStore.test.ts > should_add_a_product_to_the_selected_palette`; `SuggestionGrid.test.tsx > should_call_onAdd_with_the_product_when_agregar_is_tapped` | ✅ COMPLIANT |
| REQ-CPA-6 | remove product from palette | `paletaStore.test.ts > should_remove_a_product_from_the_palette`; `PaletteBuilder.test.tsx > should_call_onRemove_when_quitar_is_tapped` | ✅ COMPLIANT |
| REQ-CPA-7 — Share palette | share plain text via `wa.me` | `paletaUtils.test.ts > should_list_product_names_and_colors_without_prices`, `should_build_a_wa_me_link_with_the_encoded_share_text`; `PaletaScreen.test.tsx > should_open_a_whatsapp_share_link_with_the_palette` | ✅ COMPLIANT |
| REQ-CPA-8 — Out-of-stock note | save note for missing color | `paletaApi.test.ts > should_insert_the_note_and_colors_into_pedidos_pendientes`; `PaletaScreen.test.tsx > should_save_an_encargo_note_and_show_a_success_toast` | ✅ COMPLIANT |

**Compliance summary**: 12/12 scenarios compliant (8/8 requirements).

## Spec Compliance Matrix — domain `catalogo` (delta: HSL columns)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| REQ-DM-CAT-6 — HSL color components | `crear_producto('#FF0000')` → `color_h=0, color_s=100, color_l=50` | Manual local-stack `psql` verification, slice-1 apply-progress (`apply-progress.md`, "Local-stack SQL verification" item 2); corroborated by `paletaUtils.test.ts > should_convert_pure_red` asserting the algorithmically-identical JS port produces the same values | ✅ COMPLIANT (see WARNING V-1) |
| REQ-DM-CAT-6 | no color fields → `color_h/s/l` all NULL | Same source, item 3 | ✅ COMPLIANT (see WARNING V-1) |
| REQ-DM-CAT-6 | `color_h = 400` rejected | Same source, item 6 | ✅ COMPLIANT (see WARNING V-1) |
| REQ-DM-CAT-6 | `color_s = 150` rejected | Same source, item 6 | ✅ COMPLIANT (see WARNING V-1) |

**Compliance summary**: 4/4 scenarios compliant (1/1 requirement), evidence carried forward from the apply phase.

## Design Coherence — Architecture Decisions

| ID | Decision | Verified against | Status |
|---|---|---|---|
| D1 | Stored `color_h/s/l` computed by RPC, not client-only | `20260908000000_color_palette_hsl.sql` (`crear_producto`/`actualizar_producto` compute via `hex_to_hsl`); `catalogoTypes.ts` `ProductInput` deliberately omits HSL fields | ✅ No drift |
| D2 | Euclidean distance in HSL (not CIELAB) | `paletaUtils.colorDistance` — circular hue + `s`/`l` Euclidean | ✅ No drift |
| D3 | Dedicated nanostore `$colorPalette` | `paletaStore.ts`, mirrors `saleDraft.ts` pattern | ✅ No drift |
| D4 | `pedidos_pendientes` table, not LocalStorage | Migration creates the table, RLS admin-only | ✅ No drift |
| D5 | Route `/paleta` | `router.tsx` line 167, wrapped in `<RequireSession>` | ✅ No drift |
| D6 | Reorder via add/remove + tap-to-move (no drag-and-drop) | `paletaStore.moveSelected`; `PaletteBuilder.tsx` up/down buttons | ✅ No drift |

**Documented deviations** (all disclosed inline in `tasks.md`/`apply-progress.md`, none breaking a spec requirement):
- Migration filename `20260908000000_...` instead of design's `20260813000000_...` (production's latest applied migration was newer; `supabase db push` skips older timestamps).
- HSL fields added to `Product` but not to `ProductInput` (server-computed, matches D1 more strictly than the interface sketch in `design.md`).
- Tasks 1.4/1.5 pre-satisfied by the `catalogo` change; verified, not re-implemented.
- `SuggestedProduct` gained a `stockStatus` field beyond `design.md`'s `{product, distance, targetIndex}` sketch — necessary for REQ-CPA-5.
- `BottomNav` gained a genuine 5th tab (design_handoff hi-fi prototype fixes 4 tabs) — the "Más" tab has no built destination, so this was the more faithful choice than inventing an out-of-scope menu screen; tap-target height is unchanged.
- `SuggestionGrid` caps suggestions at 5 per target (`maxPerTarget`) — a UX bound, not spec-mandated, disclosed as a deviation.

None of these deviations contradict a `MUST`/`SHOULD` in either delta spec.

## Security Review — migration `20260908000000_color_palette_hsl.sql`

Static read of the SQL only; no connection to production or a local Supabase stack was made in this verify pass (per this session's explicit scope).

| Check | Status | Evidence |
|---|---|---|
| `crear_producto`/`actualizar_producto` are `SECURITY DEFINER SET search_path = ''` | ✅ | Both function headers (lines 110, 150) |
| `is_admin()` authorization gate | ✅ | Both functions `RAISE EXCEPTION 'solo admin'` when `NOT public.is_admin()` (lines 114, 154) |
| `hex_to_hsl` EXECUTE revoked from PUBLIC/anon/authenticated | ✅ | Line 85: `REVOKE EXECUTE ON FUNCTION public.hex_to_hsl(text) FROM PUBLIC, anon, authenticated;`. Not `SECURITY DEFINER` itself (plain `SET search_path=''`), correctly so — it runs as the calling context; when invoked from inside the two `SECURITY DEFINER` RPCs, that context is the function owner, who retains implicit EXECUTE regardless of the REVOKE. Direct PostgREST exposure to any API role is blocked. |
| `pedidos_pendientes` RLS admin-only | ✅ | `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated` (broad) is narrowed by `CREATE POLICY pedidos_pendientes_all_admin ... USING ((select is_admin())) WITH CHECK ((select is_admin()))` — an empleado authenticated role has the GRANT but RLS filters all rows and rejects all writes. |
| `pedidos_pendientes` zero anon grants | ✅ | Explicit `REVOKE ALL ON public.pedidos_pendientes FROM anon;`, matching the zero-anon-grant posture of every other domain table. |
| PATCH-semantics regression | ✅ | `actualizar_producto`'s `v_hsl` is unconditionally assigned before the `CASE` block (PL/pgSQL resolves record field access before branch selection) — a documented bug-then-fix from slice-1 local verification, now baked into the shipped SQL. |

**0 CRITICAL security findings.**

## Post-Apply Corrections (PR #54)

Two functional issues surfaced after the initial 3-slice apply and were fixed in a follow-up PR before task 4.3's device pass succeeded:
1. `SeedPicker`'s search only matched `product.nombre`, not `color_nombre` — Angélica searches by color name ("rojo fuego"), not SKU/product name. Fixed to search both fields, accent-insensitive (`normalizeForSearch`), with a distinct "no results" message. Confirmed in the current `SeedPicker.tsx` (lines 33-42) and covered by `SeedPicker.test.tsx > should_match_search_text_against_the_color_name`, `should_ignore_accents_when_searching`.
2. Voseo forms in `paleta`/`venta` UI copy replaced with neutral tuteo, per the project's documented Spanish-neutral convention. Confirmed absent by a targeted grep of both feature directories in this verify pass.

## Risks / Findings

**CRITICAL: 0**

**WARNING: 2**
- **V-1 — SQL correctness evidence for REQ-DM-CAT-6 is not independently re-verified this session.** This change has no automated pgTAP/SQL-level test suite; the only runtime evidence for `hex_to_hsl`/`crear_producto`/`actualizar_producto`'s HSL computation and the CHECK constraints is the slice-1 manual `psql` transcript recorded in `apply-progress.md` (2026-09-08), which this verify pass did not and could not re-execute (explicitly scoped to static review, no DB connection). The JS-port unit tests (`paletaUtils.test.ts`) corroborate the *algorithm* but never touch the actual SQL function. Recommendation: before archiving changes that ship SQL functions, run (or re-run) them against a locally seeded Supabase stack as part of `sdd-verify`, not only during `sdd-apply` — otherwise verify's "runtime evidence" claim for DB-level requirements rests on a stale, non-reproduced artifact.
- **V-2 — Production has minimal colored inventory (1 product) at verification time.** Per the final-state facts, only one product had `color_hex` set in production when task 4.3 was performed, and it was set by the maintainer specifically to enable the test. REQ-CPA-1/REQ-CPA-4's real behavior (seed selector with multiple choices, ranking across several real distances) has only ever been exercised against synthetic data (unit/component tests) and a single-product production state, not a realistic multi-color catalog. Not a code defect — a data-readiness gap. Recommend re-checking the ranking/suggestion UX once Angélica has colored a representative slice of the catalog.

**SUGGESTION: 3**
- **V-3** — `paletaApi.fetchColoredProducts` selects `producto_costos(costo, proveedor_id)` (mirroring `catalogoApi`'s select shape) but no component in `src/features/paleta/` ever reads cost data. Not a security issue (RLS/embed already governs cost visibility the same way `catalogo` does), just an unused field fetched on every load. Low priority; consistency with `catalogoApi`'s established select pattern is a reasonable reason to leave it as-is.
- **V-4** — `SuggestionGrid`'s `maxPerTarget = 5` cap is a UX choice with no covering spec scenario either way (not mandated, not forbidden). Already disclosed as a deviation in `tasks.md`; no action needed, noted here only for completeness.
- **V-5** — The pre-existing `>500 kB` main JS chunk warning (509.05 kB, same order of magnitude as the `dashboard` change's 509 kB baseline) persists; `PaletaScreen` is already lazy-loaded so this change did not worsen it, but the underlying `index` chunk has not been addressed by any change to date. Consider `manualChunks` splitting in a future infra-focused change.

## Rollback

All changes are client-side files (7 new files under `src/features/paleta/`, 3 modified catalog files, `router.tsx`, `BottomNav.tsx`) plus one additive migration. Reverting the 3 merged PRs restores the pre-change `BottomNav` (4 tabs), removes the `/paleta` route, and removes the palette feature directory. The migration is additive (new nullable columns + new table); it can stay in place harmlessly or be dropped in a follow-up migration if a full rollback is required. No data loss risk: no existing column was altered or dropped.

## Verdict

**PASS WITH WARNINGS** — 0 CRITICAL, 2 WARNING, 3 SUGGESTION. All 22 tasks complete, all automated gates green (lint/format/typecheck/385 tests passed/build), 12/12 `color-palette` scenarios compliant with passing tests, 4/4 `catalogo` delta scenarios compliant via prior-session manual SQL verification, 0 CRITICAL security findings on the migration. The two WARNINGs are process/data-readiness observations, not implementation defects, and do not block archiving this change.
