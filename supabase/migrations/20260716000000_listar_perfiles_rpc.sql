-- Migration: 20260716000000_listar_perfiles_rpc
-- Change: auth-pin (Phase 6, T-6.1)
-- Satisfies: design.md §7 (DD-11) roster read for the employee-management
-- screen; resolves tasks.md Gap 9's own forward-flag ("Phase 6's GET roster
-- join literally needs `profiles` data too, and will hit this SAME grant
-- gap if implemented as a direct service-role `.from('profiles')` read —
-- Phase 6 either needs its own grant migration or a similar SECURITY
-- DEFINER RPC route").
--
-- Confirmed identically to Gap 9: `service_role` has ZERO grants on
-- `public.profiles` on this project (`auto_expose_new_tables` OFF, the
-- current Supabase cloud default — verified empirically via `\dp
-- public.profiles` on a disposable local stack: `service_role=Dxtm/postgres`,
-- no SELECT). `enroll-empleado`'s GET (roster) handler needs `rol`/`activo`
-- for every staff member (design.md §4's "GET | list | ... admin.listUsers()
-- ∩ profiles"), and a literal service-role `.from('profiles').select(...)`
-- would 42501 on every call, exactly like Gap 9's direct-role-read attempt
-- did for the POST handler's admin check.
--
-- Resolution chosen, consistent with Gap 9's own precedent AND with DD-11's
-- explicit design decision ("no `profiles` read-policy widening, no `nombre`
-- column" — rejecting "broad `profiles_select_admin` policy"): a
-- SECURITY DEFINER RPC, `is_admin()`-gated INSIDE its own body (not only by
-- the Edge Function's own auth chain), so a non-admin `authenticated` caller
-- who invokes this RPC directly (bypassing the Edge Function entirely — it
-- is EXECUTE-granted to `authenticated`, callable straight from the browser
-- console) gets nothing, not a privilege escalation. Widening a `profiles`
-- SELECT policy was explicitly rejected by DD-11 — this migration does NOT
-- do that; `profiles_select_own` (data-model) is untouched.
--
-- Degrade-to-empty-set convention (matches this codebase's own established
-- read-denial idiom — `producto_costos_select_admin`,
-- `movimientos_select_admin`: a non-admin gets `[]`, never an exception) is
-- used here too: the `WHERE (select public.is_admin())` predicate is
-- constant across every row, so a non-admin caller's result set is simply
-- empty. `anon` gets a harder denial (42501 permission-denied-for-function)
-- because EXECUTE is never granted to `anon` at all — same posture as
-- `is_admin()`/`is_active()` above it.
--
-- Down migration: DROP FUNCTION public.listar_perfiles();
CREATE OR REPLACE FUNCTION public.listar_perfiles()
  RETURNS TABLE (id uuid, rol text, activo boolean)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT p.id, p.rol, p.activo
  FROM public.profiles p
  WHERE (select public.is_admin());
$$;
REVOKE EXECUTE ON FUNCTION public.listar_perfiles() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.listar_perfiles() TO authenticated;
