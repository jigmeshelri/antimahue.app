/**
 * HarmonySelector — chips for the three harmony rules (REQ-CPA-2).
 * Mirrors the visual pattern of `FilterChips` (active/inactive chip styles).
 */
import type { HarmonyRule } from './paletaUtils'

interface HarmonySelectorProps {
  value: HarmonyRule
  onChange: (rule: HarmonyRule) => void
}

const OPTIONS: HarmonyRule[] = ['analogous', 'complementary', 'triadic']

const LABEL: Record<HarmonyRule, string> = {
  analogous: 'Análogos',
  complementary: 'Complementarios',
  triadic: 'Triádicos',
}

export default function HarmonySelector({ value, onChange }: HarmonySelectorProps) {
  return (
    <div className="flex gap-[8px] overflow-x-auto pb-[2px] scrollbar-hide">
      {OPTIONS.map((option) => {
        const isActive = option === value
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => option !== value && onChange(option)}
            className={`shrink-0 px-[14px] py-[6px] rounded-full text-[13px] font-medium border transition-colors ${
              isActive
                ? 'bg-madera text-bg-pantalla border-madera'
                : 'bg-bg-card text-text-primary border-border-sand'
            }`}
          >
            {LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}
