-- Migration: 20260908000000_color_palette_hsl
-- Change: color-palette-assistant
-- Satisfies: REQ-DM-CAT-6, REQ-CPA-8, D1, D4
--
-- NOTE ON FILENAME: design.md names this file
-- `20260813000000_color_palette_hsl.sql`. Production already carries
-- `20260818000000_resumen_dashboard_rpc.sql` as its latest applied
-- migration; the GitHub schema-as-code integration (`supabase db push`)
-- skips any migration whose version is OLDER than the latest applied one.
-- To stay deployable via the normal path, this file is timestamped
-- 20260908000000 instead — same content and intent as design.md described,
-- deviation noted in apply-progress and tasks.md next to task 1.1.
--
-- Adds stored HSL components to `productos` so the color-palette-assistant
-- can rank catalog products by color distance without recomputing hex→HSL
-- on every render (D1), and creates `pedidos_pendientes` for out-of-stock
-- customer notes (D4). Depends on 20260705000100_domain_tables.sql (table
-- + is_admin() must already exist) and 20260705000300_domain_rpc.sql
-- (crear_producto / actualizar_producto being replaced here).

-- ============================================================
-- 1. HSL columns on productos — nullable, mirror color_hex nullability.
-- REQ-DM-CAT-6.
-- ============================================================
ALTER TABLE public.productos
  ADD COLUMN color_h integer CHECK (color_h BETWEEN 0 AND 360),
  ADD COLUMN color_s integer CHECK (color_s BETWEEN 0 AND 100),
  ADD COLUMN color_l integer CHECK (color_l BETWEEN 0 AND 100);

-- ============================================================
-- hex_to_hsl — pure conversion helper, NULL-safe (NULL in, NULL row out).
-- Internal-only: never granted to anon/authenticated, called exclusively
-- from within the SECURITY DEFINER RPCs below (current_user there is the
-- function owner, which retains implicit EXECUTE as owner). Same posture
-- as touch_updated_at() — trigger/internal-only, hygiene REVOKE from every
-- API role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.hex_to_hsl(p_hex text, OUT h integer, OUT s integer, OUT l integer)
  LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_r double precision;
  v_g double precision;
  v_b double precision;
  v_max double precision;
  v_min double precision;
  v_delta double precision;
  v_l double precision;
  v_s double precision;
  v_h double precision;
BEGIN
  IF p_hex IS NULL THEN
    h := NULL; s := NULL; l := NULL;
    RETURN;
  END IF;

  v_r := get_byte(decode(substring(p_hex from 2 for 2), 'hex'), 0) / 255.0;
  v_g := get_byte(decode(substring(p_hex from 4 for 2), 'hex'), 0) / 255.0;
  v_b := get_byte(decode(substring(p_hex from 6 for 2), 'hex'), 0) / 255.0;

  v_max := greatest(v_r, v_g, v_b);
  v_min := least(v_r, v_g, v_b);
  v_l := (v_max + v_min) / 2;
  v_delta := v_max - v_min;

  IF v_delta = 0 THEN
    v_h := 0;
    v_s := 0;
  ELSE
    v_s := v_delta / (1 - abs(2 * v_l - 1));
    IF v_max = v_r THEN
      v_h := 60 * ((v_g - v_b) / v_delta);
    ELSIF v_max = v_g THEN
      v_h := 60 * (((v_b - v_r) / v_delta) + 2);
    ELSE
      v_h := 60 * (((v_r - v_g) / v_delta) + 4);
    END IF;
    IF v_h < 0 THEN v_h := v_h + 360; END IF;
  END IF;

  h := round(v_h::numeric)::int;
  s := round((v_s * 100)::numeric)::int;
  l := round((v_l * 100)::numeric)::int;
END; $$;
REVOKE EXECUTE ON FUNCTION public.hex_to_hsl(text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Backfill existing rows: any product with a color_hex already set gets
-- its HSL computed once, in place. New rows always go through
-- crear_producto/actualizar_producto below.
-- ============================================================
UPDATE public.productos p
SET color_h = hsl.h, color_s = hsl.s, color_l = hsl.l
FROM (
  SELECT id, (public.hex_to_hsl(color_hex)).*
  FROM public.productos
  WHERE color_hex IS NOT NULL
) hsl
WHERE p.id = hsl.id;

-- ============================================================
-- crear_producto — CREATE OR REPLACE, same signature as
-- 20260705000300_domain_rpc.sql. Adds color_h/s/l computed from
-- color_hex via hex_to_hsl(). REQ-DM-CAT-6.
-- ============================================================
CREATE OR REPLACE FUNCTION public.crear_producto(
    p_producto jsonb,
    p_costo integer DEFAULT NULL,
    p_proveedor_id uuid DEFAULT NULL)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid; v_hsl record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo admin'; END IF;    -- authz gate
  v_hsl := public.hex_to_hsl(p_producto->>'color_hex');
  INSERT INTO public.productos (nombre, sku, tipo, marca, grosor, peso_metraje,
                                color_nombre, color_hex, color_h, color_s, color_l,
                                precio_venta, stock, stock_minimo, imagen_url)
    SELECT p_producto->>'nombre', p_producto->>'sku', p_producto->>'tipo', p_producto->>'marca',
           p_producto->>'grosor', p_producto->>'peso_metraje', p_producto->>'color_nombre',
           p_producto->>'color_hex', v_hsl.h, v_hsl.s, v_hsl.l,
           (p_producto->>'precio_venta')::int,
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

-- ============================================================
-- actualizar_producto — CREATE OR REPLACE, same signature as
-- 20260705000300_domain_rpc.sql. PATCH semantics preserved: color_h/s/l
-- only recompute when the `color_hex` key is PRESENT in p_producto
-- (including an explicit JSON null, which clears color_hex and its HSL
-- together). REQ-DM-CAT-6.
-- ============================================================
CREATE OR REPLACE FUNCTION public.actualizar_producto(
    p_id uuid,
    p_producto jsonb,
    p_costo integer DEFAULT NULL,
    p_proveedor_id uuid DEFAULT NULL,
    p_stock_delta integer DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_hsl record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo admin'; END IF;    -- authz gate, same as crear_producto

  IF p_producto ? 'stock' THEN
    RAISE EXCEPTION 'stock no se edita en p_producto: use p_stock_delta';   -- hard reject, never silent
  END IF;

  -- Always assign v_hsl (even to a NULL-valued row) so the CASE expressions
  -- below never reference an unassigned plpgsql record — PL/pgSQL resolves
  -- `v_hsl.h` before evaluating which CASE branch wins, so an unassigned
  -- record raises at runtime regardless of the `? 'color_hex'` guard.
  -- `->>` on a missing key returns SQL NULL, and hex_to_hsl(NULL) returns a
  -- NULL-valued (h,s,l) row, so this is safe and correct either way.
  v_hsl := public.hex_to_hsl(p_producto->>'color_hex');

  UPDATE public.productos SET
    nombre        = CASE WHEN p_producto ? 'nombre'        THEN p_producto->>'nombre'             ELSE nombre        END,
    sku           = CASE WHEN p_producto ? 'sku'           THEN p_producto->>'sku'                ELSE sku           END,
    tipo          = CASE WHEN p_producto ? 'tipo'          THEN p_producto->>'tipo'                ELSE tipo          END,
    marca         = CASE WHEN p_producto ? 'marca'         THEN p_producto->>'marca'               ELSE marca         END,
    grosor        = CASE WHEN p_producto ? 'grosor'        THEN p_producto->>'grosor'              ELSE grosor        END,
    peso_metraje  = CASE WHEN p_producto ? 'peso_metraje'  THEN p_producto->>'peso_metraje'        ELSE peso_metraje  END,
    color_nombre  = CASE WHEN p_producto ? 'color_nombre'  THEN p_producto->>'color_nombre'        ELSE color_nombre  END,
    color_hex     = CASE WHEN p_producto ? 'color_hex'     THEN p_producto->>'color_hex'           ELSE color_hex     END,
    color_h       = CASE WHEN p_producto ? 'color_hex'     THEN v_hsl.h                            ELSE color_h       END,
    color_s       = CASE WHEN p_producto ? 'color_hex'     THEN v_hsl.s                            ELSE color_s       END,
    color_l       = CASE WHEN p_producto ? 'color_hex'     THEN v_hsl.l                            ELSE color_l       END,
    precio_venta  = CASE WHEN p_producto ? 'precio_venta'  THEN (p_producto->>'precio_venta')::int ELSE precio_venta  END,
    stock_minimo  = CASE WHEN p_producto ? 'stock_minimo'  THEN (p_producto->>'stock_minimo')::int ELSE stock_minimo  END,
    imagen_url    = CASE WHEN p_producto ? 'imagen_url'    THEN p_producto->>'imagen_url'          ELSE imagen_url    END
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'producto inexistente: %', p_id; END IF;

  IF p_costo IS NOT NULL OR p_proveedor_id IS NOT NULL THEN
    INSERT INTO public.producto_costos (producto_id, costo, proveedor_id)
      VALUES (p_id, COALESCE(p_costo, 0), p_proveedor_id)
    ON CONFLICT (producto_id) DO UPDATE
      SET costo        = COALESCE(p_costo, public.producto_costos.costo),
          proveedor_id = COALESCE(p_proveedor_id, public.producto_costos.proveedor_id);
  END IF;

  IF p_stock_delta IS NOT NULL AND p_stock_delta <> 0 THEN
    UPDATE public.productos SET stock = stock + p_stock_delta WHERE id = p_id;   -- CHECK(stock>=0) is the backstop (OQ-5)
    INSERT INTO public.movimientos_stock (producto_id, tipo, cantidad, actor_id)
      VALUES (p_id, 'ajuste', p_stock_delta, auth.uid());                       -- column + ledger, same txn (D3)
  END IF;
END; $$;

-- EXECUTE hygiene is unaffected by CREATE OR REPLACE re-runs of the same
-- signature, but re-asserted here for defense-in-depth (idempotent).
REVOKE EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.actualizar_producto(uuid, jsonb, integer, uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)                  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.actualizar_producto(uuid, jsonb, integer, uuid, integer) TO authenticated;

-- ============================================================
-- pedidos_pendientes — out-of-stock customer notes for the color-palette
-- assistant (D4, REQ-CPA-8). Admin-only end to end (RLS + no anon grant),
-- matching the tool's in-store/internal-use scope from the proposal.
-- ============================================================
CREATE TABLE public.pedidos_pendientes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nota       text        NOT NULL,
  colores    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_pendientes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_pendientes TO authenticated;
CREATE POLICY pedidos_pendientes_all_admin ON public.pedidos_pendientes
  FOR ALL TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- anon: zero grants (matches the domain table posture in
-- 20260705000200_domain_rls.sql).
REVOKE ALL ON public.pedidos_pendientes FROM anon;
