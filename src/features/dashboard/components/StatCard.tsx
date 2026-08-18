/**
 * StatCard — small dashboard metric card.
 */
import type { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  subtitle?: string
}

export default function StatCard({ icon, label, value, subtitle }: StatCardProps) {
  return (
    <div className="flex-1 rounded-card border border-border-sand bg-bg-card p-[13px_14px]">
      <div className="mb-[8px] flex items-center gap-[6px]">
        <span className="text-text-secondary">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
          {label}
        </span>
      </div>
      <p className="text-[22px] font-bold tracking-[-0.03em] text-text-primary">{value}</p>
      {subtitle ? <p className="mt-[2px] text-[11px] text-text-secondary">{subtitle}</p> : null}
    </div>
  )
}
