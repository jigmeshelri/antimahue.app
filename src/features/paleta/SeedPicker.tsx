/**
 * SeedPicker — step 1 of the palette assistant (REQ-CPA-1).
 *
 * Lists catalog products that already carry a `color_hex` (the caller is
 * expected to pass only colored products — `paletaApi.fetchColoredProducts`
 * already filters server-side; this component adds no further filtering
 * beyond text search, since a product without `color_hex` should never
 * reach it).
 */
import { useState } from 'react'
import SearchInput from '@/components/molecules/SearchInput'
import type { Product } from '../catalogo/catalogoTypes'

interface SeedPickerProps {
  products: Product[]
  seedId: string | null
  onSelect: (productId: string) => void
}

/**
 * Case- and accent-insensitive comparison key: "Algodón" and "algodon"
 * search the same, and the color name counts as much as the product name
 * because Angélica thinks in colors ("rojo fuego"), not in SKUs.
 */
function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function SeedPicker({ products, seedId, onSelect }: SeedPickerProps) {
  const [search, setSearch] = useState('')

  const query = normalizeForSearch(search)
  const filtered = query
    ? products.filter((product) =>
        [product.nombre, product.color_nombre].some(
          (field) => field != null && normalizeForSearch(field).includes(query)
        )
      )
    : products

  return (
    <div className="space-y-[10px]">
      <SearchInput placeholder="Buscar ovillo…" value={search} onChange={setSearch} />

      {filtered.length === 0 ? (
        <p className="text-center text-text-secondary text-[14px] py-[16px]">
          {products.length === 0
            ? 'No hay hilados con color registrado'
            : `Sin resultados para «${search.trim()}»`}
        </p>
      ) : (
        <div className="flex gap-[10px] overflow-x-auto pb-[4px] scrollbar-hide">
          {filtered.map((product) => {
            const isSelected = product.id === seedId
            return (
              <button
                key={product.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(product.id)}
                className={`shrink-0 w-[76px] flex flex-col items-center gap-[6px] p-[8px] rounded-card border ${
                  isSelected ? 'border-madera bg-bg-card' : 'border-border-sand bg-bg-card/60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-[36px] h-[36px] rounded-full border border-border-sand"
                  style={{ backgroundColor: product.color_hex ?? 'transparent' }}
                />
                <span className="text-[11px] font-medium text-text-primary text-center truncate w-full">
                  {product.nombre}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
