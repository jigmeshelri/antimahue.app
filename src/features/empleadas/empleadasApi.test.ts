/**
 * empleadasApi tests — Phase 6 (T-6.1/T-6.2).
 *
 * Network boundary: ONLY `@/lib/supabase`'s `functions.invoke` is mocked —
 * this is the one real network call both `fetchRoster` and `enrollEmpleado`
 * make, mirroring the `pairDevice.test.ts` precedent (mock only
 * `signInWithPassword`, the one real network call pairing makes).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { EmpleadasApiError, enrollEmpleado, fetchRoster, type RosterEntry } from './empleadasApi'

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  vi.clearAllMocks()
})

function httpError(status: number, body: unknown): FunctionsHttpError {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }))
}

describe('fetchRoster', () => {
  it('should_return_the_roster_when_the_call_succeeds', async () => {
    const roster: RosterEntry[] = [
      {
        id: 'u1',
        email: 'a@t.cl',
        displayName: 'Ana',
        rol: 'empleado',
        activo: true,
        banned: false,
      },
    ]
    invoke.mockResolvedValue({ data: roster, error: null } as never)

    const result = await fetchRoster()

    expect(result).toEqual(roster)
    expect(invoke).toHaveBeenCalledExactlyOnceWith('enroll-empleado', { method: 'GET' })
  })

  it('should_throw_EmpleadasApiError_with_a_403_message_when_the_caller_is_not_an_active_admin', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(403, { error: 'not_active_admin' }),
    } as never)

    await expect(fetchRoster()).rejects.toMatchObject({
      status: 403,
      code: 'not_active_admin',
      message: 'Esta acción requiere una cuenta de administradora activa.',
    })
  })

  it('should_throw_EmpleadasApiError_with_a_401_message_when_the_session_expired', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(401, { error: 'missing_authorization' }),
    } as never)

    const result = fetchRoster()

    await expect(result).rejects.toThrow(EmpleadasApiError)
    await expect(result).rejects.toMatchObject({ status: 401 })
  })

  it('should_throw_a_generic_message_when_the_error_is_not_an_http_error', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new Error('network down'),
    } as never)

    await expect(fetchRoster()).rejects.toMatchObject({
      status: null,
      code: null,
      message: 'No se pudo completar la operación. Intente nuevamente.',
    })
  })

  it('should_throw_when_the_response_data_is_not_an_array', async () => {
    invoke.mockResolvedValue({ data: { unexpected: true }, error: null } as never)

    await expect(fetchRoster()).rejects.toThrow('Respuesta inesperada del servidor.')
  })
})

describe('enrollEmpleado', () => {
  const input = {
    email: 'nueva@tienda.cl',
    password: 'clave-segura',
    displayName: 'Nueva Vendedora',
  }

  it('should_return_the_ack_and_send_a_POST_with_the_given_body_when_enrollment_succeeds', async () => {
    const ack = {
      id: 'u2',
      email: input.email,
      displayName: input.displayName,
      rol: 'empleado' as const,
    }
    invoke.mockResolvedValue({ data: ack, error: null } as never)

    const result = await enrollEmpleado(input)

    expect(result).toEqual(ack)
    expect(invoke).toHaveBeenCalledExactlyOnceWith('enroll-empleado', {
      method: 'POST',
      body: input,
    })
  })

  it('should_throw_a_duplicate_email_message_on_409', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(409, { error: 'email_exists' }),
    } as never)

    await expect(enrollEmpleado(input)).rejects.toMatchObject({
      status: 409,
      code: 'email_exists',
      message: 'Ya existe una cuenta con ese correo.',
    })
  })

  it('should_throw_a_validation_message_on_422_even_without_a_recognized_code', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(422, { error: 'weak_password_or_whatever' }),
    } as never)

    await expect(enrollEmpleado(input)).rejects.toMatchObject({
      status: 422,
      message: 'Revise los datos ingresados.',
    })
  })

  it('should_fall_back_to_status_only_mapping_when_the_error_body_is_not_valid_json', async () => {
    const error = new FunctionsHttpError(new Response('not json', { status: 409 }))
    invoke.mockResolvedValue({ data: null, error } as never)

    await expect(enrollEmpleado(input)).rejects.toMatchObject({
      status: 409,
      code: null,
      message: 'Ya existe una cuenta con ese correo.',
    })
  })
})
