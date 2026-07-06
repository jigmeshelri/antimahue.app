---
change: data-model
phase: design
status: in_progress
depends_on: [proposal]
supersedes: ~
persistence: openspec
resolves_proposal_oq: ["OQ-1", "OQ-2", "OQ-3", "OQ-4", "OQ-5"]
closes_setup_stack: ["REQ-SETUP-7", "V-7"]
updated_at: 2026-07-05
---

# Design: data-model — domain schema, RLS policies & domain RPC

## Technical Approach

Add the Antimahue business domain on top of the `setup-stack` scaffold (`profiles`, `auth_attempts`,
`audit_log`, RLS deny-by-default, `pgcrypto`, the SECURITY DEFINER + `search_path=''` pattern). Seven
domain tables, one platform helper (`is_admin()`), and four domain RPCs. The design lever is single:
**the client bundle is UNTRUSTED — every money/stock write goes through a `SECURITY DEFINER` RPC that is
the ONLY write path; the client is granted `SELECT` (+ admin CRUD on plain reference data) and nothing
else.** This closes `setup-stack` REQ-SETUP-7 / V-7 (the deferred GRANTs + `auth.uid()` policies).

No UI. No SQL is executed by this phase — the `apply` phase writes the migration FILES (schema-as-code;
the GitHub integration auto-deploys `supabase/migrations/*.sql` on push, so files MUST use strictly
increasing timestamp prefixes and MUST NOT be applied via MCP `apply_migration`).

Money is modeled as `integer` CLP (Chilean peso has no cents in retail practice) — avoids float rounding
on totals; every money/quantity column carries a `>= 0` CHECK.

## Architecture Decisions

### DD1 — Enum representation: CHECK constraints, not `CREATE TYPE ... AS ENUM` (MUST)

| Option | Tradeoff | Decision |
|---|---|---|
| `CHECK (col IN (...))` | Adding a value = one `ALTER ... DROP/ADD CONSTRAINT`; matches scaffold `profiles.rol` | **CHOSEN** |
| Native `ENUM` type | Type-safe, but value removal is impossible and `ALTER TYPE ADD VALUE` cannot run in a txn block | Rejected |

Rationale: the scaffold already uses `CHECK (rol IN ('admin'))`. Reserving `movimientos_stock.tipo =
'compra'` now (forward-compat for `dte-import`) is a CHECK edit, not an enum migration. Consistent, and
enum's rigidity buys nothing here.

### DD2 — Single-writer RPC = `SECURITY DEFINER`; client has no write GRANT (MUST) — SECURITY-CRITICAL

`confirmar_venta`, `deshacer_venta`, `crear_producto`, `actualizar_producto` are `SECURITY DEFINER` so
they run as the owner and can write tables that `authenticated` **cannot** write directly (no
INSERT/UPDATE/DELETE GRANT on `productos`, `producto_costos`, `ventas`, `venta_items`,
`movimientos_stock`). Rejected `SECURITY INVOKER`: it would force write GRANTs + write RLS policies on
those tables, opening a direct PostgREST path that bypasses the RPC (client could set `precio_unitario`,
`stock`, `total` at will). DEFINER + no client write-GRANT makes the RPC the sole write path → integrity
is structural, not conventional.

> **MUST:** A `SECURITY DEFINER` function bypasses RLS. Authorization that RLS would have enforced MUST be
> re-asserted inside the function body. `crear_producto`/`actualizar_producto` MUST begin with
> `IF NOT public.is_admin() THEN RAISE EXCEPTION`. `confirmar_venta`/`deshacer_venta` gate on
> `auth.uid() IS NOT NULL` only (selling is allowed for every authenticated user, admin or future employee).

### DD3 — `is_admin()` in `public`, DEFINER, STABLE, EXECUTE to `authenticated` only (MUST)

`SECURITY DEFINER` reads `public.profiles` bypassing its RLS (no recursion — `profiles`' own policy is
`id = (select auth.uid())`, which never calls `is_admin()`). Lives in `public` (RLS policies reference
`public.is_admin()`; hiding it in a non-exposed schema adds grant/search_path friction for zero gain — the
function returns only a boolean about the CALLER's own uid, leaking nothing). Because a DEFINER function in
`public` is callable by PUBLIC by default, EXECUTE hygiene is mandatory: `REVOKE FROM PUBLIC` then
`GRANT TO authenticated` (anon excluded).

### DD4 — Search-by-name index: `pg_trgm` GIN in the `extensions` schema (SHOULD)

Barcode lookup is covered by the `UNIQUE` index on `productos.sku`. Substring name search
(`nombre ILIKE '%…%'`) gets a GIN trigram index. Install `pg_trgm` in the **`extensions`** schema (NOT
`public` — the `extension_in_public` advisor flags the latter). At a barrio-store catalog size the index is
optional (seq scan is fine), but it is cheap forward-insurance and the correct primitive for the "search by
name" screen. Alternative rejected: `lower(nombre)` btree (prefix-only, misses infix matches Angélica uses).

### DD5 — `updated_at` maintenance: one `touch_updated_at()` BEFORE UPDATE trigger (SHOULD)

RPCs set `updated_at = now()` explicitly, but `proveedores` and `configuracion` take direct admin writes. A
single trigger function (`SET search_path=''`, attached to `productos`, `producto_costos`, `proveedores`,
`configuracion`) keeps the column honest without app discipline. Trigger-only → `REVOKE EXECUTE FROM
PUBLIC, anon, authenticated` (same posture as `handle_new_user`).

## Schema DDL

Migration ordering respects FK dependencies: `proveedores` → `productos` → `producto_costos` → `ventas` →
`venta_items` → `movimientos_stock` → `configuracion`.

```sql
-- pg_trgm for name search (DD4) — extensions schema, not public
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 1. proveedores — admin-only reference data (supplier PII: A2)
CREATE TABLE public.proveedores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  contacto   text,
  telefono   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;   -- D2/D7, T2/T10

-- 2. productos — EMPLOYEE-SAFE columns only (no costo, no proveedor_id)
CREATE TABLE public.productos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text        UNIQUE,                          -- barcode EAN/UPC; nullable, unique-if-present
  nombre        text        NOT NULL,
  tipo          text        CHECK (tipo IN ('lana','algodon','hilo','palillo','crochet','accesorio')),
  marca         text,
  grosor        text,
  peso_metraje  text,
  color_nombre  text,                                        -- D5: Angélica's word (search/display)
  color_hex     text        CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),  -- D5: for color-palette-assistant
  precio_venta  integer     NOT NULL CHECK (precio_venta >= 0),        -- CLP integer
  stock         integer     NOT NULL DEFAULT 0 CHECK (stock >= 0),     -- OQ-5: belt (RPC = suspenders)
  stock_minimo  integer     CHECK (stock_minimo >= 0),       -- D6: NULL = use configuracion default
  imagen_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_productos_nombre_trgm ON public.productos USING gin (nombre extensions.gin_trgm_ops);

-- 3. producto_costos — 1:1 admin-only secret (cost + supplier link). D2
CREATE TABLE public.producto_costos (
  producto_id  uuid        PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
  costo        integer     NOT NULL CHECK (costo >= 0),      -- CLP integer
  proveedor_id uuid        REFERENCES public.proveedores(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producto_costos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_producto_costos_proveedor ON public.producto_costos(proveedor_id);

-- 4. ventas — soft-cancel via estado (D4)
CREATE TABLE public.ventas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,   -- matches audit_log; nullable to survive user delete
  medio_pago text        NOT NULL CHECK (medio_pago IN ('efectivo','transferencia','debito','credito')),
  total      integer     NOT NULL CHECK (total >= 0),        -- recomputed server-side (T11)
  estado     text        NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','deshecha')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ventas_confirmada_created ON public.ventas(created_at DESC, id DESC) WHERE estado = 'confirmada';  -- "last sale" (T12) + ventas-del-día

-- 5. venta_items — precio_unitario FROZEN snapshot (D4)
CREATE TABLE public.venta_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        uuid    NOT NULL REFERENCES public.ventas(id)    ON DELETE CASCADE,
  producto_id     uuid    NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,  -- can't delete a sold product
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  precio_unitario integer NOT NULL CHECK (precio_unitario >= 0)   -- snapshot; a later price edit MUST NOT change past tickets
);
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_venta_items_venta ON public.venta_items(venta_id);

-- 6. movimientos_stock — typed ledger, SIGNED delta (D3). Written ONLY inside the stock RPCs.
CREATE TABLE public.movimientos_stock (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid        NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  tipo          text        NOT NULL CHECK (tipo IN ('venta','deshacer_venta','compra','ajuste')),  -- 'compra' reserved for dte-import
  cantidad      integer     NOT NULL CHECK (cantidad <> 0),      -- signed: venta<0, deshacer/compra>0
  referencia_id uuid,                                            -- e.g. ventas.id; NULL for 'ajuste'
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_movimientos_producto_created ON public.movimientos_stock(producto_id, created_at DESC);

-- 7. configuracion — singleton (D6), seeded in-migration (OQ-4)
CREATE TABLE public.configuracion (
  id                   integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stock_minimo_default integer     NOT NULL DEFAULT 5 CHECK (stock_minimo_default >= 0),
  nombre_tienda        text        NOT NULL DEFAULT 'Antimahue',
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
INSERT INTO public.configuracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;   -- OQ-4: idempotent seed
```

Effective minimum stock (D6, resolved at read, NOT a column DEFAULT):
`COALESCE(productos.stock_minimo, (SELECT stock_minimo_default FROM public.configuracion WHERE id = 1))`.

## Platform helper & triggers

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND rol = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;   -- DD3; anon excluded

CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
-- attach BEFORE UPDATE on productos, producto_costos, proveedores, configuracion (DD5)
```

## RLS policies & GRANT matrix (closes REQ-SETUP-7 / V-7)

`anon` receives **zero** GRANTs on every table — the app requires auth. All policies are `TO authenticated`
and use `(select auth.uid())` (init-plan optimization). Every write policy carries **both** `USING` and
`WITH CHECK` (D7).

| Table | `authenticated` GRANT | Policy (op → predicate) | Writes |
|---|---|---|---|
| `profiles` | SELECT | SELECT: `id = (select auth.uid())` | none (rol fixed on MVP) |
| `productos` | SELECT | SELECT: `true` | RPC-only (no write GRANT) |
| `producto_costos` | SELECT | SELECT: `is_admin()` | RPC-only |
| `proveedores` | SELECT, INSERT, UPDATE, DELETE | ALL: USING `is_admin()` + WITH CHECK `is_admin()` | direct admin CRUD (plain ref data) |
| `ventas` | SELECT | SELECT: `true` | RPC-only |
| `venta_items` | SELECT | SELECT: `true` | RPC-only |
| `movimientos_stock` | SELECT | SELECT: `is_admin()` | RPC-only (audit ledger, no employee read use-case) |
| `configuracion` | SELECT, UPDATE | SELECT: `true`; UPDATE: USING `is_admin()` + WITH CHECK `is_admin()` | admin UPDATE only (singleton, no INSERT/DELETE) |

```sql
-- productos: catalog readable by everyone authenticated; writes RPC-only (no write GRANT).
GRANT SELECT ON public.productos TO authenticated;
CREATE POLICY productos_select ON public.productos FOR SELECT TO authenticated USING (true);

-- producto_costos + proveedores: admin-only. GRANT SELECT present so a non-admin PostgREST embed
-- (productos?select=*,producto_costos(costo)) degrades to [] (RLS filters rows), NOT 403. D2/R5.
GRANT SELECT ON public.producto_costos TO authenticated;
CREATE POLICY producto_costos_select_admin ON public.producto_costos
  FOR SELECT TO authenticated USING ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
CREATE POLICY proveedores_all_admin ON public.proveedores
  FOR ALL TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- ventas / venta_items: readable (day totals, ticket render); writes RPC-only.
GRANT SELECT ON public.ventas      TO authenticated;
GRANT SELECT ON public.venta_items TO authenticated;
CREATE POLICY ventas_select      ON public.ventas      FOR SELECT TO authenticated USING (true);
CREATE POLICY venta_items_select ON public.venta_items FOR SELECT TO authenticated USING (true);

-- movimientos_stock: audit ledger, admin-only read; writes RPC-only.
GRANT SELECT ON public.movimientos_stock TO authenticated;
CREATE POLICY movimientos_select_admin ON public.movimientos_stock
  FOR SELECT TO authenticated USING ((select public.is_admin()));

-- configuracion: all read (COALESCE default + nombre_tienda for ticket); admin UPDATE only.
GRANT SELECT, UPDATE ON public.configuracion TO authenticated;
CREATE POLICY configuracion_select ON public.configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY configuracion_update_admin ON public.configuracion
  FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- profiles: read own row (client learns its rol to shape UI). No client write path.
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (id = (select auth.uid()));
GRANT SELECT ON public.profiles TO authenticated;
```

## Domain RPC

All `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE EXECUTE FROM PUBLIC` then `GRANT EXECUTE TO
authenticated` (anon excluded — OQ-3). Own objects schema-qualified (`public.*`); `auth.uid()` qualified;
`pg_catalog` built-ins (`now`, `gen_random_uuid`, `jsonb_*`) resolve implicitly even under empty search_path.

```sql
-- confirmar_venta: atomic sale close. Client sends items + medio_pago ONLY.
-- Price is authoritative from productos (T11 — never trust a client price). Total recomputed server-side.
-- Returns the new venta id. GRANT EXECUTE TO authenticated (OQ-3: admin + future employee both sell).
CREATE OR REPLACE FUNCTION public.confirmar_venta(p_items jsonb, p_medio_pago text)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_venta uuid; v_total int := 0;
  v_item jsonb; v_pid uuid; v_qty int; v_precio int; v_stock int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  IF p_medio_pago NOT IN ('efectivo','transferencia','debito','credito')
     THEN RAISE EXCEPTION 'medio de pago inválido: %', p_medio_pago; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0
     THEN RAISE EXCEPTION 'venta sin items'; END IF;

  INSERT INTO public.ventas (actor_id, medio_pago, total, estado)
  VALUES (v_actor, p_medio_pago, 0, 'confirmada') RETURNING id INTO v_venta;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'producto_id')::uuid;
    v_qty := (v_item->>'cantidad')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'cantidad inválida: %', v_pid; END IF;

    SELECT precio_venta, stock INTO v_precio, v_stock
      FROM public.productos WHERE id = v_pid FOR UPDATE;   -- row lock: no oversell race (T14)
    IF NOT FOUND THEN RAISE EXCEPTION 'producto inexistente: %', v_pid; END IF;
    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'stock insuficiente % (hay %, pide %)', v_pid, v_stock, v_qty; END IF;

    INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario)
      VALUES (v_venta, v_pid, v_qty, v_precio);                       -- freeze price
    UPDATE public.productos SET stock = stock - v_qty WHERE id = v_pid;
    INSERT INTO public.movimientos_stock (producto_id, tipo, cantidad, referencia_id, actor_id)
      VALUES (v_pid, 'venta', -v_qty, v_venta, v_actor);              -- column + ledger, one txn (D3/R1)
    v_total := v_total + v_precio * v_qty;
  END LOOP;

  UPDATE public.ventas SET total = v_total WHERE id = v_venta;
  RETURN v_venta;
END; $$;

-- deshacer_venta: soft-cancel the LAST confirmed sale only (D4/T12). Compensating ledger entries.
CREATE OR REPLACE FUNCTION public.deshacer_venta(p_venta_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid(); v_estado text; v_last uuid; v_it record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;

  SELECT estado INTO v_estado FROM public.ventas WHERE id = p_venta_id FOR UPDATE;  -- serialize concurrent undo
  IF NOT FOUND THEN RAISE EXCEPTION 'venta inexistente: %', p_venta_id; END IF;
  IF v_estado <> 'confirmada' THEN RAISE EXCEPTION 'la venta no está confirmada'; END IF;

  SELECT id INTO v_last FROM public.ventas
    WHERE estado = 'confirmada' ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_last IS DISTINCT FROM p_venta_id THEN
    RAISE EXCEPTION 'solo se puede deshacer la última venta confirmada'; END IF;

  FOR v_it IN SELECT producto_id, cantidad FROM public.venta_items WHERE venta_id = p_venta_id LOOP
    UPDATE public.productos SET stock = stock + v_it.cantidad WHERE id = v_it.producto_id;
    INSERT INTO public.movimientos_stock (producto_id, tipo, cantidad, referencia_id, actor_id)
      VALUES (v_it.producto_id, 'deshacer_venta', v_it.cantidad, p_venta_id, v_actor);
  END LOOP;

  UPDATE public.ventas SET estado = 'deshecha' WHERE id = p_venta_id;   -- soft-cancel: rows kept (T7)
END; $$;

-- crear_producto / actualizar_producto: admin-only, atomic productos + producto_costos.
-- MUST re-assert is_admin() — DEFINER bypasses the admin-only RLS on producto_costos (T13).
CREATE OR REPLACE FUNCTION public.crear_producto(
    p_producto jsonb,                     -- employee-safe fields: nombre, sku, tipo, marca, grosor,
                                          --   peso_metraje, color_nombre, color_hex, precio_venta,
                                          --   stock, stock_minimo, imagen_url
    p_costo integer DEFAULT NULL,
    p_proveedor_id uuid DEFAULT NULL)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo admin'; END IF;    -- T13 gate
  INSERT INTO public.productos (nombre, sku, tipo, marca, grosor, peso_metraje,
                                color_nombre, color_hex, precio_venta, stock, stock_minimo, imagen_url)
    SELECT p_producto->>'nombre', p_producto->>'sku', p_producto->>'tipo', p_producto->>'marca',
           p_producto->>'grosor', p_producto->>'peso_metraje', p_producto->>'color_nombre',
           p_producto->>'color_hex', (p_producto->>'precio_venta')::int,
           COALESCE((p_producto->>'stock')::int, 0), (p_producto->>'stock_minimo')::int,
           p_producto->>'imagen_url'
    RETURNING id INTO v_id;
  IF p_costo IS NOT NULL OR p_proveedor_id IS NOT NULL THEN
    INSERT INTO public.producto_costos (producto_id, costo, proveedor_id)
      VALUES (v_id, COALESCE(p_costo, 0), p_proveedor_id);
  END IF;
  IF COALESCE((p_producto->>'stock')::int, 0) > 0 THEN                   -- opening balance in the ledger
    INSERT INTO public.movimientos_stock (producto_id, tipo, cantidad, actor_id)
      VALUES (v_id, 'ajuste', (p_producto->>'stock')::int, auth.uid());
  END IF;
  RETURN v_id;
END; $$;
-- actualizar_producto(p_id uuid, p_producto jsonb, p_costo int, p_proveedor_id uuid): same is_admin() gate;
-- UPDATE productos (employee-safe fields) + UPSERT producto_costos; stock deltas go through 'ajuste' ledger,
-- never a raw stock overwrite, to keep column+ledger in sync (D3/R1).

REVOKE EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deshacer_venta(uuid)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text)                  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.deshacer_venta(uuid)                          TO authenticated;  -- OQ-3
GRANT  EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)          TO authenticated;  -- is_admin() gates inside
```

## SECURITY INVOKER vs DEFINER per function

| Function | Mode | Why | Internal authz |
|---|---|---|---|
| `is_admin` | DEFINER | read `profiles` bypassing its RLS (no recursion) | n/a (returns caller's own flag) |
| `confirmar_venta` | DEFINER | write ventas/items/stock/movimientos with no client write-GRANT | `auth.uid() IS NOT NULL` |
| `deshacer_venta` | DEFINER | same + enforce "only last" server-side | `auth.uid() IS NOT NULL` |
| `crear_producto` / `actualizar_producto` | DEFINER | atomic productos + producto_costos (admin-only table) | `is_admin()` MUST re-check |
| `touch_updated_at` | (trigger) | runs in table-owner context; EXECUTE revoked from all API roles | n/a |

## OQ resolutions

- **OQ-1 (migration granularity) → three ordered files, not one monolith.** `..000100_domain_tables.sql`
  (tables + indexes + `pg_trgm` + `configuracion` seed), `..000200_domain_rls.sql` (`is_admin()` first,
  then policies + GRANTs), `..000300_domain_rpc.sql` (four RPCs + EXECUTE grants). Ordering guarantees
  `is_admin()` exists before policies reference it and tables exist before RPCs. **Posture:** smaller blast
  radius per apply, independently reviewable, and strictly-increasing timestamp prefixes are mandatory for
  the schema-as-code GitHub integration (never MCP `apply_migration`).
- **OQ-2 (`is_admin()` placement) → `public`, DEFINER, STABLE, `REVOKE FROM PUBLIC` + `GRANT authenticated`
  (anon excluded).** See DD3. **Posture:** the only sensitive-schema concern (DEFINER-in-public callable by
  PUBLIC) is closed by explicit EXECUTE hygiene; the function leaks nothing (boolean about caller's own uid).
- **OQ-3 (GRANT EXECUTE `confirmar_venta`/`deshacer_venta` now) → YES.** Selling is the shared action; the
  RPC gates on `auth.uid()`, safe for any authenticated user; forward-compat for employees. **Posture:**
  least-privilege — the RPC exposes a validated operation, not raw table writes; anon still excluded.
- **OQ-4 (`configuracion` seed) → seed row `id=1` in the table migration, `ON CONFLICT DO NOTHING`.**
  COALESCE resolution returns NULL if the row is absent → seeding guarantees correct stock-min semantics
  from the first read; idempotent. **Posture:** no client INSERT/DELETE policy + `CHECK (id = 1)` make the
  singleton structurally non-duplicable/non-deletable.
- **OQ-5 (`CHECK (stock >= 0)`) → YES, belt AND suspenders.** RPC gives the friendly domain error
  pre-write; the column CHECK is the non-bypassable last-line invariant that holds even against a future
  second write path (R1). Same for `cantidad`/`precio`/`total`/`costo >= 0`, `cantidad > 0` on items.
  **Posture:** declarative constraints abort the whole txn on violation — strictly additive over the
  procedural guard, and even a DEFINER RPC cannot bypass a CHECK.

## Threat model delta (vs setup-stack STRIDE-lite)

**New actor: the curious/malicious EMPLOYEE** — a *lower-privilege but authenticated* user (future
`'empleado'` role) who holds the client JS bundle, can read RPC/table names, and can craft direct
PostgREST/RPC calls that bypass the UI. setup-stack assumed a single admin + anon attacker; the domain layer
adds an insider below admin.

| ID | STRIDE | Threat (new/extended) | Mitigation |
|---|---|---|---|
| T10 | Info disclosure / EoP | Employee reads `producto_costos`/`proveedores` directly or via embed | Admin-only RLS `USING (is_admin())`; GRANT SELECT present → embed degrades to `[]` not 403 (D2). Secret is structural (separate table), no per-column CASE to forget |
| T11 | Tampering | Employee forges a low `precio_unitario`/`total` via direct write or crafted RPC input | No client write-GRANT on any sale/stock table (RPC-only); `confirmar_venta` reads authoritative `precio_venta` server-side, ignores client price; total recomputed. Extends setup-stack T1 |
| T12 | Tampering / Repudiation | Employee undoes an OLD sale (not the last) to reverse stock/history | "only last confirmed" enforced inside `deshacer_venta` with `FOR UPDATE` + estado re-check — never in the UI (D4). Extends T1/T7 |
| T13 | Elevation of privilege | Employee calls `crear_producto`/`actualizar_producto` (DEFINER bypasses RLS) to write costs | In-function `IF NOT is_admin() THEN RAISE` — DEFINER functions MUST re-assert authz (DD2). The subtle one |
| T14 | Tampering | Concurrent `confirmar_venta` on the last unit → oversell / negative stock | `SELECT … FOR UPDATE` row lock serializes; `CHECK (stock >= 0)` is the invariant backstop (OQ-5) |

Reused unchanged: **T2** (RLS deny-by-default — now with explicit least-privilege policies, closing V-7),
**T4** (anon/service_role key separation — untouched), **T7** (traceability — now realized by the typed
`movimientos_stock` ledger + soft-cancel `estado`, not hard delete). No new anon surface: anon keeps zero
GRANTs on every domain table.

## Advisor expectations (post-apply, informational)

- The 2 event-trigger WARNs on `public.rls_auto_enable` (lint 0028/0029) remain — **accepted false
  positive** (platform object, `event_trigger` return type, uncallable). MUST NOT touch.
- The 3 INFO `rls_enabled_no_policy` (`profiles`/`auth_attempts`/`audit_log`) — `profiles` resolves
  (gains `profiles_select_own`); `auth_attempts`/`audit_log` stay INFO intentionally (still deny-by-default,
  no domain read path). Every NEW domain table has ≥1 policy → no new `rls_enabled_no_policy`.
- If `pg_trgm` were installed in `public` instead of `extensions`, `extension_in_public` would WARN —
  avoided by DD4.

## File changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260705000100_domain_tables.sql` | Create | 7 tables, indexes, `pg_trgm`, `configuracion` seed |
| `supabase/migrations/20260705000200_domain_rls.sql` | Create | `is_admin()`, `touch_updated_at()` + triggers, policies, GRANTs |
| `supabase/migrations/20260705000300_domain_rpc.sql` | Create | `confirmar_venta`, `deshacer_venta`, `crear_producto`, `actualizar_producto` + EXECUTE grants |
| `openspec/specs/setup-stack/spec.md` (REQ-SETUP-7 / V-7) | Closes | GRANTs + `auth.uid()` policies delivered here |
| `openspec/project.yaml` → `active_changes` | (already) | `data-model` present |

## Testing strategy

| Layer | What | Approach |
|---|---|---|
| Integration (RLS) | Non-admin embed `producto_costos`/`proveedores` → `[]` not 403; anon → 0 rows on every table | PostgREST request as a seeded non-admin `authenticated` JWT |
| Integration (RPC) | `confirmar_venta` atomic (stock+venta+items+ledger all-or-nothing; rollback on mid-loop `RAISE`); price taken server-side; oversell blocked; `deshacer_venta` rejects any non-last sale; `crear_producto` rejects non-admin | pgTAP / SQL asserts against a local Supabase stack |
| Constraint | `stock >= 0`, `color_hex` regex, `medio_pago`/`tipo`/`estado` CHECK, `configuracion` singleton `id=1` | direct INSERT/UPDATE expecting constraint violation |
| Static | `grep -r` no authorization logic in `src/**` (every rule is a policy/constraint/RPC) | shell in CI |

## Migration / rollout

Additive only (new tables/functions/policies; no `ALTER` of scaffold objects). Rollback = a down migration
dropping the new objects in reverse dependency order (RPCs → policies → `is_admin`/triggers → tables →
`pg_trgm`); `profiles`/`auth_attempts`/`audit_log` untouched → setup-stack baseline restored intact.

## Open questions (residual, for tasks/apply)

- [ ] `actualizar_producto` stock-edit semantics: forbid raw `stock` overwrite in the payload (force all
      deltas through an `'ajuste'` ledger entry) to hold D3/R1 — confirm exact contract in tasks.
- [ ] R5 (embed degrades to `[]` not 403) is asserted by design but MUST be verified empirically in the
      verify phase with a real non-admin JWT; fallback = split read endpoints.
- [ ] Whether `ventas`/`venta_items` SELECT should scope to "today" / "own actor" for employees is deferred
      to the future multi-role change (MVP `USING (true)` is acceptable — single admin today).
