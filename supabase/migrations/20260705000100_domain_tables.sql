-- Migration: 20260705000100_domain_tables
-- Change: data-model
-- Satisfies: REQ-DM-CAT-1, REQ-DM-CAT-2, REQ-DM-CAT-3, REQ-DM-CAT-4, REQ-DM-VENTA-1,
--            REQ-DM-VENTA-2, REQ-DM-CFG-1, REQ-DM-CFG-2, DD1, DD4, OQ-4, OQ-5
--
-- Domain schema — seven business tables for Antimahue (inventory + POS).
-- RLS is enabled inline on every table (no table is ever left deny-by-default
-- transiently within this file); policies + GRANTs are deferred to
-- `20260705000200_domain_rls.sql` (needs `is_admin()` to exist first).
--
-- Money is modeled as `integer` CLP (Chilean peso has no cents in retail
-- practice) — avoids float rounding on totals; every money/quantity column
-- carries a `>= 0` (or `> 0` where zero is invalid) CHECK.
--
-- Enums are `CHECK (col IN (...))`, not native `ENUM` types (DD1) — matches
-- the scaffold's `profiles.rol` pattern; adding a value is a constraint edit,
-- not an enum migration (needed for `movimientos_stock.tipo`'s reserved
-- 'compra' value, forward-compat for the future `dte-import` change).
--
-- Migration ordering respects FK dependencies:
-- proveedores -> productos -> producto_costos -> ventas -> venta_items
-- -> movimientos_stock -> configuracion.

-- ============================================================
-- pg_trgm for name search (DD4) — installed in `extensions`, NOT `public`.
-- Installing in `public` would trigger the `extension_in_public` advisor.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- 1. proveedores — admin-only reference data (supplier PII).
-- Exposure (admin-only RLS) is defined in the next migration; this file
-- only shapes the table and enables RLS immediately.
-- ============================================================
CREATE TABLE public.proveedores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  contacto   text,
  telefono   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;   -- REQ-DM-CAT-3

-- ============================================================
-- 2. productos — EMPLOYEE-SAFE columns only.
-- `costo` and `proveedor_id` deliberately do NOT live here (moved to
-- `producto_costos`, D2) — an employee reading this table never sees cost.
-- ============================================================
CREATE TABLE public.productos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text        UNIQUE,                          -- barcode EAN/UPC; nullable, unique-if-present
  nombre        text        NOT NULL,
  tipo          text        CHECK (tipo IN ('lana','algodon','hilo','palillo','crochet','accesorio')),
  marca         text,
  grosor        text,
  peso_metraje  text,
  color_nombre  text,                                        -- Angélica's word for the color (search/display)
  color_hex     text        CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),  -- for color-palette-assistant; NULL allowed
  precio_venta  integer     NOT NULL CHECK (precio_venta >= 0),        -- CLP integer
  stock         integer     NOT NULL DEFAULT 0 CHECK (stock >= 0),     -- OQ-5: belt (RPC is the suspenders)
  stock_minimo  integer     CHECK (stock_minimo >= 0),       -- NULL = use configuracion default (REQ-DM-CFG-2)
  imagen_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;   -- REQ-DM-CAT-1
CREATE INDEX idx_productos_nombre_trgm ON public.productos USING gin (nombre extensions.gin_trgm_ops);

-- ============================================================
-- 3. producto_costos — 1:1 admin-only secret (cost + supplier link). D2.
-- A product with cost data MUST NOT exist without its matching row, or vice
-- versa — enforced by the `crear_producto`/`actualizar_producto` RPCs
-- (REQ-DM-CAT-5), not by this DDL alone.
-- ============================================================
CREATE TABLE public.producto_costos (
  producto_id  uuid        PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
  costo        integer     NOT NULL CHECK (costo >= 0),      -- CLP integer
  proveedor_id uuid        REFERENCES public.proveedores(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producto_costos ENABLE ROW LEVEL SECURITY;   -- REQ-DM-CAT-2
CREATE INDEX idx_producto_costos_proveedor ON public.producto_costos(proveedor_id);

-- ============================================================
-- 4. ventas — soft-cancel via estado, never a hard delete (D4).
-- ============================================================
CREATE TABLE public.ventas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,   -- matches audit_log; nullable to survive user delete
  medio_pago text        NOT NULL CHECK (medio_pago IN ('efectivo','transferencia','debito','credito')),
  total      integer     NOT NULL CHECK (total >= 0),        -- recomputed server-side, never trusted from client
  estado     text        NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','deshecha')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;   -- REQ-DM-VENTA-1
-- "last sale" lookup (deshacer_venta) + ventas-del-día totals
CREATE INDEX idx_ventas_confirmada_created ON public.ventas(created_at DESC, id DESC) WHERE estado = 'confirmada';

-- ============================================================
-- 5. venta_items — precio_unitario is a FROZEN snapshot (D4).
-- A later edit to productos.precio_venta MUST NOT change past tickets.
-- ============================================================
CREATE TABLE public.venta_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        uuid    NOT NULL REFERENCES public.ventas(id)    ON DELETE CASCADE,
  producto_id     uuid    NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,  -- can't delete a sold product
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  precio_unitario integer NOT NULL CHECK (precio_unitario >= 0)   -- snapshot at sale time
);
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;   -- REQ-DM-VENTA-1
CREATE INDEX idx_venta_items_venta ON public.venta_items(venta_id);

-- ============================================================
-- 6. movimientos_stock — typed ledger, SIGNED delta (D3).
-- Written ONLY inside the domain RPCs (confirmar_venta, deshacer_venta,
-- crear_producto, actualizar_producto) — never a second, ad hoc write path.
-- 'compra' is reserved now (no `compras` table yet) for the future
-- `dte-import` change.
-- ============================================================
CREATE TABLE public.movimientos_stock (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid        NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  tipo          text        NOT NULL CHECK (tipo IN ('venta','deshacer_venta','compra','ajuste')),
  cantidad      integer     NOT NULL CHECK (cantidad <> 0),      -- signed: venta<0, deshacer/compra/ajuste sign varies
  referencia_id uuid,                                            -- e.g. ventas.id; NULL for 'ajuste'
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;   -- REQ-DM-VENTA-2
CREATE INDEX idx_movimientos_producto_created ON public.movimientos_stock(producto_id, created_at DESC);

-- ============================================================
-- 7. configuracion — singleton (D6), seeded in this migration (OQ-4).
-- Effective minimum stock (resolved at READ time, never a column DEFAULT,
-- so a later global change propagates retroactively — REQ-DM-CFG-2/3):
--   COALESCE(productos.stock_minimo,
--            (SELECT stock_minimo_default FROM public.configuracion WHERE id = 1))
-- ============================================================
CREATE TABLE public.configuracion (
  id                   integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stock_minimo_default integer     NOT NULL DEFAULT 5 CHECK (stock_minimo_default >= 0),
  nombre_tienda        text        NOT NULL DEFAULT 'Antimahue',
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;   -- REQ-DM-CFG-1
INSERT INTO public.configuracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;   -- OQ-4: idempotent seed
