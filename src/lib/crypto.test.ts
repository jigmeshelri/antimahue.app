/**
 * Smoke test for the WebCrypto helpers (T-0.3, Phase 0 apply gate).
 *
 * Proves the Vitest + jsdom runner works end-to-end against a REAL pure
 * module in this repo (src/lib/crypto.ts, D5) — not a placeholder assertion.
 * Deeper coverage of deriveKey/encryptToken/decryptToken lands with the
 * feature work that consumes them (Phase 2+).
 */
import { describe, expect, it } from 'vitest'
import { generateSalt } from './crypto'

describe('generateSalt', () => {
  it('returns a 16-byte random salt', () => {
    const salt = generateSalt()

    expect(salt).toBeInstanceOf(Uint8Array)
    expect(salt.byteLength).toBe(16)
  })

  it('returns a different value on each call', () => {
    const first = generateSalt()
    const second = generateSalt()

    expect(first).not.toEqual(second)
  })
})
