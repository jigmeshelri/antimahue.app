/**
 * SuggestionGrid — step 3 of the palette assistant (REQ-CPA-4, REQ-CPA-5).
 *
 * Renders one section per theoretical target color with the closest real
 * products, closest first. Out-of-stock suggestions are shown disabled
 * (never hidden — resolves design.md's open question in favor of "flag,
 * don't hide") so Angélica can still offer to note an encargo for them.
 */
import StockBadge from '@/components/atoms/StockBadge'
import { hslToHex, type Hsl, type SuggestedProduct } from './paletaUtils'
import type { Product } from '../catalogo/catalogoTypes'

interface SuggestionGridProps {
  targets: Hsl[]
  suggestions: SuggestedProduct[]
  selectedIds: Set<string>
  onAdd: (product: Product) => void
  /** Max suggestions shown per target, closest first. */
  maxPerTarget?: number
}

export default function SuggestionGrid({
  targets,
  suggestions,
  selectedIds,
  onAdd,
  maxPerTarget = 5,
}: SuggestionGridProps) {
  if (targets.length === 0) {
    return (
      <p className="text-center text-text-secondary text-[14px] py-[16px]">
        Elige un hilado base para ver sugerencias
      </p>
    )
  }

  return (
    <div className="space-y-[16px]">
      {targets.map((target, targetIndex) => {
        const forTarget = suggestions
          .filter((suggestion) => suggestion.targetIndex === targetIndex)
          .slice(0, maxPerTarget)

        return (
          <div key={targetIndex} className="space-y-[8px]">
            <div className="flex items-center gap-[8px]">
              <span
                aria-hidden="true"
                className="w-[20px] h-[20px] rounded-full border border-border-sand"
                style={{ backgroundColor: hslToHex(target) }}
              />
              <h2 className="text-[13px] font-semibold text-text-primary">
                Opción {targetIndex + 1}
              </h2>
            </div>

            {forTarget.length === 0 ? (
              <p className="text-[13px] text-text-secondary pl-[28px]">
                Sin hilados de ese color en el catálogo
              </p>
            ) : (
              <div className="space-y-[2px]">
                {forTarget.map(({ product, stockStatus }) => {
                  const isOutOfStock = stockStatus === 'out'
                  const isAdded = selectedIds.has(product.id)
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-[10px] py-[8px] border-b border-border-sand-light last:border-b-0"
                    >
                      <span
                        aria-hidden="true"
                        className="w-[28px] h-[28px] rounded-full shrink-0 border border-border-sand"
                        style={{ backgroundColor: product.color_hex ?? 'transparent' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {product.nombre}
                        </p>
                        <p className="text-[11px] text-text-secondary truncate">
                          {product.color_nombre ?? product.color_hex}
                        </p>
                      </div>
                      <StockBadge stock={product.stock} stockMinimo={product.stock_minimo} />
                      <button
                        type="button"
                        disabled={isOutOfStock || isAdded}
                        onClick={() => onAdd(product)}
                        className="shrink-0 px-[10px] py-[6px] rounded-[8px] text-[12px] font-semibold bg-madera text-bg-pantalla disabled:opacity-40"
                      >
                        {isAdded ? 'Agregado' : 'Agregar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
