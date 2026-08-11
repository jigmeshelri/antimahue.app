/**
 * ProductDetailScreen — catalogo feature (Screen 7).
 *
 * Shows product details, admin cost/margin card, and an "add to sale" CTA.
 * Role checks are UX concealment only; the real boundary is RLS/RPC.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useStore } from '@nanostores/react'
import { PencilSimpleIcon } from '@phosphor-icons/react'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import Stepper from '@/components/molecules/Stepper'
import StockBadge from '@/components/atoms/StockBadge'
import BottomNav from '@/components/organisms/BottomNav'
import { $auth } from '@/stores/auth'
import { addLine } from '@/stores/saleDraft'
import { fetchProductById } from './catalogoApi'
import { computeMargin, formatPrice, productSubtitle } from './catalogoUtils'
import type { Product } from './catalogoTypes'

export default function ProductDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const auth = useStore($auth)
  const isAdmin = auth.rol === 'admin'

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchProductById(id)
        if (cancelled) return
        setProduct(data)
      } catch {
        if (cancelled) return
        setError('No se pudo cargar el producto')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleAddToSale = () => {
    if (!product) return
    addLine({
      productId: product.id,
      sku: product.sku ?? '',
      name: product.nombre,
      quantity,
      unitPrice: product.precio_venta,
      stockSnapshot: product.stock,
    })
    navigate('/venta')
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-bg-pantalla">
        <ScreenHeader title="Detalle" onBack={() => navigate('/catalogo')} />
        <div className="flex-1 flex items-center justify-center text-text-secondary text-[14px]">
          Cargando…
        </div>
        <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex flex-col h-screen bg-bg-pantalla">
        <ScreenHeader title="Detalle" onBack={() => navigate('/catalogo')} />
        <div className="flex-1 flex items-center justify-center text-stock-out text-[14px] px-[24px] text-center">
          {error ?? 'Producto no encontrado'}
        </div>
        <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
      </div>
    )
  }

  const costo = product.producto_costos?.costo ?? null
  const margin = computeMargin(product.precio_venta, costo)

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader
        title="Detalle"
        onBack={() => navigate('/catalogo')}
        rightAction={
          isAdmin ? (
            <button
              type="button"
              aria-label="Editar producto"
              onClick={() => navigate(`/catalogo/${product.id}/edit`)}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-black/[0.14] text-[#FAF0E0]"
            >
              <PencilSimpleIcon size={18} weight="bold" />
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[16px]">
        <div className="flex gap-[16px] items-start">
          <div
            className="w-[80px] h-[80px] rounded-card border border-border-sand shrink-0"
            style={{ backgroundColor: product.color_hex ?? 'var(--color-bg-card)' }}
          >
            {product.imagen_url ? (
              <img
                src={product.imagen_url}
                alt=""
                className="w-full h-full object-cover rounded-card"
              />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-semibold text-text-primary">{product.nombre}</h2>
            <p className="text-[13px] text-text-secondary">{productSubtitle(product)}</p>
            <div className="mt-[8px] flex items-center gap-[10px]">
              <span className="text-[20px] font-bold text-text-primary">
                {formatPrice(product.precio_venta)}
              </span>
              <StockBadge stock={product.stock} stockMinimo={product.stock_minimo} />
            </div>
          </div>
        </div>

        {isAdmin && costo !== null ? (
          <div className="rounded-card bg-bg-card border border-border-sand p-[14px] space-y-[8px]">
            <h3 className="text-[13px] font-semibold text-text-primary">Información de costo</h3>
            <div className="flex justify-between text-[14px]">
              <span className="text-text-secondary">Costo</span>
              <span className="font-medium text-text-primary">{formatPrice(costo)}</span>
            </div>
            {margin !== null ? (
              <div className="flex justify-between text-[14px]">
                <span className="text-text-secondary">Margen</span>
                <span className="font-medium text-success">{margin}%</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-card bg-bg-card border border-border-sand p-[14px] space-y-[8px]">
          <h3 className="text-[13px] font-semibold text-text-primary">Detalles</h3>
          <div className="grid grid-cols-2 gap-y-[8px] text-[14px]">
            <span className="text-text-secondary">SKU</span>
            <span className="text-text-primary">{product.sku ?? '—'}</span>
            <span className="text-text-secondary">Tipo</span>
            <span className="text-text-primary">{product.tipo ?? '—'}</span>
            <span className="text-text-secondary">Marca</span>
            <span className="text-text-primary">{product.marca ?? '—'}</span>
            <span className="text-text-secondary">Grosor</span>
            <span className="text-text-primary">{product.grosor ?? '—'}</span>
            <span className="text-text-secondary">Peso/Metraje</span>
            <span className="text-text-primary">{product.peso_metraje ?? '—'}</span>
            <span className="text-text-secondary">Color</span>
            <span className="text-text-primary">{product.color_nombre ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="px-[16px] py-[12px] bg-bg-card border-t border-border-sand-light">
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
      </div>

      <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
    </div>
  )
}
