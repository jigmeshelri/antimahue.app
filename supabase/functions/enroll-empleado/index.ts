// Setup type definitions for built-in Supabase Runtime APIs (editor/type support only —
// this file runs under Deno, outside the Node/tsc toolchain in tsconfig.app.json).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * enroll-empleado — DD-6, REQ-AP-SEG-3 (Phase 5, T-5.1/T-5.2).
 *
 * Admin-gated Deno Edge Function running with service_role. Phase 5 implements
 * only the `POST` (enroll) action; `GET` (roster list, Phase 6, T-6.1) and
 * `PATCH` (revoke/restore, Phase 7, T-7.1) are dispatched from the SAME method
 * switch below and will be added to it in those later phases — the shared auth
 * chain (steps 1-3) already covers all three per design.md §4's literal ordering.
 *
 * Auth chain (MUST run, in order, for every method — design.md §4):
 *   1. CORS preflight (`OPTIONS`) — allow the SPA origin.
 *   2. Read the caller JWT from `Authorization: Bearer`. Missing/invalid → 401.
 *      (Defense in depth: the platform's own `verify_jwt` check — see
 *      `supabase/config.toml`'s `[functions.enroll-empleado]` — already rejects
 *      a request with no valid JWT before this code runs. This function performs
 *      its OWN check too, per design.md's literal ordering, and because an
 *      anon-key JWT (role: "anon") is itself a validly-signed token that passes
 *      the platform check yet resolves to no real `auth.users` row — that case
 *      is only caught here, by `getUser()` failing.)
 *   3. Require `rol = 'admin' AND activo`. Not admin / inactive → 403. The
 *      client-supplied JWT identity is NEVER trusted for role.
 *
 *      IMPLEMENTATION NOTE (deviation from design.md §4's literal "With
 *      SERVICE_ROLE, SELECT rol, activo FROM profiles WHERE id = <caller>"):
 *      this project's Data API has `auto_expose_new_tables` OFF (current
 *      Supabase cloud default — see `supabase/config.toml`'s comment on that
 *      key), so `service_role` has ZERO grants on `profiles` — verified
 *      empirically against a disposable local stack (`\dp public.profiles`
 *      shows `service_role=Dxtm/postgres`: no SELECT at all). A literal
 *      service-role `.from('profiles').select(...)` 42501s on EVERY call.
 *      Calling `public.is_admin()` instead — a SECURITY DEFINER RPC already
 *      `GRANT`ed to `authenticated` (`20260705000200_domain_rls.sql`) that
 *      already ANDs `activo` in (Phase 1, `20260714000000...sql` item 5) —
 *      satisfies the exact same "rol='admin' AND activo" predicate, invoked
 *      AS THE CALLER via their own JWT (not service_role), and needs no new
 *      grant at all: SECURITY DEFINER runs as the function owner regardless
 *      of the caller's own table privileges. This is MORE consistent with
 *      this codebase's own established pattern (DD-8: RLS/RPC is the sole
 *      authorization boundary) than the literal pseudocode, not a weaker
 *      substitute for it.
 *
 * Body shape for `POST` is exactly `{ email, password, displayName }` — there
 * is deliberately NO `rol` field in the request contract. `rol: 'empleado'` is
 * hardcoded server-side in the `admin.createUser()` call below, so a caller
 * cannot request any other role for the account it creates even in principle
 * (whitelist-by-construction, not by runtime validation of a client-supplied
 * value).
 *
 * Rejection MUST leave zero side effects (REQ-AP-SEG-3): the auth chain (steps
 * 2-3) runs and can return 401/403 BEFORE any write is attempted, and body
 * validation happens before `admin.createUser()` is called.
 *
 * Hardening beyond design.md's literal text (disclosed, not silent): if
 * `admin.createUser()` succeeds but the mandatory `audit_log` insert fails,
 * this function compensates with `admin.deleteUser()` and returns 500 rather
 * than leaving an enrolled account with no audit trail — REQ-AP-SEG-3 phrases
 * the audit insert as a MUST for the success path, so a partial failure here
 * is treated as a full failure, not a best-effort side note.
 */

import { createClient, type AuthError } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Wildcard origin is safe here: this endpoint is authorized by an explicit
// Bearer JWT the client code attaches deliberately (via supabase-js), never
// by an ambient credential (cookie) a browser would attach automatically
// cross-origin — so there is no CSRF-style exposure from allowing any origin.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface EnrollBody {
  email: string
  password: string
  displayName: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Shape-level validation (bad email / weak password → 422 fast, before any
// network call). `admin.createUser()` below is still the source of truth for
// anything this shape check doesn't catch (e.g. project-level password
// requirements configured in `supabase/config.toml`'s `[auth]` section).
function isEnrollBody(value: unknown): value is EnrollBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.email === 'string' &&
    EMAIL_RE.test(v.email) &&
    typeof v.password === 'string' &&
    v.password.length >= 6 &&
    typeof v.displayName === 'string' &&
    v.displayName.trim().length > 0
  )
}

// Maps a `createUser` AuthError to the design.md-specified error surface:
// 409 duplicate email, 422 weak password / bad email, else pass through the
// error's own status (or 500). Branches on `error.code` first (stable across
// GoTrue versions) and falls back to `error.status` for anything else.
function mapCreateUserError(error: AuthError | null): Response {
  if (!error) return json(500, { error: 'internal_error' })

  const code = 'code' in error ? error.code : undefined
  const status = 'status' in error ? error.status : undefined

  if (code === 'email_exists' || code === 'user_already_exists') {
    return json(409, { error: 'email_exists' })
  }
  if (status === 422 || code === 'weak_password' || code === 'validation_failed') {
    return json(422, { error: error.message })
  }
  return json(status ?? 500, { error: error.message })
}

async function handleEnroll(
  req: Request,
  // eslint/tsc do not see this file (excluded from both — Deno-only code);
  // `ReturnType<typeof createClient>` keeps this internal without a direct
  // supabase-js type import beyond what's already imported above.
  adminClient: ReturnType<typeof createClient>,
  actorId: string
): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  if (!isEnrollBody(body)) {
    return json(422, { error: 'invalid_input' })
  }

  const { email, password, displayName } = body

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol: 'empleado' },
    user_metadata: { display_name: displayName },
  })

  if (createError || !created?.user) {
    return mapCreateUserError(createError)
  }

  const { error: auditError } = await adminClient.from('audit_log').insert({
    actor_id: actorId,
    action: 'enroll_empleado',
    entity: 'auth.users',
    entity_id: created.user.id,
  })

  if (auditError) {
    console.error('enroll-empleado: audit_log insert failed, compensating with deleteUser', auditError)
    await adminClient.auth.admin.deleteUser(created.user.id)
    return json(500, { error: 'internal_error' })
  }

  return json(200, {
    id: created.user.id,
    email: created.user.email,
    displayName,
    rol: 'empleado',
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ---- Auth chain (steps 2-3, design.md §4) — runs for every method ----
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'missing_authorization' })
  }
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const {
    data: { user: caller },
    error: userError,
  } = await anonClient.auth.getUser(token)

  if (userError || !caller) {
    return json(401, { error: 'invalid_token' })
  }

  // Caller-scoped client (the caller's own JWT, NOT service_role) — is_admin()
  // is SECURITY DEFINER and already folds in `activo` (Phase 1 migration item
  // 5), so this one RPC call is exactly "rol='admin' AND activo". See the
  // file-header IMPLEMENTATION NOTE for why this replaces a direct
  // service-role `profiles` read.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isAdmin, error: isAdminError } = await callerClient.rpc('is_admin')

  if (isAdminError || isAdmin !== true) {
    return json(403, { error: 'not_active_admin' })
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ---- Dispatch (design.md §4 table) ----
  switch (req.method) {
    case 'POST':
      return await handleEnroll(req, adminClient, caller.id)
    default:
      // GET (Phase 6, T-6.1) and PATCH (Phase 7, T-7.1) land here in later phases.
      return json(405, { error: 'method_not_allowed' })
  }
})
