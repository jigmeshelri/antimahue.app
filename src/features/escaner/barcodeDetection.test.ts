/**
 * barcodeDetection tests — normalization and detector helpers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectBarcode, normalizeSku } from './barcodeDetection'

describe('normalizeSku', () => {
  it('should_trim_whitespace', () => {
    expect(normalizeSku('  123456  ')).toBe('123456')
  })

  it('should_remove_non_numeric_characters', () => {
    expect(normalizeSku('12-34-56')).toBe('123456')
  })

  it('should_return_empty_string_for_missing_input', () => {
    expect(normalizeSku('')).toBe('')
  })
})

describe('detectBarcode', () => {
  beforeEach(() => {
    vi.stubGlobal('BarcodeDetector', undefined)
  })

  it('should_return_null_when_BarcodeDetector_is_unavailable', async () => {
    const result = await detectBarcode(document.createElement('video'))
    expect(result).toBeNull()
  })

  it('should_return_normalized_sku_when_detected', async () => {
    const mockDetect = vi.fn().mockResolvedValue([{ rawValue: ' 123-456-789 ' }])
    class FakeDetector {
      detect = mockDetect
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector)

    const result = await detectBarcode(document.createElement('video'))
    expect(result).toBe('123456789')
    expect(mockDetect).toHaveBeenCalled()
  })

  it('should_return_null_when_no_barcodes_detected', async () => {
    class FakeDetector {
      detect = vi.fn().mockResolvedValue([])
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector)

    const result = await detectBarcode(document.createElement('video'))
    expect(result).toBeNull()
  })
})
