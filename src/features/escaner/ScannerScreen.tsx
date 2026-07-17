/**
 * ScannerScreen — escaner feature (Screen 4).
 *
 * Uses the Barcode Detection API when available; falls back to a manual
 * SKU input. On detection, looks up the product by exact SKU match and
 * shows an overlay to add it to the current sale.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import Stepper from '@/components/molecules/Stepper'
import StockBadge from '@/components/atoms/StockBadge'
import BottomNav from '@/components/organisms/BottomNav'
import { addLine } from '@/stores/saleDraft'
import { findProductBySku } from '@/features/catalogo/catalogoApi'
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import { detectBarcode, normalizeSku } from './barcodeDetection'
import type { Product } from '@/features/catalogo/catalogoTypes'

export default function ScannerScreen() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [streamReady, setStreamReady] = useState(false)
  const [scanning, setScanning] = useState(true)
  const [detectedSku, setDetectedSku] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [manualSku, setManualSku] = useState('')
  const hasDetector =
    typeof (globalThis as never as { BarcodeDetector?: unknown }).BarcodeDetector !== 'undefined'

  // Start camera stream.
  useEffect(() => {
    let active = true

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (!active) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = mediaStream
        setStreamReady(true)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          void videoRef.current.play()
        }
      })
      .catch(() => {
        // Camera unavailable — manual input remains usable.
      })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  // Detection loop.
  useEffect(() => {
    if (!streamReady || !videoRef.current || !hasDetector || !scanning) return

    let cancelled = false
    const runDetection = async () => {
      if (cancelled || !videoRef.current) return
      const sku = await detectBarcode(videoRef.current)
      if (sku && sku !== detectedSku) {
        setDetectedSku(sku)
        setScanning(false)
        const found = await findProductBySku(sku)
        setProduct(found)
      }
      if (!cancelled) {
        requestAnimationFrame(runDetection)
      }
    }

    const frame = requestAnimationFrame(runDetection)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [streamReady, hasDetector, scanning, detectedSku])

  const handleManualSearch = async () => {
    const sku = normalizeSku(manualSku)
    if (!sku) return
    setDetectedSku(sku)
    setScanning(false)
    const found = await findProductBySku(sku)
    setProduct(found)
  }

  const handleAddToSale = () => {
    if (!product) return
    addLine({
      productId: product.id,
      sku: product.sku ?? '',
      name: product.nombre,
      quantity,
      unitPrice: product.precio_venta,
    })
    navigate('/venta')
  }

  const handleCloseOverlay = () => {
    setDetectedSku(null)
    setProduct(null)
    setQuantity(1)
    setScanning(true)
  }

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader title="Escanear" onBack={() => navigate('/venta')} />

      <div className="flex-1 relative overflow-hidden">
        {hasDetector ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}

        {!hasDetector || !streamReady ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-[24px] space-y-[16px]">
            <p className="text-text-secondary text-[14px] text-center">
              El escáner de códigos no está disponible en este dispositivo.
            </p>
            <div className="flex gap-[8px] w-full max-w-[320px]">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ingresa el SKU manualmente"
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                className="flex-1 bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
              />
              <button
                type="button"
                onClick={handleManualSearch}
                className="px-[16px] rounded-card bg-madera text-bg-pantalla font-medium text-[14px]"
              >
                Buscar
              </button>
            </div>
          </div>
        ) : null}

        {detectedSku ? (
          <div className="absolute inset-x-0 bottom-0 bg-bg-card rounded-t-card border-t border-border-sand-light p-[16px] space-y-[12px]">
            <div className="flex justify-between items-start">
              <div>
                {product ? (
                  <>
                    <p className="text-[16px] font-semibold text-text-primary">{product.nombre}</p>
                    <p className="text-[14px] font-medium text-text-primary">
                      {formatPrice(product.precio_venta)}
                    </p>
                    <StockBadge stock={product.stock} stockMinimo={product.stock_minimo} />
                  </>
                ) : (
                  <p className="text-[14px] text-text-secondary">Producto no registrado</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseOverlay}
                className="text-[13px] text-text-secondary"
              >
                Cerrar
              </button>
            </div>

            {product ? (
              <div className="flex items-center gap-[12px]">
                <Stepper quantity={quantity} max={product.stock} onChange={setQuantity} />
                <button
                  type="button"
                  onClick={handleAddToSale}
                  disabled={product.stock === 0}
                  className="flex-1 py-[12px] rounded-card bg-madera text-bg-pantalla font-semibold text-[15px] disabled:opacity-50"
                >
                  Agregar a la venta
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <BottomNav active="venta" onNavigate={(path) => navigate(path)} />
    </div>
  )
}
