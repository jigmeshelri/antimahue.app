/**
 * Pairing orchestration tests — T-3.1 (DD-3, REQ-AUTH-1).
 *
 * Network boundary: ONLY `@/lib/supabase`'s `auth.signInWithPassword` is
 * mocked — this is the one real network call pairing makes. `@/lib/crypto`
 * (PBKDF2 600k + AES-GCM) and `@/lib/vault` (fake-indexeddb, same pattern as
 * `vault.test.ts`) run for REAL, so these tests prove the whole local
 * pipeline end-to-end: a wrong-shaped write would fail a real decrypt, not
 * just a mock-call assertion.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { decryptToken, deriveKey } from '@/lib/crypto'
import { getRecord, listRecords } from '@/lib/vault'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { completePairing, PairingError, signInForPairing } from './pairDevice'

const signInWithPassword = vi.mocked(supabase.auth.signInWithPassword)

function makeFakeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token-abc123',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      app_metadata: { rol: 'empleado' },
      user_metadata: { display_name: 'Empleada Uno' },
      aud: 'authenticated',
      created_at: '2026-07-14T00:00:00.000Z',
      email: 'empleada@tienda.cl',
    },
    ...overrides,
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('antimahue-vault')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
})

describe('signInForPairing', () => {
  it('should_return_the_session_when_credentials_are_valid', async () => {
    const fakeSession = makeFakeSession()
    signInWithPassword.mockResolvedValue({
      data: { user: fakeSession.user, session: fakeSession },
      error: null,
    })

    const session = await signInForPairing('empleada@tienda.cl', 'admin-set-password')

    expect(session).toBe(fakeSession)
    expect(signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: 'empleada@tienda.cl',
      password: 'admin-set-password',
    })
  })

  it('should_throw_PairingError_when_credentials_are_invalid', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400 },
    } as never)

    await expect(signInForPairing('empleada@tienda.cl', 'wrong')).rejects.toThrow(PairingError)
  })

  it('should_throw_PairingError_when_no_session_is_returned_despite_no_error', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as never)

    await expect(signInForPairing('empleada@tienda.cl', 'admin-set-password')).rejects.toThrow(
      PairingError
    )
  })
})

describe('completePairing', () => {
  it('should_persist_exactly_one_vault_record_that_decrypts_back_to_the_refresh_token', async () => {
    const fakeSession = makeFakeSession()

    const record = await completePairing(fakeSession, '1234')

    expect(record.userId).toBe('user-1')
    expect(record.displayName).toBe('Empleada Uno')
    expect(record.rol).toBe('empleado')
    expect(record.failCount).toBe(0)
    expect(record.lockedUntil).toBeNull()
    expect(typeof record.pairedAt).toBe('number')

    const records = await listRecords()
    expect(records).toHaveLength(1)

    const stored = await getRecord('user-1')
    expect(stored).toBeDefined()

    // Full real-crypto roundtrip: the correct PIN recovers the original
    // refresh token from what was actually persisted to IndexedDB.
    const key = await deriveKey('1234', stored!.salt)
    const decrypted = await decryptToken({ ciphertext: stored!.ciphertext, iv: stored!.iv }, key)
    expect(decrypted).toBe('fake-refresh-token-abc123')
  })

  it('should_never_write_the_plaintext_pin_password_or_refresh_token_into_the_vault_record', async () => {
    const fakeSession = makeFakeSession()

    const record = await completePairing(fakeSession, '1234')

    const serialized = JSON.stringify({
      userId: record.userId,
      displayName: record.displayName,
      rol: record.rol,
      failCount: record.failCount,
      lockedUntil: record.lockedUntil,
      pairedAt: record.pairedAt,
    })
    expect(serialized).not.toContain('1234')
    expect(serialized).not.toContain('fake-refresh-token-abc123')
    expect(record.ciphertext).not.toEqual(new TextEncoder().encode('fake-refresh-token-abc123'))
  })

  it('should_default_rol_to_empleado_when_app_metadata_rol_is_missing_or_invalid', async () => {
    const fakeSession = makeFakeSession({
      user: { ...makeFakeSession().user, app_metadata: {} },
    })

    const record = await completePairing(fakeSession, '5678')

    expect(record.rol).toBe('empleado')
  })

  it('should_use_admin_rol_from_session_app_metadata_when_present', async () => {
    const fakeSession = makeFakeSession({
      user: { ...makeFakeSession().user, app_metadata: { rol: 'admin' } },
    })

    const record = await completePairing(fakeSession, '5678')

    expect(record.rol).toBe('admin')
  })

  it('should_fall_back_to_email_for_displayName_when_user_metadata_has_no_display_name', async () => {
    const fakeSession = makeFakeSession({
      user: { ...makeFakeSession().user, user_metadata: {} },
    })

    const record = await completePairing(fakeSession, '5678')

    expect(record.displayName).toBe('empleada@tienda.cl')
  })
})
