-- Migration: 20260717000000_actualizar_activo_perfil_rpc
-- Change: auth-pin (Phase 7, T-7.1)
-- Satisfies: REQ-AP-SEG-4 (revocation action, D5)
--
-- Same Gap 9 grant wall as Phase 6's `listar_perfiles()` (see that
-- migration's own header): `service_role` has ZERO grants on
-- `public.profiles` on this project (`auto_expose_new_tables` OFF, the
-- current Supabase cloud default). design.md §4's literal PATCH mechanism
-- ("UPDATE profiles SET activo=<>") issued via
-- `adminClient.from('profiles').update(...)` would 42501 on every call,
-- identically to Gap 9 (POST/admin check) and Gap 9's own Phase 6
-- forward-flag (GET roster). Resolution, consistent with both precedents:
-- another SECURITY DEFINER RPC, `is_admin()`-gated INSIDE its own body (not
-- only by the Edge Function's own auth chain — same direct-bypass defense
-- as `listar_perfiles()`), invoked via `callerClient` (the caller's own
-- JWT), never `service_role`. Unlike `listar_perfiles()` (a read that
-- degrades to an empty set for a non-admin caller), this is a WRITE — it
-- follows this codebase's own established idiom for admin-gated writes
-- (`crear_producto`/`actualizar_producto`, `20260705000300_domain_rpc.sql`):
-- `RAISE EXCEPTION` on a failed authz gate, not a silent no-op.
--
-- SELF-REVOKE GUARD — NEW, not specified by design.md §4/§8 or
-- specs/seguridad/spec.md's REQ-AP-SEG-4. Added here as an explicit,
-- disclosed deviation (per this apply's own brief), not silently folded in:
-- neither the design nor the spec addresses what happens when an admin
-- targets their OWN `userId`. This project has exactly one admin account
-- (Angélica) provisioned to date, and no other change in this repo designs
-- a recovery path for a locked-out sole admin (no support console, no
-- secondary admin, no "restore via SQL" runbook) — a successful self-revoke
-- would durably lock the store out of its only administrative account the
-- instant the ban call lands. Guarded HERE (RAISE EXCEPTION) rather than
-- only in the Edge Function, because this RPC is EXECUTE-granted to
-- `authenticated` and therefore directly callable, bypassing the Edge
-- Function entirely — identical bypass surface already flagged and
-- defended for `listar_perfiles()`, `is_admin()`, `is_active()`. The Edge
-- Function (`handlePatch`) ALSO checks this before calling either this RPC
-- or `auth.admin.updateUserById`, so a self-targeting PATCH via the normal
-- HTTP path has zero side effects (no partial ban-without-flip or
-- flip-without-ban) rather than surfacing this RPC's raw exception text.
--
-- Returns `true` if a row was found and updated, `false` if `p_perfil_id`
-- doesn't exist — the Edge Function maps `false` to its own 404 response
-- (design.md §4's PATCH error contract, "404 unknown user").
--
-- Down migration: DROP FUNCTION public.actualizar_activo_perfil(uuid, boolean);
CREATE OR REPLACE FUNCTION public.actualizar_activo_perfil(p_perfil_id uuid, p_activo boolean)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_row_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'solo admin';
  END IF;

  IF p_perfil_id = (select auth.uid()) THEN
    RAISE EXCEPTION 'no puede modificar el estado de su propia cuenta';
  END IF;

  UPDATE public.profiles SET activo = p_activo WHERE id = p_perfil_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.actualizar_activo_perfil(uuid, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.actualizar_activo_perfil(uuid, boolean) TO authenticated;  -- is_admin() gates inside
