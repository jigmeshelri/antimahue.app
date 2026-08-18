/**
 * StockAlertList — low-stock / out-of-stock product alerts.
 */
import type { StockAlert } from '../dashboardTypes'
import { classifyAlert } from '../dashboardUtils'

interface StockAlertListProps {
  alerts: StockAlert[]
  onNavigate: (path: string) => void
}

export default function StockAlertList({ alerts, onNavigate }: StockAlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-card border border-border-sand bg-bg-card p-[16px] text-center">
        <p className="text-[14px] text-text-secondary">No hay alertas de stock</p>
      </div>
    )
  }

  return (
    <div className="space-y-[10px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-text-primary">Alertas de stock</h2>
        <button
          type="button"
          onClick={() => onNavigate('/catalogo')}
          className="text-[12px] font-semibold text-madera"
        >
          Ver todo
        </button>
      </div>

      <div className="space-y-[8px]">
        {alerts.map((alert) => {
          const level = classifyAlert(alert)
          const isOut = level === 'agotado'

          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => onNavigate(`/catalogo/${alert.id}`)}
              className={`flex w-full items-center gap-[10px] rounded-card border p-[10px_13px] text-left ${
                isOut ? 'border-stock-out-border bg-[#FEF5F2]' : 'border-border-sand bg-bg-card'
              }`}
            >
              <span
                aria-hidden
                className={`h-[8px] w-[8px] shrink-0 rounded-full ${
                  isOut ? 'bg-stock-out' : 'bg-stock-low'
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-text-primary">{alert.nombre}</p>
                <p className="text-[11px] text-text-secondary">
                  {alert.stock} en stock · mínimo {alert.stock_minimo}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-badge px-[8px] py-[3px] text-[11px] font-semibold ${
                  isOut ? 'bg-stock-out-bg text-stock-out' : 'bg-[#E8D5B7] text-madera'
                }`}
              >
                {isOut ? 'Agotado' : 'Bajo'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
