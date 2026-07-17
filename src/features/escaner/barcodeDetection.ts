/**
 * Barcode detection helpers.
 *
 * Wraps the experimental Barcode Detection API with a normalized SKU output.
 * Falls back gracefully when the API is unavailable.
 */

/**
 * Normalize a scanned barcode string into a clean SKU:
 * trim whitespace and keep only digits.
 */
export function normalizeSku(raw: string): string {
  return raw.trim().replace(/\D/g, '')
}

interface BarcodeDetectorItem {
  rawValue: string
}

interface BarcodeDetectorClass {
  new (): {
    detect(source: HTMLVideoElement | HTMLImageElement): Promise<BarcodeDetectorItem[]>
  }
}

/**
 * Detect a barcode from a video element using the Barcode Detection API.
 * Returns the first detected barcode normalized, or null if none/unavailable.
 */
export async function detectBarcode(source: HTMLVideoElement): Promise<string | null> {
  const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorClass })
    .BarcodeDetector
  if (!Detector) return null

  const detector = new Detector()
  const results = await detector.detect(source)
  if (results.length === 0) return null

  return normalizeSku(results[0].rawValue)
}
