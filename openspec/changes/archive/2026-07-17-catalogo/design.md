---
change: catalogo
phase: design
status: in_progress
depends_on: [data-model, auth-pin]
supersedes: ~
persistence: openspec
updated_at: 2026-07-17
resolves_open_questions: [OQ-1, OQ-2, OQ-3, OQ-4]
carries_forward: [D1, D2, D3, D4, D5, D6, D7]
---

# Design: catálogo — CRUD, búsqueda, detalle y escáner

## 1. Technical approach

Build the catalog feature on top of the existing domain schema (`productos`, `producto_costos`, `proveedores`) and the existing auth layer (PIN, roles). The client is UNTRUSTED: all authorization remains in Postgres (RLS/RPC). UI role checks are for concealment only.

Three layers:
1. **API layer** — `src/features/catalogo/catalogoApi.ts` with typed functions mocking only Supabase.
2. **UI components** — atomic/molecular/organism components following the handoff's "Terraza" design system.
3. **Screens** — thin containers wiring API + stores + components.

Method: TDD. Tests for API, utilities, stores and atomic/molecular components are written first.

## 2. Design decisions

| ID | Resolves | Decision | Rejected |
|----|----------|----------|----------|
| DD-1 | OQ-1 | Search debounce = **300 ms** | No debounce (too many requests); 500 ms (feels sluggish) |
| DD-2 | OQ-2 | Product list = **client-side pagination** (load first 50, "Cargar más" button) | Infinite scroll (harder to test); server pagination with offsets |
| DD-3 | OQ-3 | Default sort = **nombre ASC** | created_at DESC; stock status first |
| DD-4 | OQ-4 | "+" create button **hidden for employees** | Disabled with tooltip (adds friction to a path they cannot use) |
| DD-5 | — | `catalogoApi.ts` uses **PostgREST queries for reads**, **RPC for writes** | RPC for everything (reads don't need DEFINER) |
| DD-6 | — | `producto_costos` embed read via `productos?select=*,producto_costos(costo,proveedor_id)` | Separate query for cost |
| DD-7 | — | Scanner returns normalized SKU string; all SKU matching is **exact** | Fuzzy SKU matching |

### DD-1 — Search debounce 300 ms
Balanced between responsiveness and request volume. Implemented in `CatalogScreen` via a debounced effect, not on every keystroke.

### DD-2 — Client-side pagination
For a small store the catalog likely fits comfortably in memory. Load the first 50 products ordered by name; show a "Cargar más" button to fetch the next 50. Simpler than infinite scroll and easier to test. If performance becomes an issue, switch to server-side limit/offset later.

### DD-3 — Sort by name ASC
The most predictable ordering for a human scanning a list. Stock alerts are shown separately on the dashboard, so they don't need to reorder the catalog.

### DD-4 — Hide create button for employees
Per `D4` in proposal: employees don't create products. A hidden button is cleaner than a disabled one with a tooltip on a daily screen.

### DD-5 — PostgREST for reads, RPC for writes
Reads (`productos`) are already `GRANT SELECT` to `authenticated` with a permissive policy. Writes must go through `crear_producto`/`actualizar_producto` because the client has no direct write grants on `productos`/`producto_costos`. This mirrors the existing security model.

### DD-6 — Embed cost via PostgREST
A single query `productos?select=*,producto_costos(costo,proveedor_id)` returns both tables. For employees, the embed degrades to `null` (verified in `auth-pin` RLS battery). For admins it returns the cost row. The UI must handle `producto_costos: null | { costo: number; proveedor_id: string | null }`.

### DD-7 — Exact SKU matching
SKUs are barcodes (EAN/UPC). Matching must be exact; partial matches would create false positives when scanning.

## 3. Data model and API contracts

### 3.1 Types

```ts
// src/features/catalogo/catalogoTypes.ts
export type ProductType = 'lana' | 'algodon' | 'hilo' | 'palillo' | 'crochet' | 'accesorio'

export interface Product {
  id: string
  sku: string | null
  nombre: string
  tipo: ProductType | null
  marca: string | null
  grosor: string | null
  peso_metraje: string | null
  color_nombre: string | null
  color_hex: string | null
  precio_venta: number
  stock: number
  stock_minimo: number | null
  imagen_url: string | null
  created_at: string
  updated_at: string
  producto_costos: {
    costo: number
    proveedor_id: string | null
  } | null
}

export interface ProductFilters {
  search?: string
  tipo?: ProductType | 'todos'
  limit?: number
  offset?: number
}

export interface ProductInput {
  sku?: string | null
  nombre: string
  tipo?: ProductType | null
  marca?: string | null
  grosor?: string | null
  peso_metraje?: string | null
  color_nombre?: string | null
  color_hex?: string | null
  precio_venta: number
  stock?: number
  stock_minimo?: number | null
  imagen_url?: string | null
  costo?: number | null
  proveedor_id?: string | null
}
```

### 3.2 API functions

```ts
// src/features/catalogo/catalogoApi.ts
export async function fetchProducts(filters: ProductFilters): Promise<Product[]>
export async function fetchProductById(id: string): Promise<Product | null>
export async function createProduct(input: ProductInput): Promise<string> // returns id
export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void>
export async function findProductBySku(sku: string): Promise<Product | null>
```

### 3.3 Search implementation

```ts
// PostgREST query for search + filter
let query = supabase
  .from('productos')
  .select('*, producto_costos(costo, proveedor_id)')
  .order('nombre', { ascending: true })
  .range(offset, offset + limit - 1)

if (filters.search) {
  query = query.or(`nombre.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
}

if (filters.tipo && filters.tipo !== 'todos') {
  query = query.eq('tipo', filters.tipo)
}
```

`pg_trgm` index on `nombre` supports fast `ilike` patterns with leading wildcard. SKU uses exact `ilike` (barcodes are numeric).

### 3.4 Write mapping

`crear_producto` accepts `(p_producto jsonb, p_costo integer DEFAULT NULL, p_proveedor_id uuid DEFAULT NULL)`. The client builds `p_producto` with all `productos` fields.

`actualizar_producto` accepts `(p_id uuid, p_producto jsonb, p_costo integer DEFAULT NULL, p_proveedor_id uuid DEFAULT NULL, p_stock_delta integer DEFAULT NULL)`. For edits the client sends the changed fields in `p_producto`; stock changes are NOT allowed inside `p_producto` (the RPC raises) — this change does NOT edit stock directly.

## 4. Component architecture

### 4.1 Atomic components

- `StockBadge` — shows "En stock" / "Bajo" / "Agotado" with colors from design system.

### 4.2 Molecular components

- `SearchInput` — input with magnifying glass icon, debounced onChange.
- `ProductCard` — thumbnail, name, subtitle, price, stock badge.
- `Stepper` — +/- quantity control.
- `FilterChips` — horizontal scrollable chips for product types.

### 4.3 Organism components

- `BottomNav` — 4 tabs, reused across Dashboard/Sale/Catalog.
- `ScreenHeader` — terracotta header with title, optional back, optional right action.

### 4.4 Screen components

- `CatalogScreen` — list, search, filters, empty/error states.
- `ProductDetailScreen` — detail view, admin card, CTA add-to-sale.
- `ProductFormScreen` — create/edit form.
- `ScannerScreen` — camera viewfinder, product found overlay, not-found ephemeral preview.

## 5. Stores

### 5.1 `saleDraft` extension

If needed, add a helper to push a product line:

```ts
// src/stores/saleDraft.ts
export function addLine(product: Product, quantity: number): void
```

### 5.2 `catalogoFilters` (optional)

If filter state needs to survive navigation, create a nanostore; otherwise keep it local to `CatalogScreen`.

## 6. Routes

Add to `src/lib/router.tsx`:

```ts
{ path: '/catalogo', element: <CatalogScreen /> }
{ path: '/catalogo/new', element: <ProductFormScreen mode="create" /> }
{ path: '/catalogo/:id', element: <ProductDetailScreen /> }
{ path: '/catalogo/:id/edit', element: <ProductFormScreen mode="edit" /> }
```

`ProductFormScreen` is wrapped in `<RequireAdmin>` at route level (UX guard). The real guard is the RPC's `is_admin()` check.

## 7. Scanner flow

1. `ScannerScreen` mounts, requests camera permission.
2. `BarcodeDetector` scans continuously.
3. On detection:
   - Normalize barcode string.
   - Call `findProductBySku(sku)`.
   - If found: show bottom-sheet overlay with product + stepper + "Agregar a la venta".
   - If not found: show ephemeral preview card with quick-create form (admin) or "Producto no registrado" (employee).
4. On closing scanner: stop camera stream and detector.

Fallback: if `BarcodeDetector` is unavailable, show a manual SKU input field.

## 8. Security and role handling

- Admin sees create/edit buttons, cost/margin card, supplier field.
- Employee sees only product info and "Agregar a venta".
- The RPCs `crear_producto` / `actualizar_producto` reject non-admin callers via `is_admin()`.
- `producto_costos` embed degrades to `null` for employees.

## 9. Migration / schema impact

No new database migrations. This change is purely client-side plus openspec artifacts. The existing schema from `data-model` already supports all operations.

## 10. Testing strategy

### 10.1 Unit tests (TDD)

- `catalogoApi.test.ts`: mock Supabase client, assert query shapes and RPC calls.
- `barcodeDetection.test.ts`: mock `BarcodeDetector`, assert normalization and fallback.
- Component tests for `StockBadge`, `Stepper`, `SearchInput`, `ProductCard`, `BottomNav`, `ScreenHeader`.

### 10.2 Integration tests

- `CatalogScreen`: render with mocked products, search, filter, admin vs employee visibility.
- `ProductDetailScreen`: admin sees cost card; employee does not.
- `ScannerScreen`: detection flow with mocked detector and API.

### 10.3 Manual verification

- Create/edit product as admin.
- List/search/filter products.
- View detail as admin and employee.
- Scan existing and unknown SKU.
- Verify employee cannot call write RPCs.

## 11. Open questions resolved

- OQ-1: Search debounce = 300 ms.
- OQ-2: Client-side pagination, first 50 products, "Cargar más".
- OQ-3: Default sort = nombre ASC.
- OQ-4: Create button hidden for employees.
