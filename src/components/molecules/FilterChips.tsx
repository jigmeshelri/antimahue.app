import { PRODUCT_TYPE_LABEL, type ProductType } from '@/features/catalogo/catalogoTypes'

export type FilterChipValue = ProductType | 'todos'

interface FilterChipsProps {
  value: FilterChipValue
  onChange: (value: FilterChipValue) => void
}

const OPTIONS: FilterChipValue[] = [
  'todos',
  'lana',
  'algodon',
  'hilo',
  'palillo',
  'crochet',
  'accesorio',
]

const LABEL: Record<FilterChipValue, string> = {
  todos: 'Todos',
  ...PRODUCT_TYPE_LABEL,
}

export default function FilterChips({ value, onChange }: FilterChipsProps) {
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
