import StockBadge from '@/components/atoms/StockBadge'
import { formatPrice, productSubtitle } from '@/features/catalogo/catalogoUtils'
import type { Product } from '@/features/catalogo/catalogoTypes'

interface ProductCardProps {
  product: Product
  onClick: (productId: string) => void
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(product.id)}
      className="flex items-center gap-[12px] w-full text-left py-[12px] border-b border-border-sand-light last:border-b-0"
    >
      <div
        className="w-[40px] h-[40px] rounded-card-sm shrink-0 border border-border-sand flex items-center justify-center"
        style={{ backgroundColor: product.color_hex ?? 'var(--color-bg-card)' }}
      >
        {product.imagen_url ? (
          <img
            src={product.imagen_url}
            alt=""
            className="w-full h-full object-cover rounded-card-sm"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-text-primary truncate">{product.nombre}</p>
        <p className="text-[11px] text-text-secondary truncate">{productSubtitle(product)}</p>
      </div>
      <div className="flex flex-col items-end gap-[4px] shrink-0">
        <span className="text-[13px] font-semibold text-text-primary">
          {formatPrice(product.precio_venta)}
        </span>
        <StockBadge stock={product.stock} stockMinimo={product.stock_minimo} />
      </div>
    </button>
  )
}
