/**
 * WebCrypto helpers for PIN-based session token encryption — D5.
 *
 * Model: the refresh token is encrypted by a key derived from the PIN;
 * neither the PIN nor the derived key is ever persisted.
 *
 * Algorithm choices (OQ-3 RESOLVED):
 *   Key derivation : PBKDF2, SHA-256, 600_000 iterations
 *   Encryption     : AES-GCM 256-bit (authenticated encryption — wrong PIN → auth tag fails)
 *
 * IMPORTANT flag (design.md 4.5): WebCrypto + IndexedDB must be validated
 * inside the installed PWA (SW context). Run the smoke test (task 7.10) after
 * installing the app — it is NOT sufficient to test in a normal browser tab.
 */

const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 256-bit AES-GCM key from a PIN string and a random salt.
 *
 * @param pin  - The raw PIN string (e.g. "1234"). Never persisted.
 * @param salt - 16-byte random Uint8Array. Persisted alongside the ciphertext.
 */
export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const pinBytes = encoder.encode(pin)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate a fresh random salt for a new enrollment.
 */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES))
}

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  ciphertext: ArrayBuffer
  iv: Uint8Array<ArrayBuffer>
}

/**
 * Encrypt a plaintext token string with AES-GCM.
 *
 * @param token - The refresh token to protect.
 * @param key   - Derived CryptoKey (from deriveKey).
 * @returns Ciphertext + IV. Both must be stored to decrypt later.
 */
export async function encryptToken(token: string, key: CryptoKey): Promise<EncryptedPayload> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  )

  return { ciphertext, iv }
}

/**
 * Decrypt an AES-GCM ciphertext.
 *
 * Throws DOMException if the key is wrong (GCM auth tag verification fails).
 * The caller MUST catch this and treat it as a wrong-PIN event — increment
 * the fail counter and apply lockout backoff (design.md D5 lockout table).
 *
 * @param payload - The { ciphertext, iv } returned by encryptToken.
 * @param key     - Derived CryptoKey (from deriveKey with the same PIN attempt).
 * @returns The original refresh token string.
 */
export async function decryptToken(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payload.iv },
    key,
    payload.ciphertext
  )

  return new TextDecoder().decode(plaintext)
}
