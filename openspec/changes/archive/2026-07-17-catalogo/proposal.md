---
change: catalogo
phase: proposal
status: in_progress
depends_on: [data-model, auth-pin]
supersedes: ~
persistence: openspec
updated_at: 2026-07-17
---

# Proposal: catálogo — CRUD de productos, búsqueda, detalle y escáner (Antimahue MVP)

## Intent

`data-model` entregó el schema de dominio (tablas `productos`, `producto_costos`, `proveedores`) y los RPCs `crear_producto` / `actualizar_producto`. `auth-pin` entregó el sistema de login PIN y roles `admin`/`empleado`. Este change construye la **primera feature de negocio usable**: el catálogo de productos con listado, búsqueda, detalle, creación/edición (admin-only) y escáner de códigos de barras.

Es la base de todo el MVP: sin catálogo no hay productos que vender, sin productos no hay dashboard ni asistente de color. Por eso es el siguiente change del roadmap SDD aprobado.

Governing principle heredado: **el cliente no es confiable — la autorización vive en Postgres (RLS/RPC)**. La UI solo oculta o muestra elementos por rol; el boundary real sigue siendo la base de datos.

## Scope

### In scope
- Listado de productos (`/catalogo`) con búsqueda por nombre/SKU y filtros por tipo.
- Detalle de producto (`/catalogo/:id`) con vista diferenciada admin/empleado.
- Creación y edición de productos (`/catalogo/new`, `/catalogo/:id/edit`) usando los RPCs `crear_producto` / `actualizar_producto` (admin-only).
- Escáner de códigos de barras (`/escaner`) con Barcode Detection API nativa + fallback manual.
- Vista previa efímera de producto no encontrado: ofrecer crearlo (admin) o mensaje informativo (empleado).
- Componentes de UI reutilizables: `BottomNav`, `ScreenHeader`, `SearchInput`, `ProductCard`, `StockBadge`, `Stepper`.
- API layer testeable (`src/features/catalogo/catalogoApi.ts`) y utilidades puras.
- Tests unitarios e integración ligera, siguiendo TDD.

### Out of scope
- Flujo completo de venta (change `venta`).
- Dashboard con KPIs (change `dashboard`).
- Gestión de proveedores e importación DTE (change `proveedores-dte`).
- Algoritmos de armonía cromática (change `color-palette-assistant`).
- Impresión térmica del ticket.
- Subida de imágenes a Supabase Storage: este change usa URL externa o placeholder local.

## Decisions

| ID | Decision | Chosen | Rejected alternative(s) |
|----|----------|--------|-------------------------|
| D1 | Order of implementation | **Catálogo first** per approved SDD roadmap | Start with `venta` using mocks; start with `dashboard` |
| D2 | Barcode scanner | **Native Barcode Detection API** with manual SKU fallback | Add `html5-qrcode` dependency |
| D3 | Product images | **Free image URL + local preview** | Full Supabase Storage integration in this change |
| D4 | Product creation by employees | **No** — only admin creates/edits; employees browse and add to sale | Allow employees to create products on the fly |
| D5 | Color fields | **Use existing `color_nombre` + `color_hex`** in forms, no harmony math yet | Defer color fields to `color-palette-assistant` |
| D6 | Bottom navigation | **Shared `BottomNav`** across Dashboard/Sale/Catalog from this change | Each screen with its own nav |
| D7 | Testing methodology | **TDD**: tests before production code for API, utilities, stores and atomic components | Write tests after implementation |

### D1 — Catálogo first (MUST)
El roadmap SDD aprobado en `docs/product-definition.md` ordena: `catalogo` → `venta` → `dashboard` → `proveedores-dte`. Empezar por `venta` requeriría productos de prueba o mocks que luego habría que reemplazar; empezar por `dashboard` sería solo visualidad sin datos. El schema de catálogo ya existe, por lo que este change tiene el menor rework posterior.

### D2 — Barcode Detection API nativa (MUST)
La API nativa `BarcodeDetector` está disponible en Chrome/Android y en PWAs modernas, no requiere dependencia adicional y encaja con el principio de "cero fricción" (sin diálogos de permisos extra ni peso de bundle). Se acepta el riesgo de soporte parcial en iOS/Safari con un fallback a input manual de SKU. Rechazado `html5-qrcode` porque agrega una dependencia más y potencialmente requiere acceso a cámara con más fricción.

### D3 — Imágenes por URL (MUST)
Subir imágenes a Storage implica manejo de buckets, políticas RLS de Storage, compresión y previews. Para el MVP es suficiente permitir una URL externa o un placeholder con el indicador de color. El change `catalogo` se mantiene enfocado en datos de producto; Storage se evaluará cuando Angélica valide la necesidad real de fotos propias.

### D4 — Solo admin crea/edita productos (MUST)
`product-definition.md` 7.1 establece que empleados "solo venden" y no ven costos ni proveedores. Permitir que un empleado cree productos implicaría decidir costo y proveedor en el momento de la venta, lo que contradice el modelo de seguridad (costo en `producto_costos` admin-only). La vista previa efímera de un SKU desconocido, por tanto, solo permite crear producto para admin; para empleado muestra un mensaje informativo.

### D5 — Campos de color desde el día 1 (SHOULD)
`data-model` ya agregó `color_nombre` y `color_hex` con CHECK. Incluirlos en el formulario de producto cuesta marginalmente dos inputs y habilita `color-palette-assistant` sin migración adicional. No se implementa distancia de color ni algoritmo en este change.

### D6 — BottomNav compartido (MUST)
El handoff de diseño muestra un nav inferior de 4 tabs en Dashboard, Venta y Catálogo. Construirlo ahora evita duplicar navs parciales en `venta` y `dashboard`, y unifica la navegación del MVP.

### D7 — TDD (MUST)
El usuario explicitó que el desarrollo debe guiarse por TDD. Se aplica principalmente a: API layer, utilidades puras, stores y componentes atómicos/moleculares. Para screens/containers se usan tests de integración ligera donde aporte; la lógica pesada debe vivir en módulos testeados por separado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/catalogo/` | New | CatalogScreen, ProductDetailScreen, ProductFormScreen, catalogoApi, tests. |
| `src/features/escaner/` | Modified | ScannerScreen skeleton becomes real; barcodeDetection helper added. |
| `src/components/{atoms,molecules,organisms}/` | New | StockBadge, Stepper, SearchInput, ProductCard, BottomNav, ScreenHeader. |
| `src/stores/saleDraft.ts` | Possibly extended | "Agregar a venta" from catalog/detail. |
| `src/lib/router.tsx` | Modified | Add `/catalogo/new`, `/catalogo/:id/edit`. |
| `src/lib/database.types.ts` | Regenerated | Include latest RPCs (`listar_perfiles`, `actualizar_activo_perfil`). |
| `openspec/changes/catalogo/` | New | SDD artifacts for this change. |
| `openspec/specs/catalogo/spec.md` | Modified | Add UI/API contracts to existing schema spec. |

## Risks

| ID | Risk | Likelihood | Mitigation |
|----|------|------------|------------|
| R1 | `BarcodeDetector` unsupported in some browsers | Med | Manual SKU fallback; never block the sale flow. |
| R2 | `producto_costos` embed degrades to `null` for employees, not `[]` | Low | Handle both shapes in UI; never assume array. |
| R3 | Scope creep into sale/dashboard logic | Med | Strictly bound to catalog; reuse components but no sale logic. |
| R4 | Broken image URLs | Low | Placeholder with color indicator or generic icon. |
| R5 | No suppliers exist yet; form asks for `proveedor_id` | Low | Allow null `proveedor_id`; `proveedores-dte` will fill the gap. |
| R6 | TDD slows down UI-heavy screens | Med | Keep logic out of screens; test pure modules and atomic components first. |

## Rollback Plan

This change adds only client files and openspec artifacts; it does NOT modify the database schema (which already exists from `data-model`). Rollback = revert the PR and remove the new files. Routes added to `router.tsx` are removed; skeleton screens are restored. No data migration is needed.

## Dependencies

- `data-model` (archived, LIVE) — provides `productos`, `producto_costos`, `proveedores`, `crear_producto`, `actualizar_producto`, RLS/GRANTs.
- `auth-pin` (archived, LIVE) — provides PIN auth, roles `admin`/`empleado`, route guards.
- `setup-stack` (archived) — provides Vite/React/Tailwind/PWA toolchain and atomic-design structure.

## Success Criteria

- [ ] Admin can create, edit, list and search products.
- [ ] Employee can list/view products but cannot create/edit or see costs.
- [ ] Product search works via `pg_trgm` or `ilike`.
- [ ] Type filters work.
- [ ] Scanner searches by SKU and offers create/view product.
- [ ] Ephemeral preview for unknown SKU works.
- [ ] CI green: lint, format, typecheck, test, build.
- [ ] TDD discipline: tests exist for API layer, utilities, stores and atomic/molecular components.
- [ ] Change documented and archived in `openspec/`.

## Open Questions for design

- OQ-1: Exact debounce/throttle for search input (e.g. 250 ms).
- OQ-2: Whether to paginate the product list or use virtual/infinite scroll on mobile.
- OQ-3: Default sort order for catalog list (name, created_at, stock status).
- OQ-4: How to handle the "+" create button on catalog when user is employee (hide completely or show disabled with tooltip).
