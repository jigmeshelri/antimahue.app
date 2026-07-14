/**
 * Raw IndexedDB vault for encrypted refresh tokens — DD-1.
 *
 * One object store (`profiles`, keyPath `userId`), one record per profile
 * paired on THIS browser. Deliberately dependency-free: the surface needed
 * (put/get/getAll/delete) is small enough (~40 LOC of actual logic) that an
 * IDB helper library (`idb-keyval`, `idb`) isn't justified under this repo's
 * post-TanStack supply-chain posture — every dependency is a deliberate cost
 * (`minimumReleaseAge=1440`, lifecycle scripts blocked). `ArrayBuffer` /
 * `Uint8Array` fields (salt, iv, ciphertext) are stored natively via
 * IndexedDB's structured clone — exactly the serialization step a helper
 * would otherwise abstract, already free here.
 *
 * `failCount` / `lockedUntil` live HERE, not only in the `$lock` nanostore
 * (DD-2): a reload must not reset the lockout counter, or a shared/borrowed
 * phone could bypass it by refreshing the page. `src/stores/lock.ts` mirrors
 * this same shape for reactive UI reads; the vault record is the durable
 * source of truth.
 */

const DB_NAME = 'antimahue-vault'
const DB_VERSION = 1
const STORE_NAME = 'profiles'

/** Employee vs. store-owner role. Single source of truth for the union —
 * the generated `Database['public']['Tables']['profiles']['Row']['rol']`
 * types as plain `string` because a Postgres CHECK constraint never surfaces
 * as a TS union in `supabase gen types` output (see database.types.ts header). */
export type Rol = 'admin' | 'empleado'

export interface VaultRecord {
  userId: string // auth.users.id — object-store keyPath
  displayName: string // from user.user_metadata.display_name — powers the PIN selector
  rol: Rol
  salt: Uint8Array<ArrayBuffer> // 16 bytes, from generateSalt()
  iv: Uint8Array<ArrayBuffer> // 12 bytes
  ciphertext: ArrayBuffer // AES-GCM(refresh_token)
  failCount: number // lockout counter — persisted so a reload can't reset it (DD-2)
  lockedUntil: number | null
  pairedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Run one operation inside a transaction and resolve once the transaction
 * COMMITS (not merely once the request succeeds) — the safer of the two
 * IndexedDB completion signals for a durable write.
 */
function runInTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = operation(store)
    let result: T

    request.onsuccess = () => {
      result = request.result
    }
    request.onerror = () => reject(request.error)

    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function withDb<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb()
  try {
    return await run(db)
  } finally {
    db.close()
  }
}

export function putRecord(record: VaultRecord): Promise<void> {
  return withDb((db) => runInTransaction(db, 'readwrite', (store) => store.put(record))).then(
    () => undefined
  )
}

export function getRecord(userId: string): Promise<VaultRecord | undefined> {
  return withDb((db) =>
    runInTransaction<VaultRecord | undefined>(db, 'readonly', (store) => store.get(userId))
  )
}

/** PIN-screen selector source (T-4.6): every profile paired on this device. */
export function listRecords(): Promise<VaultRecord[]> {
  return withDb((db) => runInTransaction<VaultRecord[]>(db, 'readonly', (store) => store.getAll()))
}

/** Terminal wipe (DD-2, 9th consecutive PIN failure) — forces re-pairing. */
export function deleteRecord(userId: string): Promise<void> {
  return withDb((db) => runInTransaction(db, 'readwrite', (store) => store.delete(userId))).then(
    () => undefined
  )
}
