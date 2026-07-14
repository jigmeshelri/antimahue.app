-- Migration: 20260714000000_auth_pin_multirole
-- Change: auth-pin
-- Satisfies: REQ-AP-SEG-1, REQ-AP-SEG-2, REQ-SETUP-8 (modified), DD-4, DD-5
--
-- Additive, reversible migration — activates the second role ('empleado')
-- that setup-stack's single-admin scaffold and data-model's day-one-inert
-- admin-only RLS were built for but never turned on. Widens the `rol`
-- CHECK, adds the `activo` revocation gate, hardens the signup trigger, and
-- folds `activo` into every authorization path (is_admin(), the domain
-- write RPCs, and the 4 previously-USING(true) SELECT policies).
--
-- Every object touched below was verified against the LIVE project
-- (aruteznqhdaaxxvllvzm) via read-only queries before writing this file —
-- constraint name, policy names/definitions and function bodies all match
-- exactly what ships today (20260705000300 is the last applied migration).
--
-- Rollback: see the ROLLBACK NOTES block at the end of this file.

-- ============================================================
-- 1. Widen profiles.rol CHECK — REQ-SETUP-8 (modified)
-- Auto-named constraint from the setup-stack scaffold's inline CHECK.
-- Verified live: conname `profiles_rol_check`, def `CHECK ((rol = 'admin'::text))`.
-- Trivial to validate synchronously: `profiles` holds a single row today.
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT profiles_rol_check;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_rol_check CHECK (rol IN ('admin', 'empleado'));

-- ============================================================
-- 2. activo — revocation-gate column (REQ-AP-SEG-1)
-- Additive, NOT NULL DEFAULT true: the existing row (Angélica's admin
-- profile) resolves to true with zero backfill required.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN activo boolean NOT NULL DEFAULT true;

-- ============================================================
-- 3. Harden the signup trigger — REQ-SETUP-8 (modified), DD-4
-- Role now comes from `raw_app_meta_data->>'rol'`, settable only by a
-- service_role caller (enroll-empleado, DD-4/DD-6) — the anon/authenticated
-- client can never influence app_metadata via signUp()'s user_metadata.
--
-- FLAGGED, NOT SILENTLY RESOLVED (see this apply's return report to the
-- orchestrator for the full writeup): the fallback below is 'empleado',
-- not 'admin'. This matches design.md §3 item 3 verbatim, as T-1.1
-- mandates, and is a DELIBERATE least-privilege hardening — this project's
-- public self-signup has been reachable with the anon key since
-- setup-stack (Supabase's `auth.enable_signup` default is on, and nothing
-- in this repo's history disables it), and until this migration
-- `handle_new_user()` carried NO explicit rol value, relying purely on the
-- column DEFAULT 'admin'. That means, right now, in production, ANY
-- anonymous caller invoking `supabase.auth.signUp()` is provisioned as a
-- full admin. Widening the CHECK to allow a real lower-privilege role
-- without also flipping this fallback would leave that hole open one
-- migration longer. This SQL therefore CONTRADICTS the literal text of
-- this same change's specs/setup-stack/spec.md REQ-SETUP-8 scenario
-- ("self-signup still defaults to admin, never empleado") — that scenario
-- was written against the pre-hardening mental model and was not updated
-- when design.md introduced this fix a phase later. Recommend correcting
-- the spec scenario text rather than reverting this default.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_app_meta_data->>'rol', 'empleado'));
  RETURN NEW;
END;
$$;
-- EXECUTE hygiene (REVOKE FROM PUBLIC, anon, authenticated — set by the
-- setup-stack scaffold) is preserved across CREATE OR REPLACE; no ACL
-- changes needed here.

-- ============================================================
-- 4. is_active() — REQ-AP-SEG-2
-- Mirrors is_admin()'s SECURITY DEFINER hygiene (bypasses profiles' own
-- RLS to read the caller's own row; no recursion — profiles_select_own's
-- policy is `id = (select auth.uid())`, which never calls is_active()).
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_active()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND activo);
$$;
REVOKE EXECUTE ON FUNCTION public.is_active() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_active() TO authenticated;

-- ============================================================
-- 5. Fold activo into is_admin() — REQ-AP-SEG-2
-- A revoked admin loses admin-only access on the very next request. ACL
-- (REVOKE FROM PUBLIC / GRANT TO authenticated, set by data-model) is
-- preserved across CREATE OR REPLACE.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND rol = 'admin' AND activo
  );
$$;

-- ============================================================
-- 6. Gate the write RPCs on is_active() — REQ-AP-SEG-2
--
-- confirmar_venta / deshacer_venta currently gate on `auth.uid() IS NOT
-- NULL` only (selling is shared across roles, DD2/OQ-3 from data-model) —
-- these need an EXPLICIT is_active() check, added right after the
-- existing auth check, per design.md §3 item 6.
--
-- crear_producto / actualizar_producto gate on `public.is_admin()`, which
-- item 5 above already redefines to require `activo`. Both call
-- `public.is_admin()` by name (not an inlined copy), and is_admin() is
-- replaced via CREATE OR REPLACE with the SAME signature — so both RPCs
-- pick up the activo fold transitively. No CREATE OR REPLACE needed for
-- either function body; they are intentionally left untouched below.
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
  IF NOT public.is_active() THEN RAISE EXCEPTION 'usuario inactivo'; END IF;
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
      VALUES (v_pid, 'venta', -v_qty, v_venta, v_actor);              -- column + ledger, one txn
    v_total := v_total + v_precio * v_qty;
  END LOOP;

  UPDATE public.ventas SET total = v_total WHERE id = v_venta;
  RETURN v_venta;
END; $$;

CREATE OR REPLACE FUNCTION public.deshacer_venta(p_venta_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid(); v_estado text; v_last uuid; v_it record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  IF NOT public.is_active() THEN RAISE EXCEPTION 'usuario inactivo'; END IF;

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
-- EXECUTE hygiene (REVOKE FROM PUBLIC / GRANT TO authenticated, set by
-- data-model) is preserved across CREATE OR REPLACE — no ACL changes needed.

-- ============================================================
-- 7. Re-gate the 4 previously-USING(true) SELECT policies — REQ-AP-SEG-2
-- productos/ventas/venta_items/configuracion were readable by ANY
-- authenticated user with no activo check (harmless while 'empleado' was
-- unreachable — day-one-inert). Now that a second role exists, a revoked
-- profile must lose read access on the very next request too. Names and
-- `USING (true)` bodies verified live against pg_policies before writing
-- this file.
-- ============================================================
DROP POLICY productos_select     ON public.productos;
CREATE POLICY productos_select     ON public.productos     FOR SELECT TO authenticated USING ((select public.is_active()));

DROP POLICY ventas_select        ON public.ventas;
CREATE POLICY ventas_select        ON public.ventas        FOR SELECT TO authenticated USING ((select public.is_active()));

DROP POLICY venta_items_select   ON public.venta_items;
CREATE POLICY venta_items_select   ON public.venta_items   FOR SELECT TO authenticated USING ((select public.is_active()));

DROP POLICY configuracion_select ON public.configuracion;
CREATE POLICY configuracion_select ON public.configuracion FOR SELECT TO authenticated USING ((select public.is_active()));

-- ============================================================
-- ROLLBACK NOTES (design.md §3 "Down migration" — NOT executed by this
-- file; recorded here for a future down-migration, IN ORDER):
--   1. Precondition: zero rows with rol = 'empleado' (narrowing the CHECK
--      back to admin-only fails otherwise).
--   2. ALTER TABLE public.profiles DROP CONSTRAINT profiles_rol_check;
--      ALTER TABLE public.profiles ADD  CONSTRAINT profiles_rol_check
--        CHECK (rol = 'admin');
--   3. ALTER TABLE public.profiles DROP COLUMN activo;
--   4. Restore handle_new_user() to `INSERT INTO public.profiles (id)
--      VALUES (NEW.id);` (unconditional column DEFAULT 'admin').
--   5. Restore productos_select / ventas_select / venta_items_select /
--      configuracion_select to `USING (true)`.
--   6. Restore is_admin() to the pre-migration body (drop the `AND
--      activo` clause); DROP FUNCTION public.is_active().
--   7. Restore confirmar_venta / deshacer_venta to their pre-migration
--      bodies (drop the is_active() check). crear_producto /
--      actualizar_producto need no change in either direction — their
--      own function bodies were never touched by this migration.
-- ============================================================
