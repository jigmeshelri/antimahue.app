/**
 * TicketView — venta feature (Screen 5).
 *
 * Displays a confirmed sale receipt, supports printing, WhatsApp sharing
 * and undoing the last confirmed sale.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useStore } from '@nanostores/react'
import { PrinterIcon, WhatsappLogoIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import BottomNav from '@/components/organisms/BottomNav'
import { $auth } from '@/stores/auth'
import { showToast } from '@/stores/ui'
import { fetchVenta, fetchStoreName, undoSale } from './ventaApi'
import {
  buildWhatsAppText,
  formatTicketDate,
  MEDIO_PAGO_LABELS,
  parseRpcError,
  shortRef,
} from './ventaUtils'
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import type { Venta } from './ventaTypes'

export default function TicketView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const auth = useStore($auth)

  const [venta, setVenta] = useState<Venta | null>(null)
  const [storeName, setStoreName] = useState('Antimahue')
  const [loading, setLoading] = useState(true)
  const [isUndoing, setIsUndoing] = useState(false)
  const [undoConfirm, setUndoConfirm] = useState(false)
  const [undoHidden, setUndoHidden] = useState(false)

  const isOwnSale = useMemo(
    () => !!auth.user && !!venta?.actor_id && auth.user.id === venta.actor_id,
    [auth.user, venta?.actor_id]
  )

  const sellerName = useMemo(() => {
    if (!isOwnSale || !auth.user) return undefined
    const metadata = auth.user.user_metadata as { display_name?: string } | undefined
    return metadata?.display_name ?? auth.user.email?.split('@')[0] ?? undefined
  }, [isOwnSale, auth.user])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [v, store] = await Promise.all([fetchVenta(id), fetchStoreName()])
        if (cancelled) return
        setVenta(v)
        setStoreName(store)
      } catch {
        if (!cancelled) setVenta(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  const handleWhatsApp = () => {
    if (!venta) return
    const text = buildWhatsAppText(venta, storeName, sellerName)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleUndo = async () => {
    if (!venta || isUndoing) return

    if (!undoConfirm) {
      setUndoConfirm(true)
      return
    }

    setIsUndoing(true)
    try {
      await undoSale(venta.id)
      const refreshed = await fetchVenta(venta.id)
      setVenta(refreshed)
      showToast('Venta deshecha', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const parsed = parseRpcError(message)
      showToast(message, 'error')
      if (parsed.kind === 'not_last_sale') {
        setUndoHidden(true)
      }
    } finally {
      setIsUndoing(false)
    }
  }

  const handleNewSale = () => {
    navigate('/venta', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-bg-pantalla">
        <ScreenHeader title="Ticket" onBack={() => navigate('/venta')} />
        <div className="flex-1 flex items-center justify-center text-text-secondary text-[14px]">
          Cargando…
        </div>
        <BottomNav active="venta" onNavigate={(path) => navigate(path)} />
      </div>
    )
  }

  if (!venta) {
    return (
      <div className="flex flex-col h-screen bg-bg-pantalla">
        <ScreenHeader title="Ticket" onBack={() => navigate('/venta')} />
        <div className="flex-1 flex flex-col items-center justify-center px-[24px] gap-[16px]">
          <p className="text-text-secondary text-[14px] text-center">
            Venta no encontrada o no accesible.
          </p>
          <button
            type="button"
            onClick={handleNewSale}
            className="px-[20px] py-[10px] rounded-card bg-madera text-bg-pantalla font-medium text-[14px]"
          >
            Nueva venta
          </button>
        </div>
        <BottomNav active="venta" onNavigate={(path) => navigate(path)} />
      </div>
    )
  }

  const isCancelled = venta.estado === 'deshecha'
  const showActions = !isCancelled

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader title="Ticket" onBack={() => navigate('/venta')} />

      <div className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[14px]">
        {isCancelled ? (
          <div className="rounded-card bg-success-bg border border-success-border px-[16px] py-[12px] text-center text-success text-[14px] font-medium no-print">
            Venta deshecha
          </div>
        ) : (
          <div className="rounded-card bg-success-bg border border-success-border px-[16px] py-[12px] text-center text-success text-[14px] font-medium no-print">
            Venta confirmada
          </div>
        )}

        {/* On-screen receipt card */}
        <div
          data-testid="receipt-card"
          className="rounded-card bg-bg-card border border-border-sand p-[16px] space-y-[14px] no-print"
        >
          <div className="text-center space-y-[4px] pb-[12px] border-b border-dashed border-border-sand">
            <h2 className="text-[18px] font-semibold text-text-primary tracking-wide">
              {storeName.toUpperCase()}
            </h2>
            <p className="text-[12px] text-text-secondary">lanas y tejidos artesanales</p>
          </div>

          <div className="space-y-[6px] text-[13px] pb-[12px] border-b border-dashed border-border-sand">
            <div className="flex justify-between">
              <span className="text-text-secondary">Fecha</span>
              <span className="text-text-primary">{formatTicketDate(venta.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Ticket N°</span>
              <span className="text-text-primary">#{shortRef(venta.id)}</span>
            </div>
            {sellerName ? (
              <div className="flex justify-between">
                <span className="text-text-secondary">Vendedora</span>
                <span className="text-text-primary">{sellerName}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-[10px] pb-[12px] border-b border-dashed border-border-sand">
            {venta.items.map((item) => (
              <div key={item.id} className="space-y-[2px]">
                <p className="text-[14px] font-medium text-text-primary">{item.nombre}</p>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-secondary">
                    {item.cantidad} × {formatPrice(item.precio_unitario)}
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatPrice(item.cantidad * item.precio_unitario)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-[6px] pb-[4px]">
            <div className="flex justify-between text-[13px]">
              <span className="text-text-secondary">Medio de pago</span>
              <span className="text-text-primary font-medium">
                {MEDIO_PAGO_LABELS[venta.medio_pago]}
              </span>
            </div>
            <div className="flex justify-between text-[18px] font-bold text-text-primary">
              <span>TOTAL</span>
              <span>{formatPrice(venta.total)}</span>
            </div>
          </div>

          <div className="text-center text-[12px] text-text-secondary pt-[8px] border-t border-dashed border-border-sand">
            ¡Gracias por tu compra!
          </div>
        </div>

        {/* Print-only thermal ticket */}
        <div className="print-only hidden">
          <PrintTicket venta={venta} storeName={storeName} sellerName={sellerName} />
        </div>

        {showActions ? (
          <div className="space-y-[10px] no-print">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="w-full py-[14px] rounded-card bg-[#25D366] text-white font-semibold text-[15px] flex items-center justify-center gap-[8px]"
            >
              <WhatsappLogoIcon size={20} weight="fill" />
              Compartir por WhatsApp
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-[14px] rounded-card bg-bg-card border border-border-sand text-text-primary font-semibold text-[15px] flex items-center justify-center gap-[8px]"
            >
              <PrinterIcon size={20} weight="fill" />
              Imprimir ticket
            </button>

            {!undoHidden ? (
              <button
                type="button"
                onClick={handleUndo}
                disabled={isUndoing}
                className={`w-full py-[14px] rounded-card border font-semibold text-[15px] transition-colors ${
                  undoConfirm
                    ? 'bg-stock-out-bg border-stock-out text-stock-out'
                    : 'bg-bg-card border-error text-error'
                }`}
              >
                <span className="flex items-center justify-center gap-[8px]">
                  <ArrowCounterClockwiseIcon size={20} weight="fill" />
                  {undoConfirm ? '¿Confirmar? Toca de nuevo' : 'Deshacer última venta'}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleNewSale}
          className="w-full py-[14px] rounded-card bg-corteza text-bg-pantalla font-semibold text-[15px] no-print"
        >
          + Nueva venta
        </button>
      </div>

      <BottomNav active="venta" onNavigate={(path) => navigate(path)} />
    </div>
  )
}

interface PrintTicketProps {
  venta: Venta
  storeName: string
  sellerName?: string
}

function PrintTicket({ venta, storeName, sellerName }: PrintTicketProps) {
  return (
    <div className="w-[72mm] mx-auto text-black bg-white p-[4mm] font-mono text-[11px] leading-tight">
      <div className="text-center border-b border-dashed border-black pb-[8px] mb-[8px]">
        <p className="text-[14px] font-bold tracking-wider">{storeName.toUpperCase()}</p>
        <p className="text-[9px] text-gray-600">lanas y tejidos artesanales</p>
      </div>

      <div className="border-b border-dashed border-black pb-[8px] mb-[8px]">
        <div className="flex justify-between">
          <span>Fecha</span>
          <span>{formatTicketDate(venta.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ticket N°</span>
          <span>#{shortRef(venta.id)}</span>
        </div>
        {sellerName ? (
          <div className="flex justify-between">
            <span>Vendedora</span>
            <span>{sellerName}</span>
          </div>
        ) : null}
      </div>

      <div className="border-b border-dashed border-black pb-[8px] mb-[8px]">
        {venta.items.map((item) => (
          <div key={item.id} className="mb-[6px]">
            <p className="font-medium text-[12px]">{item.nombre}</p>
            <div className="flex justify-between">
              <span>
                {item.cantidad} × {formatPrice(item.precio_unitario)}
              </span>
              <span>{formatPrice(item.cantidad * item.precio_unitario)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-black pb-[8px] mb-[8px]">
        <div className="flex justify-between">
          <span>Medio de pago</span>
          <span>{MEDIO_PAGO_LABELS[venta.medio_pago]}</span>
        </div>
        <div className="flex justify-between text-[13px] font-bold">
          <span>TOTAL</span>
          <span>{formatPrice(venta.total)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-600">
        <p>¡Gracias por tu compra!</p>
        <p>Producto 100% artesanal</p>
      </div>
    </div>
  )
}
