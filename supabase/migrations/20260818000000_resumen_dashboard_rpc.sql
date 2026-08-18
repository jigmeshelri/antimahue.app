-- Migration: 20260818000000_resumen_dashboard_rpc
-- Change: dashboard
-- Satisfies: REQ-DASH-1, REQ-DASH-2, REQ-DASH-3, D1, D2, D3, D7
--
-- Read-only dashboard aggregation RPC. Returns today's confirmed sales,
-- inventory value (admin only), and low-stock alerts in a single call.
-- Authorization is server-side via public.is_admin(); employees never receive
-- cost data in the payload.

CREATE OR REPLACE FUNCTION public.resumen_dashboard()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_hoy date := timezone('America/Santiago', now())::date;
  v_es_admin boolean := (select public.is_admin());
  v_ventas_hoy jsonb;
  v_valor_inv jsonb := 'null'::jsonb;
  v_alertas jsonb;
BEGIN
  -- Today's confirmed sales: total, count, and breakdown by payment method.
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(total), 0),
    'cantidad', COUNT(*),
    'por_medio_pago', COALESCE(jsonb_object_agg(medio_pago, subtotal), '{}'::jsonb)
  )
  INTO v_ventas_hoy
  FROM (
    SELECT medio_pago, SUM(total) AS subtotal
    FROM public.ventas
    WHERE estado = 'confirmada'
      AND timezone('America/Santiago', created_at)::date = v_hoy
    GROUP BY medio_pago
  ) t;

  -- Inventory value at cost and at sale price (admin only).
  IF v_es_admin THEN
    SELECT jsonb_build_object(
      'a_costo', COALESCE(SUM(p.stock * pc.costo), 0),
      'a_venta', COALESCE(SUM(p.stock * p.precio_venta), 0)
    )
    INTO v_valor_inv
    FROM public.productos p
    LEFT JOIN public.producto_costos pc ON pc.producto_id = p.id;
  END IF;

  -- Low-stock alerts: stock <= effective minimum, ordered by stock asc.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'nombre', nombre,
      'stock', stock,
      'stock_minimo', stock_minimo_efectivo
    ) ORDER BY stock ASC, nombre ASC), '[]'::jsonb)
  INTO v_alertas
  FROM (
    SELECT p.id, p.nombre, p.stock,
      COALESCE(p.stock_minimo, c.stock_minimo_default) AS stock_minimo_efectivo
    FROM public.productos p, public.configuracion c
    WHERE p.stock <= COALESCE(p.stock_minimo, c.stock_minimo_default)
    ORDER BY p.stock ASC, p.nombre ASC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'ventas_hoy', v_ventas_hoy,
    'valor_inventario', v_valor_inv,
    'alertas_stock', v_alertas
  );
END; $$;

-- Least-privilege EXECUTE hygiene: authenticated only, anon excluded.
REVOKE EXECUTE ON FUNCTION public.resumen_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resumen_dashboard() TO authenticated;
