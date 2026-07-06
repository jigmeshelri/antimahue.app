-- Migration: 20260705000300_domain_rpc
-- Change: data-model
-- Satisfies: REQ-DM-VENTA-3, REQ-DM-VENTA-4, REQ-DM-CAT-5, DD2, DD3, OQ-3, OQ-5
--
-- Domain RPCs — the client bundle is UNTRUSTED. Every money/stock write goes
-- through one of these four SECURITY DEFINER functions; they are the ONLY
-- write path for productos, producto_costos, ventas, venta_items and
-- movimientos_stock (no client write GRANT exists on any of those tables —
-- see 20260705000200_domain_rls.sql). Depends on that migration: tables and
-- is_admin() must already exist.
--
-- All four are `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE EXECUTE
-- FROM PUBLIC` then `GRANT EXECUTE TO authenticated` (anon excluded — OQ-3).
-- Own objects are schema-qualified (public.*); auth.uid() is qualified;
-- pg_catalog built-ins (now, gen_random_uuid, jsonb_*) resolve implicitly
-- even under empty search_path.
--
-- IMPORTANT: a SECURITY DEFINER function bypasses RLS. Authorization that
-- RLS would have enforced MUST be re-asserted inside the function body.
-- crear_producto/actualizar_producto begin with an is_admin() gate;
-- confirmar_venta/deshacer_venta gate on auth.uid() IS NOT NULL only
-- (selling is allowed for every authenticated user, admin or future
-- employee — DD2).

-- ============================================================
-- confirmar_venta: atomic sale close. Client sends items + medio_pago ONLY.
-- Price is authoritative from productos (never trust a client price). Total
-- is recomputed server-side. Returns the new venta id.
-- REQ-DM-VENTA-3.
-- ============================================================
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
      FROM public.productos WHERE id = v_pid FOR UPDATE;   -- row lock: no oversell race
    IF NOT FOUND THEN RAISE EXCEPTION 'producto inexistente: %', v_pid; END IF;
    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'stock insuficiente % (hay %, pide %)', v_pid, v_stock, v_qty; END IF;

    INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario)
      VALUES (v_venta, v_pid, v_qty, v_precio);                       -- freeze price
    UPDATE public.productos SET stock = stock - v_qty WHERE id = v_pid;
    INSERT INTO public.movimientos_stock (producto_id, tipo, cantidad, referencia_id, actor_id)
      VALUES (v_pid, 'venta', -v_qty, v_venta, v_actor);              -- column + ledger, one txn (D3)
    v_total := v_total + v_precio * v_qty;
  END LOOP;

  UPDATE public.ventas SET total = v_total WHERE id = v_venta;
  RETURN v_venta;
END; $$;

-- ============================================================
-- deshacer_venta: soft-cancel the LAST confirmed sale only. Compensating
-- ledger entries restore stock. REQ-DM-VENTA-4.
-- ============================================================
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

  UPDATE public.ventas SET estado = 'deshecha' WHERE id = p_venta_id;   -- soft-cancel: rows kept
END; $$;

-- ============================================================
-- crear_producto: admin-only, atomic productos + producto_costos write.
-- MUST re-assert is_admin() — DEFINER bypasses the admin-only RLS on
-- producto_costos. REQ-DM-CAT-5.
-- ============================================================
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo admin'; END IF;    -- authz gate
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

-- ============================================================
-- actualizar_producto: contract decided in the tasks phase (design.md left
-- this as a residual open question, L472-473). Signature:
--   actualizar_producto(p_id uuid, p_producto jsonb, p_costo integer DEFAULT NULL,
--                        p_proveedor_id uuid DEFAULT NULL, p_stock_delta integer DEFAULT NULL)
--
-- Same is_admin() gate as crear_producto. A `stock` key inside p_producto is
-- a HARD ERROR — never silently ignored: every stock change MUST go through
-- p_stock_delta so the productos.stock column and the movimientos_stock
-- ledger never desync (D3). UPDATE touches employee-safe columns only
-- (PATCH semantics via the `?` jsonb existence operator — a key ABSENT from
-- the payload leaves the column untouched; a key PRESENT with a JSON null
-- clears it). producto_costos is UPSERTed. The p_stock_delta write and its
-- ledger row happen in the same statement sequence as the rest of the
-- function call — an unhandled exception (e.g. the stock >= 0 CHECK
-- underflowing) aborts the WHOLE call, so productos + producto_costos +
-- movimientos_stock either all commit or none do. REQ-DM-CAT-5.
-- ============================================================
CREATE OR REPLACE FUNCTION public.actualizar_producto(
    p_id uuid,
    p_producto jsonb,
    p_costo integer DEFAULT NULL,
    p_proveedor_id uuid DEFAULT NULL,
    p_stock_delta integer DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'solo admin'; END IF;    -- authz gate, same as crear_producto

  IF p_producto ? 'stock' THEN
    RAISE EXCEPTION 'stock no se edita en p_producto: use p_stock_delta';   -- hard reject, never silent
  END IF;

  UPDATE public.productos SET
    nombre        = CASE WHEN p_producto ? 'nombre'        THEN p_producto->>'nombre'             ELSE nombre        END,
    sku           = CASE WHEN p_producto ? 'sku'           THEN p_producto->>'sku'                ELSE sku           END,
    tipo          = CASE WHEN p_producto ? 'tipo'          THEN p_producto->>'tipo'                ELSE tipo          END,
    marca         = CASE WHEN p_producto ? 'marca'         THEN p_producto->>'marca'               ELSE marca         END,
    grosor        = CASE WHEN p_producto ? 'grosor'        THEN p_producto->>'grosor'              ELSE grosor        END,
    peso_metraje  = CASE WHEN p_producto ? 'peso_metraje'  THEN p_producto->>'peso_metraje'        ELSE peso_metraje  END,
    color_nombre  = CASE WHEN p_producto ? 'color_nombre'  THEN p_producto->>'color_nombre'        ELSE color_nombre  END,
    color_hex     = CASE WHEN p_producto ? 'color_hex'     THEN p_producto->>'color_hex'           ELSE color_hex     END,
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

-- ============================================================
-- EXECUTE hygiene — all 4 RPCs: REVOKE FROM PUBLIC then GRANT TO
-- authenticated only. anon stays excluded (OQ-3: selling is shared between
-- admin and future employee roles, but never anonymous).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deshacer_venta(uuid)                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.actualizar_producto(uuid, jsonb, integer, uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text)                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.deshacer_venta(uuid)                                  TO authenticated;  -- OQ-3
GRANT  EXECUTE ON FUNCTION public.crear_producto(jsonb, integer, uuid)                  TO authenticated;  -- is_admin() gates inside
GRANT  EXECUTE ON FUNCTION public.actualizar_producto(uuid, jsonb, integer, uuid, integer) TO authenticated;  -- is_admin() gates inside
