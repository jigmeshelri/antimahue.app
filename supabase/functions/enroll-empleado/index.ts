// Setup type definitions for built-in Supabase Runtime APIs (editor/type support only —
// this file runs under Deno, outside the Node/tsc toolchain in tsconfig.app.json).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * enroll-empleado — DD-6, REQ-AP-SEG-3/REQ-AP-SEG-4 (Phase 5, T-5.1/T-5.2;
 * Phase 6, T-6.1; Phase 7, T-7.1).
 *
 * Admin-gated Deno Edge Function running with service_role. Phase 5
 * implemented the `POST` (enroll) action; Phase 6 added `GET` (roster list,
 * T-6.1); Phase 7 adds `PATCH` (revoke/restore, T-7.1) below — the shared
 * auth chain (steps 1-3) already covers all three per design.md §4's
 * literal ordering.
 *
 * GET (roster) — design.md §4's literal mechanism ("With SERVICE_ROLE, ...
 * FROM profiles") hits the IDENTICAL grant wall as Gap 9 (see that gap's
 * writeup in tasks.md and this repo's `20260716000000_listar_perfiles_rpc.sql`
 * migration): `service_role` has zero SELECT grant on `public.profiles`.
 * `handleRoster` below therefore reads `rol`/`activo` via the SAME
 * `is_admin()`-precedent — a new SECURITY DEFINER RPC, `listar_perfiles()`,
 * invoked via `callerClient` (the caller's own JWT, already proven `is_admin()`
 * by the shared auth chain) — while `email`/`displayName`/`banned` come from
 * `admin.listUsers()`, a GoTrue Admin API call (not a PostgREST table read),
 * which needs no table grant at all.
 *
 * PATCH (revoke/restore, REQ-AP-SEG-4) — the SAME `profiles` grant wall
 * applies to the `activo` flip, so `handlePatch` below routes it through
 * ANOTHER SECURITY DEFINER RPC, `actualizar_activo_perfil()` (see
 * `20260717000000_actualizar_activo_perfil_rpc.sql`), invoked via
 * `callerClient`. The ban/unban call (`auth.admin.updateUserById`) is a
 * GoTrue Admin API call, not a PostgREST table read, so it still goes
 * through `adminClient` (service_role) exactly as design.md §4 specifies —
 * only the `profiles.activo` write needed the RPC detour.
 *
 * SELF-REVOKE GUARD (new — not specified by design.md/spec.md; see the
 * migration's own header for the full reasoning): `handlePatch` rejects a
 * PATCH where `userId` equals the caller's own id, BEFORE calling either the
 * RPC or the ban API, so a self-targeting request has zero side effects.
 * The RPC independently re-asserts the same guard (defense-in-depth against
 * a direct RPC call bypassing this function entirely, identical bypass
 * surface already defended for `listar_perfiles()`).
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
  // NOTE (found while adding PATCH here, Phase 7): this list was never
  // updated past 'POST, OPTIONS' when Phase 6 added GET — a real browser
  // preflight would have rejected the GET roster call outright (curl-based
  // local-stack verification, used through Phase 5/6, doesn't enforce CORS,
  // so this was never caught). Fixed here, alongside PATCH's own addition.
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

// PATCH (revoke/restore) request body — design.md §4's literal contract.
interface PatchBody {
  userId: string
  activo: boolean
}

// GET (roster) response row shape — design.md §4's literal contract:
// `[{id,email,displayName,rol,activo,banned}]`.
interface RosterEntry {
  id: string
  email: string | null
  displayName: string
  rol: string
  activo: boolean
  banned: boolean
}

// Shape of one `listar_perfiles()` RPC row (see the Phase 6 migration).
interface Perfil {
  id: string
  rol: string
  activo: boolean
}

// GoTrue marks a banned user with a far-future `banned_until` timestamp
// (Phase 7's `ban_duration:'876000h'`, ~100 years) and clears it back to
// `'none'` on restore — so "still in the future" is the correct ban check,
// not merely "field present".
function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil).getTime() > Date.now()
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

function isPatchBody(value: unknown): value is PatchBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.userId === 'string' && v.userId.length > 0 && typeof v.activo === 'boolean'
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

// GET (roster) — design.md §4 / T-6.1. `admin.listUsers()` (GoTrue Admin API,
// service_role, no table grant needed) supplies email/displayName/banned;
// `listar_perfiles()` (the caller's own JWT, via `callerClient` — see the
// file-header note) supplies rol/activo. Joined by `id`. A staff member
// missing from either side (should not happen — `handle_new_user()` always
// inserts a `profiles` row on `auth.users` insert) is dropped rather than
// surfaced with a half-populated row.
async function handleRoster(
  adminClient: ReturnType<typeof createClient>,
  callerClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) {
    return json(500, { error: 'internal_error' })
  }

  const { data: perfiles, error: perfilesError } = await callerClient.rpc('listar_perfiles')
  if (perfilesError) {
    return json(500, { error: 'internal_error' })
  }

  const perfilesById = new Map<string, Perfil>(
    ((perfiles ?? []) as Perfil[]).map((perfil) => [perfil.id, perfil])
  )

  const roster: RosterEntry[] = []
  for (const user of listData.users) {
    const perfil = perfilesById.get(user.id)
    if (!perfil) continue
    roster.push({
      id: user.id,
      email: user.email ?? null,
      displayName: (user.user_metadata?.display_name as string | undefined) ?? '',
      rol: perfil.rol,
      activo: perfil.activo,
      banned: isBanned(user.banned_until),
    })
  }

  return json(200, roster)
}

// PATCH (revoke/restore) — design.md §4 / T-7.1 (REQ-AP-SEG-4). Flips
// `profiles.activo` via `actualizar_activo_perfil()` (the caller's own JWT,
// via `callerClient` — see the file-header note and that migration's own
// header for why this replaces a direct service-role `profiles` write), then
// durably blocks/unblocks future token refreshes via the GoTrue Admin API
// (`adminClient`, service_role — no table grant involved). The `activo`
// write MUST NOT depend on the ban/unban call succeeding (design.md §4) —
// a `banError` is logged, not treated as a request failure.
//
// Rejection paths (self-target, not-found) leave zero side effects: both are
// checked/detected BEFORE the ban call or the audit_log insert ever runs.
async function handlePatch(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  callerClient: ReturnType<typeof createClient>,
  actorId: string
): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  if (!isPatchBody(body)) {
    return json(422, { error: 'invalid_input' })
  }

  const { userId, activo } = body

  // SELF-REVOKE GUARD — see this file's header note and the migration's own
  // header for the full reasoning. Checked first, before any write.
  if (userId === actorId) {
    return json(400, { error: 'cannot_self_target' })
  }

  const { data: updated, error: rpcError } = await callerClient.rpc('actualizar_activo_perfil', {
    p_perfil_id: userId,
    p_activo: activo,
  })

  if (rpcError) {
    return json(500, { error: 'internal_error' })
  }
  if (updated !== true) {
    return json(404, { error: 'user_not_found' })
  }

  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: activo ? 'none' : '876000h',
  })
  if (banError) {
    // Disclosed asymmetry with `handleEnroll`'s compensation logic: the
    // `activo` flip above already denies the target's NEXT request
    // immediately (REQ-AP-SEG-2) regardless of this call's outcome — design.md
    // §4 is explicit that the DB write must not depend on the ban call
    // succeeding, so this is logged, not compensated/rolled back.
    console.error(
      'enroll-empleado: ban/unban call failed, activo flip already committed',
      banError
    )
  }

  const { error: auditError } = await adminClient.from('audit_log').insert({
    actor_id: actorId,
    action: activo ? 'restore_empleado' : 'revoke_empleado',
    entity: 'auth.users',
    entity_id: userId,
  })
  if (auditError) {
    console.error('enroll-empleado: audit_log insert failed for PATCH', auditError)
    return json(500, { error: 'internal_error' })
  }

  return json(200, { id: userId, activo })
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
    case 'GET':
      return await handleRoster(adminClient, callerClient)
    case 'PATCH':
      return await handlePatch(req, adminClient, callerClient, caller.id)
    default:
      return json(405, { error: 'method_not_allowed' })
  }
})
