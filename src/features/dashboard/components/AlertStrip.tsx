/**
 * AlertStrip — top-of-body warning when stock alerts exist.
 */
import { WarningCircleIcon } from '@phosphor-icons/react'

interface AlertStripProps {
  alertCount: number
  onNavigate: (path: string) => void
}

export default function AlertStrip({ alertCount, onNavigate }: AlertStripProps) {
  if (alertCount === 0) return null

  return (
    <button
      type="button"
      onClick={() => onNavigate('/catalogo')}
      className="flex w-full items-center gap-[9px] rounded-card-sm border border-terracota-alert-border bg-terracota-alert-bg p-[10px_13px] text-left"
    >
      <WarningCircleIcon size={17} weight="fill" className="shrink-0 text-stock-out" />
      <span className="flex-1 text-[13px] font-medium text-error">
        Tienes productos con stock bajo
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-madera">Ver →</span>
    </button>
  )
}
