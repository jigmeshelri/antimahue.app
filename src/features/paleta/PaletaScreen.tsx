/**
 * PaletaScreen — color-palette assistant (Screen 10, net-new — absent from
 * the 9-screen hi-fi handoff, added by this SDD change).
 *
 * Orchestrates the three steps described in design.md's Data Flow: seed
 * selection → harmony rule → mapped suggestions → palette builder, plus the
 * two closing actions (share via WhatsApp, save an out-of-stock encargo
 * note). Everything lives on one scrollable screen (phone-first, no wizard
 * navigation) so Angélica can iterate seed/rule at the counter without
 * losing her place.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import BottomNav from '@/components/organisms/BottomNav'
import { $auth } from '@/stores/auth'
import { showToast } from '@/stores/ui'
import type { Product } from '../catalogo/catalogoTypes'
import SeedPicker from './SeedPicker'
import HarmonySelector from './HarmonySelector'
import SuggestionGrid from './SuggestionGrid'
import PaletteBuilder from './PaletteBuilder'
import {
  $colorPalette,
  addToPalette,
  clearPalette,
  moveSelected,
  removeFromPalette,
  setNote,
  setRule,
  setSeed,
} from './paletaStore'
import { buildWhatsappShareUrl, findClosestYarns, generateTargets, type Hsl } from './paletaUtils'
import { fetchColoredProducts, savePedidoPendiente } from './paletaApi'

export default function PaletaScreen() {
  const navigate = useNavigate()
  const auth = useStore($auth)
  const isAdmin = auth.rol === 'admin'
  const palette = useStore($colorPalette)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSavingEncargo, setIsSavingEncargo] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchColoredProducts()
        if (!cancelled) setProducts(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const seed = useMemo(
    () => products.find((product) => product.id === palette.seedId) ?? null,
    [products, palette.seedId]
  )

  const seedHsl: Hsl | null = useMemo(
    () =>
      seed && seed.color_h != null && seed.color_s != null && seed.color_l != null
        ? { h: seed.color_h, s: seed.color_s, l: seed.color_l }
        : null,
    [seed]
  )

  const targets = useMemo(
    () => (seedHsl ? generateTargets(seedHsl, palette.rule) : []),
    [seedHsl, palette.rule]
  )

  const suggestions = useMemo(() => {
    if (!seed) return []
    const candidates = products.filter((product) => product.id !== seed.id)
    return findClosestYarns(targets, candidates)
  }, [targets, products, seed])

  const selectedIds = useMemo(() => new Set(palette.selected.map((p) => p.id)), [palette.selected])

  const handleShare = () => {
    window.open(buildWhatsappShareUrl(palette.selected), '_blank', 'noopener')
  }

  const handleSaveEncargo = async () => {
    if (isSavingEncargo || !palette.note.trim()) return

    setIsSavingEncargo(true)
    try {
      const colores = palette.selected
        .filter(
          (
            product
          ): product is Product & {
            color_hex: string
            color_h: number
            color_s: number
            color_l: number
          } =>
            product.color_hex != null &&
            product.color_h != null &&
            product.color_s != null &&
            product.color_l != null
        )
        .map((product) => ({
          color_hex: product.color_hex,
          color_h: product.color_h,
          color_s: product.color_s,
          color_l: product.color_l,
        }))

      await savePedidoPendiente({ nota: palette.note, colores })
      setNote('')
      showToast('Encargo guardado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setIsSavingEncargo(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader title="Asistente de color" />

      <div className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[20px]">
        {error ? (
          <div className="rounded-card bg-stock-out-bg text-stock-out p-[16px] text-center text-[14px]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-center text-text-secondary text-[14px] py-[16px]">Cargando…</p>
        ) : (
          <>
            <section className="space-y-[10px]">
              <h2 className="text-[14px] font-semibold text-text-primary">
                1. Elige un hilado base
              </h2>
              <SeedPicker products={products} seedId={palette.seedId} onSelect={setSeed} />
            </section>

            <section className="space-y-[10px]">
              <h2 className="text-[14px] font-semibold text-text-primary">2. Elige una armonía</h2>
              <HarmonySelector value={palette.rule} onChange={setRule} />
            </section>

            <section className="space-y-[10px]">
              <h2 className="text-[14px] font-semibold text-text-primary">
                3. Sugerencias del catálogo
              </h2>
              <SuggestionGrid
                targets={targets}
                suggestions={suggestions}
                selectedIds={selectedIds}
                onAdd={addToPalette}
              />
            </section>

            <section className="space-y-[10px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-text-primary">Tu paleta</h2>
                {palette.selected.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearPalette}
                    className="text-[12px] font-medium text-text-secondary"
                  >
                    Vaciar
                  </button>
                ) : null}
              </div>
              <PaletteBuilder
                selected={palette.selected}
                onRemove={removeFromPalette}
                onMove={moveSelected}
              />
            </section>

            {palette.selected.length > 0 ? (
              <section>
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full py-[12px] rounded-card bg-corteza text-bg-pantalla font-semibold text-[14px]"
                >
                  Compartir por WhatsApp
                </button>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="space-y-[10px]">
                <h2 className="text-[14px] font-semibold text-text-primary">
                  ¿Falta un color? Anota el encargo
                </h2>
                <textarea
                  value={palette.note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nombre y teléfono del cliente, color que busca…"
                  rows={3}
                  className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary placeholder:text-text-secondary outline-none"
                />
                <button
                  type="button"
                  disabled={isSavingEncargo || !palette.note.trim()}
                  onClick={() => void handleSaveEncargo()}
                  className="w-full py-[12px] rounded-card bg-madera text-bg-pantalla font-semibold text-[14px] disabled:opacity-50"
                >
                  {isSavingEncargo ? 'Guardando…' : 'Anotar encargo'}
                </button>
              </section>
            ) : null}
          </>
        )}
      </div>

      <BottomNav active="paleta" onNavigate={(path) => navigate(path)} />
    </div>
  )
}
