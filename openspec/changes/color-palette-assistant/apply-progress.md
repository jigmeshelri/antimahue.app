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

### Next batch: slice-2-core (tasks 2.1–2.4)

Branch `feat/paleta-2-core`, stacked on `feat/paleta-1-foundation`. Scope:
`paletaUtils.ts` (TDD: hex↔hsl, Euclidean distance, target generation for
analogous/complementary/triadic, WhatsApp formatter), `paletaStore.ts`
(`$colorPalette` nanostore), `paletaApi.ts` (fetch colored products, save
`pedidos_pendientes`, mocked `@/lib/supabase`). No DB access needed — pure
logic + mocked API layer, so the local Supabase stack does not need to be
started again unless slice 3 wants to exercise `pedidos_pendientes` writes
end-to-end.
