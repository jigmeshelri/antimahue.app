---
change: color-palette-assistant
phase: design
status: completed
depends_on: [catalogo]
supersedes: ~
persistence: openspec
updated_at: 2026-08-13
---

# Design: color-palette-assistant

## Technical Approach

Pure frontend assistant backed by stored HSL columns and a small
`pedidos_pendientes` table. The assistant computes theoretical colors in HSL,
ranks real catalog products by Euclidean distance in HSL space, and lets
Angélica build and share palettes at the counter.

## Architecture Decisions

| ID | Decision | Chosen | Rejected | Rationale |
|---|---|---|---|---|
| D1 | HSL storage | Stored `color_h/s/l` columns computed by RPC | Client-only computation | Enables future DB filtering and avoids recomputing on every load. |
| D2 | Color distance | Euclidean in HSL | CIELAB | Good enough for MVP; zero dependencies. |
| D3 | Assistant state | Dedicated nanostore `$colorPalette` | React local state | Mirrors `saleDraft` pattern; survives navigation. |
| D4 | Encargos | New `pedidos_pendientes` table | LocalStorage | Must persist across devices for the store. |
| D5 | Route | `/paleta` | `/asistente-color` | Short, consistent with `/venta` and `/catalogo`. |
| D6 | Reorder UX | Add/remove + tap-to-move | Drag-and-drop | Simpler, accessible, no extra library. |

## Data Flow

```
SeedPicker ──▶ $colorPalette.seedId
                    │
                    ▼
HarmonySelector ──▶ $colorPalette.rule
                    │
                    ▼
        generateTargets(seedHsl, rule)
                    │
                    ▼
        findClosestYarns(targets, catalog)
                    │
                    ▼
        SuggestionGrid (stock badge)
                    │
                    ▼
        PaletteBuilder (add/remove/reorder)
                    │
                    ▼
        WhatsApp text / pedido_pendiente
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/features/paleta/paletaStore.ts` | Create | Nanostore for seed, rule, palette, and encargo draft. |
| `src/features/paleta/paletaUtils.ts` | Create | Hex↔HSL, Euclidean distance, target generation, WhatsApp formatter. |
| `src/features/paleta/paletaApi.ts` | Create | Fetch colored products, save `pedidos_pendientes`. |
| `src/features/paleta/PaletaScreen.tsx` | Create | Main screen orchestrating the three steps. |
| `src/features/paleta/SeedPicker.tsx` | Create | Catalog list filtered to products with `color_hex`. |
| `src/features/paleta/HarmonySelector.tsx` | Create | Chips for análogos / complementarios / triádicos. |
| `src/features/paleta/SuggestionGrid.tsx` | Create | Closest-match products ordered by distance with stock badges. |
| `src/features/paleta/PaletteBuilder.tsx` | Create | Selected products with remove and reorder. |
| `src/lib/router.tsx` | Modify | Add `/paleta` lazy route wrapped in `<RequireSession>`. |
| `src/features/catalogo/catalogoTypes.ts` | Modify | Add `color_h/s/l` to `Product` and `ProductInput`. |
| `src/features/catalogo/catalogoApi.ts` | Modify | Forward `color_hex` to RPCs; HSL is computed server-side. |
| `src/features/catalogo/ProductFormScreen.tsx` | Modify | Optional color picker that sets `color_hex`. |
| `src/components/organisms/BottomNav.tsx` | Modify | Add paleta tab. |
| `supabase/migrations/20260813000000_color_palette_hsl.sql` | Create | Add HSL columns, update RPCs, create `pedidos_pendientes`. |

## Interfaces / Contracts

```ts
export type HarmonyRule = 'analogous' | 'complementary' | 'triadic'

export interface Hsl {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export interface SuggestedProduct {
  product: Product
  distance: number
  targetIndex: number
}

export interface PaletteState {
  seedId: string | null
  rule: HarmonyRule
  selected: Product[]
  note: string
}
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `paletaUtils` — hex→hsl, distance, generation, WhatsApp text | Pure vitest |
| Unit | `paletaStore` — seed/rule/selected/note actions | Extend store test pattern |
| Component | `SeedPicker`, `HarmonySelector`, `SuggestionGrid`, `PaletteBuilder` | Testing Library |
| Integration | Save encargo | Mock `@/lib/supabase` |

## Migration / Rollout

New migration `20260813000000_color_palette_hsl.sql`:

1. `ALTER TABLE productos ADD COLUMN color_h/s/l` with range CHECKs.
2. Backfill HSL from existing `color_hex` values.
3. Update `crear_producto` and `actualizar_producto` to compute and store HSL.
4. Create `pedidos_pendientes(id uuid PK, nota text, colores jsonb, created_at timestamptz)` with RLS admin-only.
5. Update `database.types.ts` via `supabase gen types`.

Rollback = revert the migration; no data loss because the change is additive.

## Open Questions

- [ ] Should out-of-stock suggestions be hidden entirely or shown disabled? (Proposal says flag; design leans to disabled so Angélica can note the missing color.)
- [ ] Should the palette WhatsApp message include product prices or only names/colors? (Design leans to names/colors to keep it advisory.)
