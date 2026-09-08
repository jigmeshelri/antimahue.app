# Apply progress: color-palette-assistant

## Slice 1 of 3 — `slice-1-foundation` (Phase 1: Foundation)

- **Branch**: `feat/paleta-1-foundation` (from `main` @ `2c2745a`)
- **Status**: complete. Tasks 1.1–1.5 done. All gates green.
- **Changed lines**: 333 insertions + 24 deletions = 357 (budget: 800).

### Tasks completed

- [x] **1.1** Migration `supabase/migrations/20260908000000_color_palette_hsl.sql`.
  - Adds `productos.color_h/color_s/color_l` (nullable, range-checked).
  - Adds internal-only `public.hex_to_hsl(text)` helper (REVOKE FROM PUBLIC,
    anon, authenticated — trigger/internal-only posture, same as
    `touch_updated_at()`).
  - Backfills existing rows via a non-lateral subquery join (an `UPDATE ...
    FROM function(target_alias.col)` pattern does NOT work in Postgres —
    the FROM item can't reference the UPDATE target; fixed with `FROM
    (SELECT id, (hex_to_hsl(color_hex)).* FROM productos WHERE color_hex IS
    NOT NULL) hsl WHERE p.id = hsl.id`).
  - `CREATE OR REPLACE` on `crear_producto` / `actualizar_producto` (same
    signatures) to compute/patch HSL alongside `color_hex`.
  - New `pedidos_pendientes` table, RLS admin-only (D4).
  - **Deviation from design.md (orchestrator-directed)**: filename is
    `20260908000000_...` not `20260813000000_...` — production's latest
    applied migration is `20260818000000_resumen_dashboard_rpc.sql`, and
    `supabase db push` silently skips any migration older than the latest
    applied one. Same content/intent as design.md described.

- [x] **1.2** Regenerated `src/lib/database.types.ts` from the local stack
  (`supabase gen types typescript --local --schema public`, matching the
  previous `--schema public` convention checked via `git log -p --follow`).
  Local generation omits `__InternalSupabase.PostgrestVersion` (project-linked
  metadata only available via `--project-id`); nothing in the repo reads
  that field. Diff is a clean superset: `pedidos_pendientes`, `color_h/s/l`
  on `productos`, `hex_to_hsl` RPC entry.

- [x] **1.3** Added `color_h/color_s/color_l: number | null` to `Product` in
  `catalogoTypes.ts`.
  - **Deviation**: NOT added to `ProductInput`. HSL is server-computed
    (design D1) and the RPC contract from 1.1 accepts only `p_producto.color_hex`,
    never client-supplied HSL — adding write fields the API layer silently
    drops would misrepresent the contract.
  - Updated all 7 `makeProduct()` test factories (`ProductCard.test.tsx`,
    `SaleScreen.test.tsx`, `catalogoUtils.test.ts`, `catalogoApi.test.ts`,
    `ProductFormScreen.test.tsx`, `CatalogScreen.test.tsx`,
    `ProductDetailScreen.test.tsx`) to satisfy the now-required fields.

- [x] **1.4** `color_hex` forwarding in `catalogoApi.ts` — already implemented
  by the prior `catalogo` change (`toRpcProduct`/`toRpcProductPatch` both
  include `color_hex`). No code change needed; verified by reading the file
  and by the existing `catalogoApi.test.ts` coverage.

- [x] **1.5** Optional color picker in `ProductFormScreen.tsx` — the native
  `<input type="color">` field already existed from the `catalogo` change.
  Added two screen tests:
  - `should_include_color_hex_when_the_optional_color_picker_is_set`
  - `should_submit_without_a_color_when_the_optional_picker_is_left_untouched`
    (confirms the visual `#C84A3A` swatch default is a *display* fallback
    only — untouched state submits `color_hex: null`, not a forced value).

### Local-stack SQL verification (task 4.2, pulled forward as a slice-1 gate)

Docker + `supabase start` + `supabase db reset` applied all 10 migrations in
order cleanly. Verified via `docker exec supabase_db_antimahue psql`, using a
synthetic `auth.users`/`profiles` admin and empleado row plus
`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...` to
simulate PostgREST sessions (rolled back, no state left):

1. `hex_to_hsl('#FF0000')` → `(0, 100, 50)`; `'#00FF00'` → `(120,100,50)`;
   `'#0000FF'` → `(240,100,50)`; `NULL` → `(NULL,NULL,NULL)`.
2. `crear_producto` with `color_hex='#FF0000'` → row has
   `color_h=0, color_s=100, color_l=50`. Matches spec scenario exactly.
3. `crear_producto` without color fields → `color_h/s/l` all NULL.
4. `actualizar_producto` setting `color_hex='#0000FF'` → recomputes to
   `(240,100,50)`.
5. `actualizar_producto` patching an unrelated field (`marca`) → HSL columns
   stay untouched at their prior values (PATCH semantics preserved).
6. Direct `INSERT`/`UPDATE` with `color_h=400` → `CHECK` violation
   (`productos_color_h_check`). `color_s=150` → violation
   (`productos_color_s_check`). `color_l=-5` → violation
   (`productos_color_l_check`).
7. Admin `INSERT` into `pedidos_pendientes` → succeeds.
8. Empleado `SELECT` on `pedidos_pendientes` → 0 rows (RLS filters).
9. Empleado `INSERT` on `pedidos_pendientes` → denied
   (`new row violates row-level security policy`).
10. `anon` `SELECT` on `pedidos_pendientes` → denied at the GRANT layer
    (`permission denied for table pedidos_pendientes`) — matches the
    zero-grants-for-anon posture of every other domain table.

A bug was caught and fixed during this verification: the first
`actualizar_producto` draft referenced `v_hsl.h/.s/.l` unconditionally in the
`UPDATE ... SET` CASE expressions, but PL/pgSQL resolves record field access
before evaluating which CASE branch wins — an unassigned `record` variable
(when the `color_hex` key was absent from the JSON patch) raised
`record "v_hsl" is not assigned yet` at runtime regardless of branching.
Fixed by always assigning `v_hsl := hex_to_hsl(p_producto->>'color_hex')`
unconditionally (`->>` on a missing key returns SQL `NULL`, and
`hex_to_hsl(NULL)` returns an assigned NULL-valued row, so the CASE logic
stays correct either way).

Production was never touched — no MCP `apply_migration`, no writes to
`aruteznqhdaaxxvllvzm`. **Local Supabase stack was stopped** (`supabase stop`)
after verification; data is backed up to the Docker volume for slice 2/3
if needed again.

### Gates (all green)

- `pnpm lint` — clean (no output beyond the command line).
- `pnpm format:check` — "All matched files use Prettier code style!"
- `pnpm typecheck` — clean.
- `pnpm test` — 273 passed | 7 skipped (baseline was 271 passed | 7 skipped;
  +2 new color-picker tests). The 7 skips are the local-only RLS battery,
  untouched.
- `pnpm build` — succeeds, PWA precache generated (36 entries).

### Bookkeeping

- `tasks.md`: 1.1–1.5 marked `[x]` with deviation notes inline.
- `state.yaml`: `status: apply`, `phase_states.apply: in_progress`,
  `apply_progress` block added recording this slice and the next one.
- Engram `mem_save` was NOT available as a callable tool in this execution
  context (only Read/Edit/Write/Bash were exposed) — this file is the
  persisted record instead, consistent with the declared `openspec`
  artifact store for this change.

## Slice 2 of 3 — `slice-2-core` (Phase 2: Core palette logic)

- **Branch**: `feat/paleta-2-core` (stacked on `feat/paleta-1-foundation`).
- **Status**: complete. Tasks 2.1–2.4 done, strict TDD (RED confirmed before
  each implementation). All gates green.
- **Changed lines**: 930 insertions + 4 deletions = 934 (tasks.md deltas +
  6 new files under `src/features/paleta/`). **Exceeds the 800-line attempt
  budget** — flagged as a risk below; not resolved by this agent since git/PR
  strategy is orchestrator-owned.

### Tasks completed

- [x] **2.1 / 2.2** `src/features/paleta/paletaUtils.ts` +
  `paletaUtils.test.ts` (202 + 298 lines). TDD: wrote 33 failing tests first
  (confirmed RED — `Failed to resolve import "./paletaUtils"` — before
  writing any implementation), then implemented to GREEN.
  - `hexToHsl` ported line-for-line from the SQL `hex_to_hsl()` algorithm in
    `20260908000000_color_palette_hsl.sql` (same branch order for
    max===r/g/b, same `Math.round` integer rounding). Verified against
    `#FF0000→(0,100,50)`, `#00FF00→(120,100,50)`, `#0000FF→(240,100,50)`,
    plus white/black/gray edge cases (delta=0 branch).
  - `hslToHex` added as the inverse conversion (**deviation**: not named in
    design.md's Interfaces block, but the task brief explicitly asked for
    "hex↔HSL both directions" and it's needed for the round-trip test).
  - `rotateHue` added as a small shared helper (**deviation**, same
    rationale) used by `generateTargets` for all three rules and directly
    unit-tested for wrap-around at both ends of the 0-360 circle.
  - `colorDistance`: Euclidean over `(hueDistance, Δs, Δl)` where
    `hueDistance = min(|h1-h2|, 360-|h1-h2|)` — design.md was silent on the
    exact wrap-around formula (proposal.md only said "ajustando la
    componente de tono para que sea circular"), so this agent chose the
    standard circular-distance formula and encoded it in tests (350 vs 10 →
    20, not 340; 0 vs 200 → 160, the short way, not 200).
  - `generateTargets(seed, rule)`: analogous → seed ±30° (two targets);
    complementary → seed +180° (one target, matches REQ-CPA-3 scenario
    "one target color has hue 180"); triadic → seed +120°/+240° (two
    targets 120° apart from each other, matching REQ-CPA-3's "target hues
    spaced approximately 120° apart" scenario — the seed itself is the
    third triad vertex and is not duplicated in the returned array).
  - `rankProductsForTarget` / `findClosestYarns`: closest-first ranking,
    products without stored HSL excluded, **out-of-stock suggestions are
    NOT filtered — they are returned with `stockStatus` computed via the
    reused `resolveStockStatus` from `catalogoUtils`** (open-question
    resolution, orchestrator-directed: flag, don't hide). `SuggestedProduct`
    extends design.md's `{product, distance, targetIndex}` with this
    `stockStatus` field (**deviation**, necessary to satisfy REQ-CPA-5 and
    the stock-awareness requirement from the task brief).
  - `buildPaletteShareText` / `buildWhatsappShareUrl`: plain-text formatter
    listing product name + `color_nombre` only, explicitly asserted to
    contain no `$` and no price string (open-question resolution,
    orchestrator-directed: names/colors only, no prices). `wa.me` URL
    wraps the text with `encodeURIComponent`.

- [x] **2.3** `src/features/paleta/paletaStore.ts` + `paletaStore.test.ts`
  (79 + 161 lines, 16 tests). Mirrors `saleDraft.ts`'s plain-atom +
  function-actions pattern exactly (`atom<PaletteState>`, no class, no
  React). `$colorPalette: {seedId, rule, selected, note}`. Actions:
  `setSeed`, `setRule`, `addToPalette` (dedupes by id), `removeFromPalette`,
  `moveSelected(id, 'up'|'down')` implementing D6's "tap-to-move" reorder
  (no-op at both list boundaries and for unknown ids — covered by 4
  dedicated tests), `setNote`, `clearPalette`.

- [x] **2.4** `src/features/paleta/paletaApi.ts` + `paletaApi.test.ts`
  (48 + 138 lines, 5 tests). `fetchColoredProducts()`: same
  `'*, producto_costos(costo, proveedor_id)'` select as `catalogoApi`,
  filtered with `.not('color_hex', 'is', null)`, ordered by `nombre`, same
  error-message-on-`error` convention as `catalogoApi`/`dashboardApi`.
  `savePedidoPendiente({nota, colores})`: inserts into
  `pedidos_pendientes` (`colores` cast through the generated `Json` type,
  same pattern as `dashboardApi`'s `Json` usage). Mocked `@/lib/supabase`
  with the same `from().select().not().order()` / `then()`-resolving
  builder stub used by `catalogoApi.test.ts`.

### Gates (all green)

- `pnpm lint` — clean.
- `pnpm format:check` — 2 files needed `pnpm format` (whitespace/line-wrap
  only, no logic change); re-ran clean after.
- `pnpm typecheck` — clean.
- `pnpm test` — 327 passed | 7 skipped (baseline 273 passed | 7 skipped;
  +54 new tests: 33 paletaUtils + 16 paletaStore + 5 paletaApi). The 7
  skips remain the local-only RLS battery, untouched.
- `pnpm build` — succeeds, PWA precache generated (36 entries, 649.85 KiB).

### Risk: changed-lines budget exceeded

The attempt was acquired with `--max-changed-lines 800`. Actual diff is
**930 insertions + 4 deletions = 934** (`git diff --stat`, tracked +
untracked via `git add -N` then reverted). All 6 new files under
`src/features/paleta/` are additions (no existing code to shrink against);
roughly 60% of the total is test code (298+161+138 = 597 test lines vs
202+79+48 = 329 implementation lines), which is expected for strict-TDD
pure-logic + store + API-layer work but pushed the slice over budget. This
agent did not split the slice further or cut test coverage to fit the
number — that tradeoff (accept as `size:exception`, or split into
`slice-2a-utils` / `slice-2b-store-api`) is the orchestrator's/delivery
strategy's call, not something to resolve unilaterally mid-slice. No git
add/commit/push/PR was performed — only `git add -N` + `git reset` to
compute the untracked-file diff stat, leaving the working tree exactly as
it was.

### Bookkeeping

- `tasks.md`: 2.1–2.4 marked `[x]` with deviation notes inline.
- `state.yaml`: `apply_progress.slices_done` now
  `[slice-1-foundation, slice-2-core]`, `tasks_done` includes 2.1–2.4,
  `next_slice: slice-3-ui`, `next_branch: feat/paleta-3-ui`.
- Engram `mem_save` was again NOT available as a callable tool in this
  execution context — this file remains the persisted record, consistent
  with the declared `openspec` artifact store.

### Next batch: slice-3-ui (tasks 3.1–3.7, 4.x, 5.x)

Branch `feat/paleta-3-ui`, stacked on `feat/paleta-2-core`. Scope: the 5
UI components + screen (`SeedPicker`, `HarmonySelector`, `SuggestionGrid`,
`PaletteBuilder`, `PaletaScreen`), the `/paleta` route in `router.tsx`, the
`BottomNav` tab, then Phase 4 verification (gates + local-Supabase manual
verification of the migration's `crear_producto` HSL computation + full
seed→rule→suggestions→palette→share→encargo flow) and Phase 5 cleanup
(`product-definition.md` update, formal open-question closure note in
design.md, `state.yaml` tasks-phase already completed so just confirm).
The orchestrator should decide up front whether slice 3 stays under 800
lines on its own or whether the slice-2 overage plus 7 new UI files
warrants an explicit size exception or a further split — recommend
flagging this to the user before slice 3 starts.
