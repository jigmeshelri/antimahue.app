/**
 * PaymentBreakdown — four-column payment method totals.
 */
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import type { MedioPago } from '../dashboardTypes'

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transfer.',
  debito: 'Débito',
  credito: 'Crédito',
}

interface PaymentBreakdownProps {
  breakdown: Record<MedioPago, number>
}

export default function PaymentBreakdown({ breakdown }: PaymentBreakdownProps) {
  const medios: MedioPago[] = ['efectivo', 'transferencia', 'debito', 'credito']

  return (
    <div className="rounded-card border border-border-sand bg-bg-card p-[14px_0]">
      <div className="flex">
        {medios.map((medio) => (
          <div
            key={medio}
            className="flex flex-1 flex-col items-center border-r border-border-sand last:border-r-0"
          >
            <span className="mb-[4px] text-[10px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
              {MEDIO_LABELS[medio]}
            </span>
            <span className="text-[16px] font-semibold text-text-primary">
              {formatPrice(breakdown[medio] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
