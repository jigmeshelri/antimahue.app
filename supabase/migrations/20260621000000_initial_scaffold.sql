-- Migration: 20260621000000_initial_scaffold
-- Change: setup-stack
-- Satisfies: REQ-SETUP-6, REQ-SETUP-7, REQ-SETUP-8, D4, D5, T2, T5, T7
--
-- Security Scaffold — deny-by-default on every public table.
-- Business tables (productos, ventas, etc.) and per-table RLS policies
-- are deferred to the `data-model` change.

-- ============================================================
-- 1. profiles
-- Mirrors auth.users with a minimal MVP role column.
-- REQ-SETUP-8: only 'admin' allowed on MVP (single-user: Angélica).
-- rol CHECK constraint enforced at DB level — not in JS.
-- ============================================================
CREATE TABLE public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        text        NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS deny-by-default: no permissive policy = no access (REQ-SETUP-7, T2).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Signup trigger
-- Creates a profile row automatically when a new auth.users row
-- is inserted (REQ-SETUP-8 scenario "profile row created on user signup").
--
-- SECURITY DEFINER + SET search_path = '' prevents search_path injection
-- (attacker cannot shadow pg_catalog or public symbols via a malicious
-- search_path). All identifiers are schema-qualified.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Revoke direct invocation by all API roles: handle_new_user is a trigger
-- function only — it must not be callable via PostgREST /rpc/handle_new_user.
-- Postgres grants EXECUTE to PUBLIC by default; revoke that grant.
-- Trigger execution is initiated by Postgres internally (as the function owner),
-- not via role grants — so revoking from PUBLIC does not break the trigger.
-- (Supabase advisor: anon_security_definer_function_executable / lint 0028/0029)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============================================================
-- 3. auth_attempts
-- Records PIN-unlock attempts per user for server-side throttling.
-- D5: "defense in depth" — cryptographic gate (AES-GCM) is the primary
-- control; this table backs server-mirrored lockout (T5).
-- ============================================================
CREATE TABLE public.auth_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success      boolean     NOT NULL
);

-- RLS deny-by-default (T5, T2).
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. audit_log
-- Scaffold for traceability of money/stock operations (T7).
-- Per-table triggers deferred to `data-model` change (OQ-2 RESOLVED).
-- ============================================================
CREATE TABLE public.audit_log (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action    text        NOT NULL,
  entity    text,
  entity_id text,
  detail    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS deny-by-default (T7, T2).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
