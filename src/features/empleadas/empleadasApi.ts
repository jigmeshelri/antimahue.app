/**
 * empleadasApi — client boundary for `enroll-empleado`'s GET/POST actions
 * (Phase 6, T-6.1/T-6.2, DD-11).
 *
 * Plain orchestration module, no React — mirrors the `pairDevice.ts` /
 * `pinUnlock.ts` precedent (T-3.1/T-4.8) so the network boundary is
 * unit-testable by mocking ONLY `supabase.functions.invoke`.
 *
 * `supabase.functions.invoke()` (not a raw `fetch()`) is used deliberately:
 * supabase-js's `SupabaseClient.functions` getter wraps every call with
 * `fetchWithAuth`, which reads the CURRENT in-memory session via
 * `auth.getSession()` at call time and attaches it as
 * `Authorization: Bearer <access_token>` automatically — exactly the admin
 * JWT `enroll-empleado`'s auth chain requires (design.md §4), with zero
 * manual header wiring. This keeps working under DD-7's `persistSession:
 * false` because that flag only affects the storage ADAPTER, never the
 * client's in-memory auth state `getSession()` reads from.
 *
 * On a non-2xx response, supabase-js does NOT throw — it resolves
 * `{ data: null, error }` with `error` as a `FunctionsHttpError` whose
 * `.context` is the raw `Response` (status + a still-readable JSON body).
 * `messageFor` maps that surface to a human, CHILEAN/neutral-Spanish message
 * (no voseo — see tasks.md's flagged Phase 4 defect, "Probá", which this
 * module deliberately does not repeat).
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Rol } from '@/lib/vault'

/** One roster row — design.md §4's literal GET contract. */
export interface RosterEntry {
  id: string
  email: string | null
  displayName: string
  rol: Rol
  activo: boolean
  banned: boolean
}

export interface EnrollInput {
  email: string
  password: string
  displayName: string
}

/** Minimal ack from the `POST` (enroll) call — the screen refetches the full
 * roster afterward (T-6.2) rather than relying on this shape for `activo`/
 * `banned`, which the function does not return on this path. */
export interface EnrollAck {
  id: string
  email: string | null
  displayName: string
  rol: Rol
}

export interface SetActivoInput {
  userId: string
  activo: boolean
}

/** Ack from the `PATCH` (revoke/restore) call (Phase 7, T-7.2). */
export interface SetActivoAck {
  id: string
  activo: boolean
}

/** Thrown for any `enroll-empleado` call failure meant to surface to the UI. */
export class EmpleadasApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null
  ) {
    super(message)
  }
}

async function errorDetail(
  error: unknown
): Promise<{ status: number | null; code: string | null }> {
  if (!(error instanceof FunctionsHttpError)) {
    return { status: null, code: null }
  }
  const status: number = error.context.status
  let code: string | null = null
  try {
    const body: unknown = await error.context.json()
    if (
      body &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string'
    ) {
      code = (body as { error: string }).error
    }
  } catch {
    // Body wasn't JSON (or was already consumed) — fall back to status-only mapping.
  }
  return { status, code }
}

const MESSAGE_BY_CODE: Record<string, string> = {
  email_exists: 'Ya existe una cuenta con ese correo.',
  invalid_input: 'Revise los datos ingresados.',
  invalid_json: 'No se pudo leer la solicitud. Intente nuevamente.',
  missing_authorization: 'La sesión expiró. Vuelva a iniciar sesión.',
  invalid_token: 'La sesión expiró. Vuelva a iniciar sesión.',
  not_active_admin: 'Esta acción requiere una cuenta de administradora activa.',
  cannot_self_target: 'No puede modificar el estado de su propia cuenta.',
  user_not_found: 'No se encontró a la persona indicada.',
}

function messageFor(status: number | null, code: string | null): string {
  if (code && MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code]
  switch (status) {
    case 401:
      return 'La sesión expiró. Vuelva a iniciar sesión.'
    case 403:
      return 'Esta acción requiere una cuenta de administradora activa.'
    case 409:
      return 'Ya existe una cuenta con ese correo.'
    case 422:
      return 'Revise los datos ingresados.'
    default:
      return 'No se pudo completar la operación. Intente nuevamente.'
  }
}

async function throwFor(error: unknown): Promise<never> {
  const { status, code } = await errorDetail(error)
  throw new EmpleadasApiError(messageFor(status, code), status, code)
}

/** GET — the roster for the employee-management screen (T-6.1). */
export async function fetchRoster(): Promise<RosterEntry[]> {
  const { data, error } = await supabase.functions.invoke('enroll-empleado', { method: 'GET' })
  if (error) return throwFor(error)
  if (!Array.isArray(data)) {
    throw new EmpleadasApiError('Respuesta inesperada del servidor.', null, null)
  }
  return data as RosterEntry[]
}

/** POST — enroll a new employee (T-6.2). Callers should refetch the roster
 * on success rather than trust this ack for `activo`/`banned`. */
export async function enrollEmpleado(input: EnrollInput): Promise<EnrollAck> {
  const { data, error } = await supabase.functions.invoke('enroll-empleado', {
    method: 'POST',
    body: input,
  })
  if (error) return throwFor(error)
  return data as EnrollAck
}

/** PATCH — revoke or restore an employee (Phase 7, T-7.2, REQ-AP-SEG-4).
 * Server-side rejects a self-targeting call (`cannot_self_target`, see
 * `enroll-empleado`'s PATCH handler) — the UI additionally disables the
 * toggle for the caller's own row as a UX courtesy (DD-8: concealment is
 * UX-only, the real boundary is this server-side guard). Callers should
 * refetch the roster on success (design.md §7's "refetch-on-success"). */
export async function setEmpleadoActivo(input: SetActivoInput): Promise<SetActivoAck> {
  const { data, error } = await supabase.functions.invoke('enroll-empleado', {
    method: 'PATCH',
    body: input,
  })
  if (error) return throwFor(error)
  return data as SetActivoAck
}
