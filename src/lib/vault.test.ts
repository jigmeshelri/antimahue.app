/**
 * Vault CRUD roundtrip tests — T-2.1.
 *
 * jsdom does not implement IndexedDB, so `fake-indexeddb` (mature,
 * script-free — sanctioned by the apply-gate exception for vault tests)
 * polyfills the global `indexedDB` for this file only via the `/auto` side
 * effect import. Real behavior, not a mock: every assertion here exercises
 * the actual `src/lib/vault.ts` implementation against a real (fake) IDB.
 *
 * GOTCHA: binary fields (`salt`/`iv`/`ciphertext`) are compared via
 * `toBytes()` rather than raw `toEqual()` on the whole record. Under
 * vitest's jsdom test environment, a plain `ArrayBuffer` that comes back out
 * of fake-indexeddb's structured-clone step lives in a different realm than
 * the jsdom `ArrayBuffer` the test constructs — `byteLength` and content are
 * both correct (verified below), but `toEqual`'s deep-equality can't match
 * a cross-realm `ArrayBuffer` by `instanceof` and misreports a diff. This is
 * a test-tooling artifact of the jsdom+fake-indexeddb combination, not a
 * bug in the app: a real browser has exactly one realm.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteRecord, getRecord, listRecords, putRecord, type VaultRecord } from './vault'

function makeRecord(overrides: Partial<VaultRecord> = {}): VaultRecord {
  return {
    userId: 'user-1',
    displayName: 'Angélica',
    rol: 'admin',
    salt: new Uint8Array([1, 2, 3, 4]),
    iv: new Uint8Array([5, 6, 7, 8]),
    ciphertext: new Uint8Array([9, 10, 11, 12]).buffer,
    failCount: 0,
    lockedUntil: null,
    pairedAt: 1_700_000_000_000,
    ...overrides,
  }
}

/** Byte-content view of a binary field, immune to the cross-realm `ArrayBuffer` quirk above. */
function toBytes(value: ArrayBuffer | Uint8Array): number[] {
  return Array.from(value instanceof Uint8Array ? value : new Uint8Array(value))
}

/** Asserts every VaultRecord field matches, comparing binary fields by byte content. */
function expectSameRecord(actual: VaultRecord | undefined, expected: VaultRecord): void {
  expect(actual).toBeDefined()
  expect(actual?.userId).toBe(expected.userId)
  expect(actual?.displayName).toBe(expected.displayName)
  expect(actual?.rol).toBe(expected.rol)
  expect(actual?.failCount).toBe(expected.failCount)
  expect(actual?.lockedUntil).toBe(expected.lockedUntil)
  expect(actual?.pairedAt).toBe(expected.pairedAt)
  expect(toBytes(actual!.salt)).toEqual(toBytes(expected.salt))
  expect(toBytes(actual!.iv)).toEqual(toBytes(expected.iv))
  expect(toBytes(actual!.ciphertext)).toEqual(toBytes(expected.ciphertext))
}

// Fresh vault DB per test — fake-indexeddb persists module-global state
// across tests within this file, so each test must not bleed into the next.
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('antimahue-vault')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
})

describe('vault', () => {
  it('should_return_the_exact_record_when_put_then_get', async () => {
    const record = makeRecord()

    await putRecord(record)
    const fetched = await getRecord(record.userId)

    expectSameRecord(fetched, record)
  })

  it('should_return_undefined_when_getRecord_for_unknown_userId', async () => {
    const fetched = await getRecord('does-not-exist')

    expect(fetched).toBeUndefined()
  })

  it('should_return_empty_array_when_listRecords_with_no_records', async () => {
    const records = await listRecords()

    expect(records).toEqual([])
  })

  it('should_return_every_stored_record_when_listRecords', async () => {
    const first = makeRecord({ userId: 'user-1', displayName: 'Angélica', rol: 'admin' })
    const second = makeRecord({ userId: 'user-2', displayName: 'Empleada', rol: 'empleado' })

    await putRecord(first)
    await putRecord(second)
    const records = await listRecords()

    expect(records).toHaveLength(2)
    const byUserId = new Map(records.map((r) => [r.userId, r]))
    expectSameRecord(byUserId.get('user-1'), first)
    expectSameRecord(byUserId.get('user-2'), second)
  })

  it('should_overwrite_existing_record_when_putRecord_called_twice_for_same_userId', async () => {
    await putRecord(makeRecord({ failCount: 0 }))
    await putRecord(makeRecord({ failCount: 3, lockedUntil: 1_700_000_030_000 }))

    const fetched = await getRecord('user-1')
    const records = await listRecords()

    expect(fetched?.failCount).toBe(3)
    expect(fetched?.lockedUntil).toBe(1_700_000_030_000)
    expect(records).toHaveLength(1)
  })

  it('should_remove_only_the_targeted_record_when_deleteRecord_called', async () => {
    await putRecord(makeRecord({ userId: 'user-1' }))
    await putRecord(makeRecord({ userId: 'user-2' }))

    await deleteRecord('user-1')
    const records = await listRecords()
    const remaining = await getRecord('user-1')

    expect(records).toHaveLength(1)
    expect(records[0]?.userId).toBe('user-2')
    expect(remaining).toBeUndefined()
  })

  it('should_not_throw_when_deleteRecord_called_for_unknown_userId', async () => {
    await expect(deleteRecord('does-not-exist')).resolves.toBeUndefined()
  })
})
