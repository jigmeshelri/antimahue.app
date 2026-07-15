/**
 * REQ-AP-SEG-5 — multi-role RLS/RPC verification matrix (auth-pin, T-9.3).
 *
 * REAL execution against a DISPOSABLE LOCAL Supabase stack (`supabase start`)
 * — never prod. This closes data-model's own deferred T-5.1..T-5.5 battery
 * plus the two rows auth-pin added (anon, revoked empleado), scaffolded as
 * `it.skip` since Phase 1 (tasks.md Gap 1) because no real 'empleado' row
 * existed until Phase 5 (enrollment) and Phase 7 (revocation) shipped.
 * They exist now — this file un-skips the battery for real.
 *
 * GATING: the whole suite is `describe.skipIf`-gated behind
 * `RUN_LOCAL_RLS_BATTERY=1`. This is NOT a permanently-skipped test —
 * running it requires a live local stack (`supabase start`), which CI does
 * not provision (see `.github/workflows/ci.yml`; T-0.4's gate list has no
 * Supabase service). Without the local stack AND the opt-in env var, the
 * suite reports SKIPPED, honestly, rather than failing on an absent
 * dependency or silently asserting nothing. To run for real:
 *
 *   supabase start
 *   RUN_LOCAL_RLS_BATTERY=1 pnpm test -- authPinRlsBattery
 *
 * ACTOR PROVISIONING (beforeAll) — real GoTrue-issued JWTs, no mocks:
 * three fresh `auth.users` rows are created via the service-role Admin API
 * (admin, empleado-activo, empleado-revocado), each signed in for real via
 * `signInWithPassword` to obtain a genuine session/JWT, exactly like a
 * paired device would. Two fixture gaps needed a direct superuser SQL
 * connection (`pg`, devDependency, test-only — never imported by app code)
 * rather than the service-role REST client:
 *
 *   1. Promoting the admin actor's `profiles.rol` to `'admin'` — Gap 11
 *      (tasks.md): `admin.createUser()` writes `app_metadata` via a SEPARATE
 *      post-INSERT UPDATE, so `handle_new_user()` (`AFTER INSERT` only)
 *      never observes the caller-requested `rol` at trigger time and always
 *      falls through to the least-priv `'empleado'` default. This is
 *      exactly the "deliberate manual/seed step" REQ-SETUP-8 itself
 *      mandates for first-admin bootstrap (mirrors how Angélica's real prod
 *      admin profile was provisioned).
 *   2. Flipping the revoked actor's `profiles.activo` to `false` — Gap 9/12
 *      (tasks.md): `service_role` has ZERO grants on `public.profiles`
 *      (`auto_expose_new_tables` off), so even a service-role REST client
 *      would 42501 on a direct table write. A superuser SQL connection sits
 *      below PostgREST entirely. Note this deliberately happens AFTER the
 *      actor already signed in — the still-valid JWT obtained beforehand is
 *      then reused unchanged for SEG-5.7, which is what proves REQ-AP-SEG-2's
 *      "denied on the very next request, independent of access-token expiry"
 *      property for real (identical methodology to Phase 7's own apply-time
 *      revocation verification).
 *
 * Two products are seeded through the REAL admin-gated `crear_producto` RPC
 * (not a raw INSERT) so the RPC's own authz gate is exercised as a side
 * effect of fixture setup, and two sales are confirmed via `confirmar_venta`
 * so SEG-5.3 has a genuine non-last sale to attempt `deshacer_venta` against.
 *
 * Task-ID mapping (tasks.md Phase 1, `SEG-5.n` is this repo's own
 * disambiguated numbering — the spec's own labels are in parentheses):
 *   T-1.5  → SEG-5.1 (spec T-5.1)
 *   T-1.6  → SEG-5.2 (spec T-5.2)
 *   T-1.7  → SEG-5.3 (spec T-5.3)
 *   T-1.8  → SEG-5.4 (spec T-5.4)
 *   T-1.9  → SEG-5.5 (spec T-5.5)
 *   T-1.10 → SEG-5.6 (spec "new" row — anon)
 *   T-1.11 → SEG-5.7 (spec "new" row — inactive empleado)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client as PgClient } from 'pg'
import type { Database } from './database.types'

const RUN = process.env.RUN_LOCAL_RLS_BATTERY === '1'

// Supabase CLI's fixed local-dev demo keys (documented publicly by
// Supabase; signed with the well-known local JWT secret
// `super-secret-jwt-token-with-at-least-32-characters-long`). NOT a real
// secret, NEVER valid against a hosted project — safe to default here.
// Overridable via env for a customized local setup.
const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const DB_URL =
  process.env.SUPABASE_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const PASSWORD = 'Battery-Test-Only-1234!'

describe.skipIf(!RUN)('REQ-AP-SEG-5 — multi-role RLS/RPC verification matrix (T-9.3)', () => {
  const stamp = Date.now()
  const emails = {
    admin: `battery-admin-${stamp}@antimahue.test`,
    empleadoActivo: `battery-empleado-activo-${stamp}@antimahue.test`,
    empleadoRevocado: `battery-empleado-revocado-${stamp}@antimahue.test`,
  }

  const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const pg = new PgClient({ connectionString: DB_URL })

  let adminId = ''
  let empleadoActivoId = ''
  let empleadoRevocadoId = ''

  let adminClient: SupabaseClient<Database>
  let empleadoActivoClient: SupabaseClient<Database>
  let empleadoRevocadoClient: SupabaseClient<Database>
  const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })

  // GoTrue password grant via a plain fetch, deliberately NOT
  // `supabase-js`'s own `signInWithPassword` — every client in this file
  // shares one Node process, and supabase-js's default (browser-oriented)
  // storage adapter falls back to a SINGLE in-memory store keyed by
  // `sb-<host>-auth-token` when no `window.localStorage` exists. Calling
  // `signInWithPassword` on N separate `createClient()` instances in the
  // same process clobbers that shared key on every call (confirmed: the
  // SDK itself logs "Multiple GoTrueClient instances detected... same
  // storage key" here) — the LAST sign-in silently wins for every client,
  // so an earlier "admin" client's calls end up authenticated as a LATER
  // actor. A raw password-grant fetch sidesteps GoTrue's client-side
  // session state entirely: the token is captured directly from the HTTP
  // response and attached as an explicit `Authorization` header on a
  // `persistSession:false` client — the exact same pattern
  // `enroll-empleado`'s own `callerClient` already uses in production.
  async function passwordGrant(email: string, password: string): Promise<string> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { access_token?: string; error?: string; msg?: string }
    if (!res.ok || !body.access_token) {
      throw new Error(`password grant failed for ${email}: ${res.status} ${JSON.stringify(body)}`)
    }
    return body.access_token
  }

  function clientAs(accessToken: string): SupabaseClient<Database> {
    return createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  }

  let productoStockId = '' // ample stock — confirmar_venta x2 + deshacer_venta target
  let productoScarceId = '' // stock=1 — insufficient-stock rejection target
  let ventaOldId = '' // non-last confirmed sale (SEG-5.3)
  let ventaNewId = '' // last confirmed sale

  beforeAll(async () => {
    await pg.connect()

    const { data: adminUser, error: adminErr } = await serviceClient.auth.admin.createUser({
      email: emails.admin,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { rol: 'admin' },
    })
    if (adminErr || !adminUser.user) {
      throw new Error(`setup: admin createUser failed: ${adminErr?.message}`)
    }
    adminId = adminUser.user.id

    const { data: empActivo, error: empActivoErr } = await serviceClient.auth.admin.createUser({
      email: emails.empleadoActivo,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { rol: 'empleado' },
    })
    if (empActivoErr || !empActivo.user) {
      throw new Error(`setup: empleado activo createUser failed: ${empActivoErr?.message}`)
    }
    empleadoActivoId = empActivo.user.id

    const { data: empRevocado, error: empRevocadoErr } = await serviceClient.auth.admin.createUser({
      email: emails.empleadoRevocado,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { rol: 'empleado' },
    })
    if (empRevocadoErr || !empRevocado.user) {
      throw new Error(`setup: empleado revocado createUser failed: ${empRevocadoErr?.message}`)
    }
    empleadoRevocadoId = empRevocado.user.id

    // Gap 11 workaround — see file header. Only a superuser SQL connection
    // can do this (service_role has zero PostgREST grants on profiles).
    await pg.query("UPDATE public.profiles SET rol = 'admin' WHERE id = $1", [adminId])

    // Real GoTrue password grants — genuine JWTs, not fixtures. See
    // `passwordGrant`/`clientAs` above for why this bypasses supabase-js's
    // own `signInWithPassword` session tracking.
    const adminToken = await passwordGrant(emails.admin, PASSWORD)
    adminClient = clientAs(adminToken)

    const empleadoActivoToken = await passwordGrant(emails.empleadoActivo, PASSWORD)
    empleadoActivoClient = clientAs(empleadoActivoToken)

    const empleadoRevocadoToken = await passwordGrant(emails.empleadoRevocado, PASSWORD)
    empleadoRevocadoClient = clientAs(empleadoRevocadoToken)

    // Revoke AFTER sign-in — see file header (proves the "still-valid JWT,
    // denied on the next request" property, not merely a pre-revoked login).
    await pg.query('UPDATE public.profiles SET activo = false WHERE id = $1', [empleadoRevocadoId])

    // Seed fixtures via the REAL admin-gated RPC, not a raw INSERT.
    const { data: stockProductId, error: stockProductErr } = await adminClient.rpc(
      'crear_producto',
      {
        p_producto: {
          nombre: 'Lana Battery Stock',
          sku: `BATTERY-STOCK-${stamp}`,
          tipo: 'lana',
          precio_venta: 1000,
          stock: 10,
        },
      }
    )
    if (stockProductErr || !stockProductId) {
      throw new Error(`setup: crear_producto (stock) failed: ${stockProductErr?.message}`)
    }
    productoStockId = stockProductId

    const { data: scarceProductId, error: scarceProductErr } = await adminClient.rpc(
      'crear_producto',
      {
        p_producto: {
          nombre: 'Lana Battery Escasa',
          sku: `BATTERY-SCARCE-${stamp}`,
          tipo: 'lana',
          precio_venta: 500,
          stock: 1,
        },
      }
    )
    if (scarceProductErr || !scarceProductId) {
      throw new Error(`setup: crear_producto (scarce) failed: ${scarceProductErr?.message}`)
    }
    productoScarceId = scarceProductId

    // Two confirmed sales (empleado activo sells) so SEG-5.3 has a
    // non-last sale to attempt deshacer_venta against.
    const { data: venta1, error: venta1Err } = await empleadoActivoClient.rpc('confirmar_venta', {
      p_items: [{ producto_id: productoStockId, cantidad: 1 }],
      p_medio_pago: 'efectivo',
    })
    if (venta1Err || !venta1)
      throw new Error(`setup: confirmar_venta #1 failed: ${venta1Err?.message}`)
    ventaOldId = venta1

    const { data: venta2, error: venta2Err } = await empleadoActivoClient.rpc('confirmar_venta', {
      p_items: [{ producto_id: productoStockId, cantidad: 1 }],
      p_medio_pago: 'efectivo',
    })
    if (venta2Err || !venta2)
      throw new Error(`setup: confirmar_venta #2 failed: ${venta2Err?.message}`)
    ventaNewId = venta2
  }, 30000)

  afterAll(async () => {
    // Best-effort cleanup: deleteUser cascades to profiles (FK ON DELETE
    // CASCADE). ventas/productos fixture rows are left behind — harmless
    // residue on a disposable local stack, same posture as prior phases'
    // own local-stack verification runs (never touches prod).
    for (const id of [adminId, empleadoActivoId, empleadoRevocadoId]) {
      if (id) {
        await serviceClient.auth.admin.deleteUser(id).catch(() => undefined)
      }
    }
    await pg.end()
  }, 30000)

  it('SEG-5.1 (T-1.5): active empleado — producto_costos/proveedores SELECT → [] (never 403)', async () => {
    const costos = await empleadoActivoClient.from('producto_costos').select('*')
    expect(costos.error).toBeNull()
    expect(costos.data).toEqual([])

    const proveedores = await empleadoActivoClient.from('proveedores').select('*')
    expect(proveedores.error).toBeNull()
    expect(proveedores.data).toEqual([])
  })

  it('SEG-5.2 (T-1.6): active admin — WITH CHECK boundary on a write policy (configuracion/proveedores)', async () => {
    // INTERPRETATION NOTE (disclosed in verify-report.md): the live
    // `configuracion_update_admin` / `proveedores_all_admin` USING/WITH
    // CHECK predicate is the symmetric `is_admin()` gate, not a value-range
    // boundary — there is no "in-bounds VALUE vs out-of-bounds VALUE" case
    // to exercise on this schema (unlike the spec row's data-model-inherited
    // illustrative wording, written against a hypothetical `productos`
    // policy that was never actually implemented as a table-level UPDATE
    // policy). The real, testable WITH CHECK boundary this policy enforces
    // is ROLE: an active admin's UPDATE satisfies WITH CHECK (in-bounds) and
    // commits; a non-admin's UPDATE never satisfies USING/WITH CHECK
    // (out-of-bounds) and is filtered to zero affected rows — this
    // codebase's own established "[] not 403" idiom, not an exception.
    const outOfBounds = await empleadoActivoClient
      .from('configuracion')
      .update({ nombre_tienda: 'Intentona Empleado' })
      .eq('id', 1)
      .select()
    expect(outOfBounds.error).toBeNull()
    expect(outOfBounds.data).toEqual([])

    const inBounds = await adminClient
      .from('configuracion')
      .update({ nombre_tienda: 'Antimahue' })
      .eq('id', 1)
      .select()
    expect(inBounds.error).toBeNull()
    expect(inBounds.data).toHaveLength(1)
  })

  it('SEG-5.3 (T-1.7): deshacer_venta on a non-last confirmed sale → RPC error, zero partial effect', async () => {
    const before = await adminClient
      .from('productos')
      .select('stock')
      .eq('id', productoStockId)
      .single()

    const { error } = await empleadoActivoClient.rpc('deshacer_venta', { p_venta_id: ventaOldId })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/solo se puede deshacer la última venta confirmada/)

    const after = await adminClient
      .from('productos')
      .select('stock')
      .eq('id', productoStockId)
      .single()
    expect(after.data?.stock).toBe(before.data?.stock)
  })

  it('SEG-5.4 (T-1.8): confirmar_venta over available stock → rejected, stock unchanged', async () => {
    const { error } = await empleadoActivoClient.rpc('confirmar_venta', {
      p_items: [{ producto_id: productoScarceId, cantidad: 100 }],
      p_medio_pago: 'efectivo',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/stock insuficiente/)

    const after = await adminClient
      .from('productos')
      .select('stock')
      .eq('id', productoScarceId)
      .single()
    expect(after.data?.stock).toBe(1)
  })

  it('SEG-5.5 (T-1.9): active empleado — productos embed with producto_costos degrades gracefully, not a request error', async () => {
    // DISCOVERED NUANCE (disclosed in verify-report.md, not silently
    // adjusted): the spec text (inherited from data-model's REQ-DM-SEG-3)
    // says the embed "comes back []". Empirically it comes back `null`,
    // not `[]` — `producto_costos.producto_id` is BOTH the primary key AND
    // the foreign key (a genuine 1:1), so PostgREST infers a TO-ONE embed
    // (object-or-null) rather than a to-many array. RLS still filters the
    // row exactly the same way; `null` is that same "invisible row"
    // degradation, just shaped for a to-one relation instead of a to-many
    // one. The property REQ-DM-SEG-3/REQ-AP-SEG-5 actually cares about —
    // the request succeeds (`error === null`) and `productos` rows return
    // normally, never a request-level error — holds.
    const { data, error } = await empleadoActivoClient
      .from('productos')
      .select('*, producto_costos(costo)')
      .eq('id', productoStockId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].producto_costos).toBeNull()
  })

  it('SEG-5.6 (T-1.10): anon — any domain table/RPC → 401/42501', async () => {
    const productos = await anonClient.from('productos').select('*')
    expect(productos.error).not.toBeNull()
    expect(productos.error?.code).toBe('42501')

    const rpc = await anonClient.rpc('is_admin')
    expect(rpc.error).not.toBeNull()
    expect(rpc.error?.code).toBe('42501')
  })

  it('SEG-5.7 (T-1.11): inactive empleado (activo=false) — denied on every SEG-5.1–5.4 target, incl. plain productos SELECT', async () => {
    // empleadoRevocadoClient still holds the SAME session obtained BEFORE
    // `activo` was flipped in beforeAll — proving REQ-AP-SEG-2's "denied on
    // the very next request... independent of access-token expiry" for
    // real, not merely by construction.
    const productos = await empleadoRevocadoClient.from('productos').select('*')
    expect(productos.error).toBeNull()
    expect(productos.data).toEqual([])

    const costos = await empleadoRevocadoClient.from('producto_costos').select('*')
    expect(costos.error).toBeNull()
    expect(costos.data).toEqual([])

    const proveedores = await empleadoRevocadoClient.from('proveedores').select('*')
    expect(proveedores.error).toBeNull()
    expect(proveedores.data).toEqual([])

    const { error: ventaError } = await empleadoRevocadoClient.rpc('confirmar_venta', {
      p_items: [{ producto_id: productoStockId, cantidad: 1 }],
      p_medio_pago: 'efectivo',
    })
    expect(ventaError).not.toBeNull()
    expect(ventaError?.message).toMatch(/usuario inactivo/)

    const { error: deshacerError } = await empleadoRevocadoClient.rpc('deshacer_venta', {
      p_venta_id: ventaNewId,
    })
    expect(deshacerError).not.toBeNull()

    const isActive = await empleadoRevocadoClient.rpc('is_active')
    expect(isActive.data).toBe(false)
  })
})
