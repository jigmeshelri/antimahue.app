/**
 * Daily PIN-unlock orchestration tests — T-4.8 (REQ-AUTH-1, REQ-AUTH-2,
 * REQ-AUTH-4; DD-2, DD-7).
 *
 * Network boundary: ONLY `@/lib/supabase`'s `auth.refreshSession` and
 * `from(...)` are mocked — these are the two real network calls a
 * successful unlock makes. `@/lib/crypto` (PBKDF2 600k + AES-GCM) and
 * `@/lib/vault` (fake-indexeddb, same pattern as `vault.test.ts` /
 * `pairDevice.test.ts`) run for REAL, so a wrong-shaped vault write would
 * fail a real decrypt, not just a mock-call assertion.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { decryptToken, deriveKey, encryptToken, generateSalt } from '@/lib/crypto'
import { getRecord, putRecord, type Rol, type VaultRecord } from '@/lib/vault'
import { $auth } from '@/stores/auth'
import { $lock } from '@/stores/lock'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import {
  attemptUnlock,
  PinUnlockError,
  syncLockFromVault,
  type PinUnlockErrorKind,
} from './pinUnlock'

const refreshSession = vi.mocked(supabase.auth.refreshSession)
const from = vi.mocked(supabase.from)

function makeFakeSession(refreshToken: string): Session {
  return {
    access_token: 'fake-access-token',
    refresh_token: refreshToken,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-14T00:00:00.000Z',
      email: 'empleada@tienda.cl',
    },
  } as Session
}

function mockRefreshSuccess(refreshToken: string) {
  refreshSession.mockResolvedValue({
    data: { session: makeFakeSession(refreshToken), user: makeFakeSession(refreshToken).user },
    error: null,
  } as never)
}

function mockProfileRead(result: {
  data: { rol: string; activo: boolean } | null
  error: { message: string } | null
}) {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(result),
      }),
    }),
  } as never)
}

async function seedVaultRecord(params: {
  userId: string
  pin: string
  refreshToken: string
  rol?: Rol
  failCount?: number
  lockedUntil?: number | null
}): Promise<VaultRecord> {
  const salt = generateSalt()
  const key = await deriveKey(params.pin, salt)
  const { ciphertext, iv } = await encryptToken(params.refreshToken, key)
  const record: VaultRecord = {
    userId: params.userId,
    displayName: 'Empleada Uno',
    rol: params.rol ?? 'empleado',
    salt,
    iv,
    ciphertext,
    failCount: params.failCount ?? 0,
    lockedUntil: params.lockedUntil ?? null,
    pairedAt: Date.now(),
  }
  await putRecord(record)
  return record
}

async function decryptStoredToken(userId: string, pin: string): Promise<string> {
  const record = await getRecord(userId)
  if (!record) throw new Error('record not found')
  const key = await deriveKey(pin, record.salt)
  return decryptToken({ ciphertext: record.ciphertext, iv: record.iv }, key)
}

/** Awaits `promise` exactly once, asserting it rejects with the given PinUnlockError kind. */
async function expectUnlockError(
  promise: Promise<unknown>,
  kind: PinUnlockErrorKind
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(PinUnlockError)
  await promise.catch((err: unknown) => {
    expect((err as PinUnlockError).kind).toBe(kind)
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  $auth.set({ session: null, user: null, rol: null, status: 'locked', loading: false })
  $lock.set({ failCount: 0, lockedUntil: null, requiresRelogin: false })
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('antimahue-vault')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
})

describe('attemptUnlock — successful roundtrip', () => {
  it('should_resolve_rol_and_mark_auth_unlocked_on_a_correct_pin', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })
    mockRefreshSuccess('rotated-refresh-token')
    mockProfileRead({ data: { rol: 'empleado', activo: true }, error: null })

    const result = await attemptUnlock('user-1', '1234')

    expect(result).toEqual({ rol: 'empleado' })
    expect(refreshSession).toHaveBeenCalledExactlyOnceWith({
      refresh_token: 'original-refresh-token',
    })
    expect($auth.get().rol).toBe('empleado')
    expect($auth.get().status).toBe('unlocked')
    expect($lock.get()).toEqual({ failCount: 0, lockedUntil: null, requiresRelogin: false })
  })

  it('should_re_encrypt_the_rotated_refresh_token_so_it_is_recoverable_with_the_same_pin_afterward', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })
    mockRefreshSuccess('rotated-refresh-token')
    mockProfileRead({ data: { rol: 'empleado', activo: true }, error: null })

    await attemptUnlock('user-1', '1234')

    const recovered = await decryptStoredToken('user-1', '1234')
    expect(recovered).toBe('rotated-refresh-token')
  })
})

describe('attemptUnlock — wrong-PIN lockout curve (DD-2)', () => {
  it('should_throw_wrong_pin_and_never_call_the_network_when_the_pin_is_incorrect', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })

    await expectUnlockError(attemptUnlock('user-1', '0000'), 'wrong-pin')

    expect(refreshSession).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    const record = await getRecord('user-1')
    expect(record?.failCount).toBe(1)
  })

  it('should_lock_for_30_seconds_after_the_5th_consecutive_wrong_pin', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'x', failCount: 4 })

    await expectUnlockError(attemptUnlock('user-1', '0000'), 'wrong-pin')

    const record = await getRecord('user-1')
    expect(record?.failCount).toBe(5)
    expect(record?.lockedUntil).not.toBeNull()
    expect($lock.get().lockedUntil).toBe(record?.lockedUntil)
  })

  it('should_reject_an_attempt_during_an_active_cooldown_without_touching_failCount_or_the_network', async () => {
    const lockedUntil = Date.now() + 10_000
    await seedVaultRecord({
      userId: 'user-1',
      pin: '1234',
      refreshToken: 'x',
      failCount: 5,
      lockedUntil,
    })

    await expectUnlockError(attemptUnlock('user-1', '1234'), 'locked')

    const record = await getRecord('user-1')
    expect(record?.failCount).toBe(5)
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('should_wipe_the_vault_record_on_the_9th_consecutive_wrong_pin', async () => {
    await seedVaultRecord({
      userId: 'user-1',
      pin: '1234',
      refreshToken: 'x',
      failCount: 8,
      lockedUntil: Date.now() - 1_000, // the 8th failure's 1h cooldown already elapsed
    })

    await expectUnlockError(attemptUnlock('user-1', '0000'), 'wiped')

    expect(await getRecord('user-1')).toBeUndefined()
    expect($lock.get().requiresRelogin).toBe(true)
  })
})

describe('attemptUnlock — revoked user (REQ-AUTH-4)', () => {
  it('should_refuse_the_unlock_when_the_profile_is_inactive_but_leave_the_vault_record_intact', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })
    mockRefreshSuccess('rotated-refresh-token')
    mockProfileRead({ data: { rol: 'empleado', activo: false }, error: null })

    await expectUnlockError(attemptUnlock('user-1', '1234'), 'inactive')

    const record = await getRecord('user-1')
    expect(record).toBeDefined()
    expect(record?.failCount).toBe(0)
    expect($auth.get()).toEqual({
      session: null,
      user: null,
      rol: null,
      status: 'locked',
      loading: false,
    })
    expect($lock.get()).toEqual({ failCount: 0, lockedUntil: null, requiresRelogin: false })

    // The vault stays USABLE: it holds the rotated token, not the
    // pre-refresh one — a later admin restore doesn't strand it.
    const recovered = await decryptStoredToken('user-1', '1234')
    expect(recovered).toBe('rotated-refresh-token')
  })
})

describe('attemptUnlock — edge cases', () => {
  it('should_throw_not_paired_and_never_call_the_network_for_an_unknown_userId', async () => {
    await expectUnlockError(attemptUnlock('ghost-user', '1234'), 'not-paired')

    expect(refreshSession).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('should_wipe_the_vault_and_throw_session_invalid_when_refreshSession_rejects_the_token', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })
    refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'invalid refresh token', name: 'AuthApiError', status: 400 },
    } as never)

    await expectUnlockError(attemptUnlock('user-1', '1234'), 'session-invalid')

    expect(await getRecord('user-1')).toBeUndefined()
  })

  it('should_throw_session_invalid_when_the_post_refresh_profiles_read_fails', async () => {
    await seedVaultRecord({ userId: 'user-1', pin: '1234', refreshToken: 'original-refresh-token' })
    mockRefreshSuccess('rotated-refresh-token')
    mockProfileRead({ data: null, error: { message: 'boom' } })

    await expectUnlockError(attemptUnlock('user-1', '1234'), 'session-invalid')
  })
})

describe('syncLockFromVault', () => {
  it('should_mirror_the_vault_records_lockout_counters_into_lock', async () => {
    const lockedUntil = Date.now() + 5_000
    await seedVaultRecord({
      userId: 'user-1',
      pin: '1234',
      refreshToken: 'x',
      failCount: 6,
      lockedUntil,
    })

    await syncLockFromVault('user-1')

    expect($lock.get()).toEqual({ failCount: 6, lockedUntil, requiresRelogin: false })
  })

  it('should_reset_to_neutral_when_no_record_exists_for_the_userId', async () => {
    $lock.set({ failCount: 7, lockedUntil: Date.now() + 1_000, requiresRelogin: false })

    await syncLockFromVault('ghost-user')

    expect($lock.get()).toEqual({ failCount: 0, lockedUntil: null, requiresRelogin: false })
  })
})
