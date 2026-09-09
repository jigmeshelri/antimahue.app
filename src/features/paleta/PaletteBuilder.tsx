/**
 * PaletteBuilder — the palette-in-progress list (REQ-CPA-6).
 *
 * Reorder is tap-to-move (D6, no drag-and-drop): up/down buttons swap a
 * product with its neighbor, no-op at the list boundaries (enforced by
 * `paletaStore.moveSelected`, this component only disables the buttons at
 * the edges for a clearer affordance).
 */
import { CaretDownIcon, CaretUpIcon, XIcon } from '@phosphor-icons/react'
import type { Product } from '../catalogo/catalogoTypes'

interface PaletteBuilderProps {
  selected: Product[]
  onRemove: (productId: string) => void
  onMove: (productId: string, direction: 'up' | 'down') => void
}

export default function PaletteBuilder({ selected, onRemove, onMove }: PaletteBuilderProps) {
  if (selected.length === 0) {
    return (
      <p className="text-center text-text-secondary text-[14px] py-[16px]">
        Agregá hilados sugeridos para armar tu paleta
      </p>
    )
  }

  return (
    <div className="space-y-[2px]">
      {selected.map((product, index) => (
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
            <p className="text-[13px] font-medium text-text-primary truncate">{product.nombre}</p>
            <p className="text-[11px] text-text-secondary truncate">
              {product.color_nombre ?? product.color_hex}
            </p>
          </div>
          <div className="flex items-center gap-[2px] shrink-0">
            <button
              type="button"
              aria-label={`Subir ${product.nombre}`}
              disabled={index === 0}
              onClick={() => onMove(product.id, 'up')}
              className="w-[30px] h-[30px] flex items-center justify-center text-text-secondary disabled:opacity-30"
            >
              <CaretUpIcon size={16} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Bajar ${product.nombre}`}
              disabled={index === selected.length - 1}
              onClick={() => onMove(product.id, 'down')}
              className="w-[30px] h-[30px] flex items-center justify-center text-text-secondary disabled:opacity-30"
            >
              <CaretDownIcon size={16} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Quitar ${product.nombre}`}
              onClick={() => onRemove(product.id)}
              className="w-[30px] h-[30px] flex items-center justify-center text-stock-out"
            >
              <XIcon size={16} weight="bold" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
