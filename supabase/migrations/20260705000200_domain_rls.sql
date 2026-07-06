-- Migration: 20260705000200_domain_rls
-- Change: data-model
-- Satisfies: REQ-DM-SEG-1, REQ-DM-SEG-2, REQ-DM-SEG-3, REQ-DM-SEG-4, DD2, DD3, DD5,
--            REQ-SETUP-7, V-7 (closes the setup-stack scaffold's deferred GRANTs)
--
-- Helper function, updated_at trigger, RLS policies and least-privilege GRANTs
-- for every domain table created in 20260705000100_domain_tables.sql.
-- Depends on that migration (tables must exist first).
--
-- `anon` receives ZERO GRANTs on every table in this file — the app requires
-- an authenticated session (PIN auth over Supabase Auth, per setup-stack).
-- All policies are `TO authenticated` and use `(select auth.uid())` (init-plan
-- optimization). Every write policy carries BOTH `USING` and `WITH CHECK` (D7).

-- ============================================================
-- is_admin() — SECURITY DEFINER so it can read public.profiles bypassing
-- profiles' own RLS (no recursion: profiles' policy is
-- `id = (select auth.uid())`, which never calls is_admin()). Lives in
-- `public` because RLS policies reference `public.is_admin()` directly.
-- A DEFINER function in `public` is callable by PUBLIC by default, so
-- EXECUTE hygiene is mandatory: REVOKE FROM PUBLIC then GRANT TO
-- authenticated only (anon excluded). REQ-DM-SEG-1 / DD3.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND rol = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- touch_updated_at() — single BEFORE UPDATE trigger function attached to
-- every domain table taking direct admin writes (productos, producto_costos,
-- proveedores, configuracion) so `updated_at` stays honest without app
-- discipline. Trigger-only: EXECUTE revoked from every API role (same
-- posture as the scaffold's handle_new_user). DD5.
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER touch_updated_at_productos
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER touch_updated_at_producto_costos
  BEFORE UPDATE ON public.producto_costos
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER touch_updated_at_proveedores
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER touch_updated_at_configuracion
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ============================================================
-- productos: catalog readable by everyone authenticated; writes RPC-only
-- (no write GRANT — see crear_producto/actualizar_producto). REQ-DM-SEG-2.
-- ============================================================
GRANT SELECT ON public.productos TO authenticated;
CREATE POLICY productos_select ON public.productos FOR SELECT TO authenticated USING (true);

-- ============================================================
-- producto_costos + proveedores: admin-only. GRANT SELECT is present so a
-- non-admin PostgREST embed (productos?select=*,producto_costos(costo))
-- degrades to `[]` (RLS filters rows), NEVER a 403. REQ-DM-SEG-3 / D2.
-- ============================================================
GRANT SELECT ON public.producto_costos TO authenticated;
CREATE POLICY producto_costos_select_admin ON public.producto_costos
  FOR SELECT TO authenticated USING ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
CREATE POLICY proveedores_all_admin ON public.proveedores
  FOR ALL TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- ============================================================
-- ventas / venta_items: readable (day totals, ticket render); writes
-- RPC-only (confirmar_venta / deshacer_venta). REQ-DM-SEG-2.
-- ============================================================
GRANT SELECT ON public.ventas      TO authenticated;
GRANT SELECT ON public.venta_items TO authenticated;
CREATE POLICY ventas_select      ON public.ventas      FOR SELECT TO authenticated USING (true);
CREATE POLICY venta_items_select ON public.venta_items FOR SELECT TO authenticated USING (true);

-- ============================================================
-- movimientos_stock: audit ledger, admin-only read; writes RPC-only.
-- REQ-DM-SEG-2.
-- ============================================================
GRANT SELECT ON public.movimientos_stock TO authenticated;
CREATE POLICY movimientos_select_admin ON public.movimientos_stock
  FOR SELECT TO authenticated USING ((select public.is_admin()));

-- ============================================================
-- configuracion: all read (COALESCE default + nombre_tienda for ticket);
-- admin UPDATE only (singleton, no INSERT/DELETE policy). REQ-DM-SEG-2/4.
-- ============================================================
GRANT SELECT, UPDATE ON public.configuracion TO authenticated;
CREATE POLICY configuracion_select ON public.configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY configuracion_update_admin ON public.configuracion
  FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- ============================================================
-- profiles: read own row (client learns its rol to shape UI). No client
-- write path. Closes setup-stack's deferred REQ-SETUP-7 / V-7: GET
-- /profiles as authenticated now returns 200 instead of the scaffold
-- baseline 401 (no policy existed before this migration).
-- ============================================================
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (id = (select auth.uid()));
GRANT SELECT ON public.profiles TO authenticated;

-- ============================================================
-- W1 hardening — strip residual default-privilege grants.
-- Supabase projects ship `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT
-- ALL ON TABLES TO anon, authenticated`, so every CREATE TABLE in the
-- previous migration may have auto-granted INSERT/UPDATE/DELETE (and more)
-- that the GRANTs above do NOT remove — GRANTs are additive. The design's
-- second lock ("no client write GRANT on any sale/stock table"; "anon
-- receives zero GRANTs on every table") must be materialized with explicit
-- REVOKEs. Ordering matters: these run AFTER the GRANTs above, so what
-- remains is exactly the least-privilege matrix from the design. The
-- proveedores/configuracion write exceptions for `authenticated` granted
-- above stay intact (design-authorized, RLS-gated to admin).
-- ============================================================
-- RPC-only tables: no client write path, for neither API role (W1).
REVOKE INSERT, UPDATE, DELETE ON public.productos, public.producto_costos,
  public.ventas, public.venta_items, public.movimientos_stock
  FROM anon, authenticated;
-- anon: zero grants on every domain table (design GRANT matrix). REVOKE ALL
-- also clears default-privilege SELECT/TRUNCATE/REFERENCES/TRIGGER leftovers.
REVOKE ALL ON public.productos, public.producto_costos, public.ventas,
  public.venta_items, public.movimientos_stock FROM anon;
REVOKE ALL ON public.proveedores, public.configuracion FROM anon;
