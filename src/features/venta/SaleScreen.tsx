/**
 * SaleScreen — venta feature (Screen 3).
 *
 * Builds a sale draft from search/scanned products, lets the user adjust
 * quantities, pick a payment method and confirm the sale.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import { BarcodeIcon, TrashIcon } from '@phosphor-icons/react'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import SearchInput from '@/components/molecules/SearchInput'
import Stepper from '@/components/molecules/Stepper'
import BottomNav from '@/components/organisms/BottomNav'
import ProductCard from '@/components/molecules/ProductCard'
import {
  $saleDraft,
  addLine,
  clearDraft,
  removeLine,
  setQuantity,
  setMedioPago,
  type SaleLine,
} from '@/stores/saleDraft'
import { $auth } from '@/stores/auth'
import { showToast } from '@/stores/ui'
import { fetchProducts } from '@/features/catalogo/catalogoApi'
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import { draftTotal, MEDIO_PAGO_LABELS, parseRpcError } from './ventaUtils'
import { confirmSale, fetchStock } from './ventaApi'
import type { Product } from '@/features/catalogo/catalogoTypes'
import type { MedioPago } from './ventaTypes'

const MEDIOS_PAGO: MedioPago[] = ['efectivo', 'transferencia', 'debito', 'credito']
const SEARCH_DEBOUNCE_MS = 300

export default function SaleScreen() {
  const navigate = useNavigate()
  const draft = useStore($saleDraft)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [flaggedProductId, setFlaggedProductId] = useState<string | null>(null)

  const total = useMemo(() => draftTotal(draft.lines), [draft.lines])
  const overSnapshot = draft.lines.some(
    (line) => line.stockSnapshot !== null && line.quantity > line.stockSnapshot
  )
  const canConfirm = draft.lines.length > 0 && !overSnapshot && !isSubmitting

  // Debounce search input.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Load products when the debounced search changes.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!debouncedSearch.trim()) {
        setProducts([])
        return
      }

      setLoading(true)
      try {
        const data = await fetchProducts({ search: debouncedSearch, limit: 20 })
        if (!cancelled) setProducts(data)
      } catch {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  // Refresh stock snapshots for products already in the draft.
  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const ids = draft.lines
        .filter((line) => line.stockSnapshot !== null)
        .map((line) => line.productId)
      if (ids.length === 0) return

      try {
        const fresh = await fetchStock(ids)
        if (cancelled) return

        const next = draft.lines.map((line) => {
          const updated = fresh[line.productId]
          return updated !== undefined ? { ...line, stockSnapshot: updated } : line
        })
        $saleDraft.set({ ...draft, lines: next })
      } catch {
        // Advisory refresh — keep stale snapshots on failure.
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddProduct = (product: Product) => {
    addLine({
      productId: product.id,
      sku: product.sku ?? '',
      name: product.nombre,
      quantity: 1,
      unitPrice: product.precio_venta,
      stockSnapshot: product.stock,
    })
    setSearch('')
    setDebouncedSearch('')
    setProducts([])
  }

  const handleQuantityChange = (line: SaleLine, qty: number) => {
    setQuantity(line.productId, qty)
  }

  const handleConfirm = async () => {
    if (!canConfirm || isSubmitting) return

    setIsSubmitting(true)
    setFlaggedProductId(null)

    try {
      const ventaId = await confirmSale(draft.lines, draft.medioPago)
      clearDraft()
      navigate(`/venta/${ventaId}/ticket`, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const parsed = parseRpcError(message)

      if (parsed.kind === 'stock_insuficiente') {
        setFlaggedProductId(parsed.productId)
        showToast(
          `Stock insuficiente: disponible ${parsed.available}, pedido ${parsed.requested}`,
          'error'
        )
      } else if (parsed.kind === 'usuario_inactivo') {
        $auth.set({ ...$auth.get(), session: null, user: null, status: 'locked' })
      } else {
        showToast(message, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader title="Nueva venta" />

      <div className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[14px]">
        <div className="flex items-center gap-[10px]">
          <div className="flex-1 min-w-0">
            <SearchInput
              placeholder="Buscar producto…"
              value={search}
              onChange={(value) => setSearch(value)}
            />
          </div>
          <button
            type="button"
            aria-label="Escanear código"
            onClick={() => navigate('/escaner')}
            className="shrink-0 flex items-center justify-center w-[42px] h-[42px] rounded-card bg-madera text-bg-pantalla"
          >
            <BarcodeIcon size={22} weight="fill" />
          </button>
        </div>

        {debouncedSearch.trim() ? (
          <div className="space-y-[2px]">
            {loading ? (
              <p className="text-center text-text-secondary text-[14px] py-[20px]">Buscando…</p>
            ) : products.length === 0 ? (
              <p className="text-center text-text-secondary text-[14px] py-[20px]">
                No se encontraron productos
              </p>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => handleAddProduct(product)}
                />
              ))
            )}
          </div>
        ) : null}

        {draft.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[60px] gap-[16px]">
            <p className="text-text-secondary text-[14px] text-center">
              Tu carrito está vacío.
              <br />
              Buscá un producto o escaneá su código.
            </p>
            <button
              type="button"
              onClick={() => navigate('/escaner')}
              className="px-[20px] py-[10px] rounded-card bg-madera text-bg-pantalla font-medium text-[14px]"
            >
              Escanear producto
            </button>
          </div>
        ) : (
          <div className="space-y-[10px]">
            {draft.lines.map((line) => {
              const isFlagged =
                flaggedProductId === line.productId ||
                (line.stockSnapshot !== null && line.quantity > line.stockSnapshot)
              return (
                <div
                  key={line.productId}
                  className={`rounded-card bg-bg-card border p-[14px] space-y-[10px] ${
                    isFlagged ? 'border-stock-out' : 'border-border-sand'
                  }`}
                >
                  <div className="flex justify-between items-start gap-[12px]">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-text-primary truncate">
                        {line.name}
                      </p>
                      <p className="text-[12px] text-text-secondary truncate">{line.sku || '—'}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Eliminar línea"
                      onClick={() => removeLine(line.productId)}
                      className="shrink-0 text-text-muted hover:text-stock-out"
                    >
                      <TrashIcon size={18} weight="fill" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <Stepper
                      quantity={line.quantity}
                      max={line.stockSnapshot ?? undefined}
                      allowZero
                      onChange={(qty) => handleQuantityChange(line, qty)}
                    />
                    <div className="text-right">
                      <p className="text-[13px] text-text-secondary">
                        {line.quantity} × {formatPrice(line.unitPrice)}
                      </p>
                      <p className="text-[15px] font-semibold text-text-primary">
                        {formatPrice(line.quantity * line.unitPrice)}
                      </p>
                    </div>
                  </div>

                  {isFlagged ? (
                    <p className="text-[12px] text-stock-out">
                      Sin stock suficiente (disponible: {line.stockSnapshot ?? '—'})
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-bg-card border-t border-border-sand-light px-[16px] pt-[12px] pb-[8px] space-y-[12px]">
        <div className="flex justify-between items-center">
          <span className="text-[14px] text-text-secondary">Total</span>
          <span className="text-[22px] font-bold text-text-primary">{formatPrice(total)}</span>
        </div>

        <div className="flex gap-[8px] overflow-x-auto pb-[2px] scrollbar-hide">
          {MEDIOS_PAGO.map((medio) => {
            const active = draft.medioPago === medio
            return (
              <button
                key={medio}
                type="button"
                aria-pressed={active}
                onClick={() => setMedioPago(medio)}
                className={`shrink-0 px-[14px] py-[6px] rounded-full text-[13px] font-medium border transition-colors ${
                  active
                    ? 'bg-madera text-bg-pantalla border-madera'
                    : 'bg-bg-pantalla text-text-primary border-border-sand'
                }`}
              >
                {MEDIO_PAGO_LABELS[medio]}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full py-[14px] rounded-card bg-corteza text-bg-pantalla font-semibold text-[16px] disabled:opacity-50 transition-opacity"
        >
          {isSubmitting
            ? 'Confirmando…'
            : draft.lines.length === 0
              ? 'Confirmar venta'
              : `Confirmar venta · ${formatPrice(total)}`}
        </button>
      </div>

      <BottomNav active="venta" onNavigate={(path) => navigate(path)} />
    </div>
  )
}
