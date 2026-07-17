/**
 * CatalogScreen — catalogo feature (Screen 6).
 *
 * Lists products with search, type filters and client-side pagination.
 * Create button is shown only for admins (UX concealment; real guard is RPC).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import { PlusIcon } from '@phosphor-icons/react'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import SearchInput from '@/components/molecules/SearchInput'
import FilterChips, { type FilterChipValue } from '@/components/molecules/FilterChips'
import ProductCard from '@/components/molecules/ProductCard'
import BottomNav from '@/components/organisms/BottomNav'
import { $auth } from '@/stores/auth'
import { fetchProducts } from './catalogoApi'
import type { Product } from './catalogoTypes'

const PAGE_SIZE = 50

export default function CatalogScreen() {
  const navigate = useNavigate()
  const auth = useStore($auth)
  const isAdmin = auth.rol === 'admin'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tipo, setTipo] = useState<FilterChipValue>('todos')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Debounce search input (DD-1: 300 ms).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Load products whenever filters or pagination change.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchProducts({
          search: debouncedSearch || undefined,
          tipo,
          limit: PAGE_SIZE,
          offset,
        })
        if (cancelled) return
        setProducts((prev) => (offset === 0 ? data : [...prev, ...data]))
        setHasMore(data.length === PAGE_SIZE)
      } catch {
        if (cancelled) return
        setError('No se pudo cargar el catálogo')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, tipo, offset])

  const handleProductClick = (productId: string) => {
    navigate(`/catalogo/${productId}`)
  }

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader
        title="Catálogo"
        rightAction={
          isAdmin ? (
            <button
              type="button"
              aria-label="Crear producto"
              onClick={() => navigate('/catalogo/new')}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-black/[0.14] text-[#FAF0E0]"
            >
              <PlusIcon size={20} weight="bold" />
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[14px]">
        <SearchInput
          placeholder="Buscar producto…"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setOffset(0)
          }}
        />

        <FilterChips
          value={tipo}
          onChange={(value) => {
            setTipo(value)
            setOffset(0)
          }}
        />

        {error ? (
          <div className="rounded-card bg-stock-out-bg text-stock-out p-[16px] text-center text-[14px]">
            {error}
          </div>
        ) : null}

        {!error && products.length === 0 && !loading ? (
          <div className="text-center text-text-secondary text-[14px] py-[40px]">
            No hay productos
          </div>
        ) : null}

        <div className="space-y-[2px]">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onClick={handleProductClick} />
          ))}
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            disabled={loading}
            className="w-full py-[12px] rounded-card bg-bg-card border border-border-sand text-[14px] font-medium text-text-primary disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Cargar más'}
          </button>
        ) : null}
      </div>

      <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
    </div>
  )
}
