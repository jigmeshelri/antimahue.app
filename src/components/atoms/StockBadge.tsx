import { resolveStockStatus, type StockStatus } from '@/features/catalogo/catalogoUtils'

interface StockBadgeProps {
  stock: number
  stockMinimo: number | null
  defaultMinimo?: number
}

const LABEL: Record<StockStatus, string> = {
  ok: 'En stock',
  low: 'Bajo',
  out: 'Agotado',
}

const STYLE: Record<StockStatus, string> = {
  ok: 'bg-success-bg text-success border-success-border',
  low: 'bg-stock-low-bg text-stock-low border-border-sand',
  out: 'bg-stock-out-bg text-stock-out border-stock-out-border',
}

export default function StockBadge({ stock, stockMinimo, defaultMinimo = 5 }: StockBadgeProps) {
  const status = resolveStockStatus(stock, stockMinimo, defaultMinimo)

  return (
    <span
      className={`rounded-badge px-[8px] py-[3px] text-[11px] font-semibold border ${STYLE[status]}`}
    >
      {LABEL[status]}
    </span>
  )
}
