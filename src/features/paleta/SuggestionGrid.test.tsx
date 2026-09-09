import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuggestionGrid from './SuggestionGrid'
import type { SuggestedProduct } from './paletaUtils'
import type { Product } from '../catalogo/catalogoTypes'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: '123456',
    nombre: 'Lana Merino Roja',
    tipo: 'lana',
    marca: 'Merino',
    grosor: 'Fino',
    peso_metraje: '50g',
    color_nombre: 'Rojo terracota',
    color_hex: '#C84A3A',
    color_h: 6,
    color_s: 61,
    color_l: 55,
    precio_venta: 4800,
    stock: 10,
    stock_minimo: 5,
    imagen_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    producto_costos: null,
    ...overrides,
  }
}

function makeSuggestion(overrides: Partial<SuggestedProduct> = {}): SuggestedProduct {
  return {
    product: makeProduct(),
    distance: 5,
    targetIndex: 0,
    stockStatus: 'ok',
    ...overrides,
  }
}

describe('SuggestionGrid', () => {
  it('should_show_a_prompt_when_there_are_no_targets_yet', () => {
    render(<SuggestionGrid targets={[]} suggestions={[]} selectedIds={new Set()} onAdd={vi.fn()} />)
    expect(screen.getByText('Elige un hilado base para ver sugerencias')).toBeInTheDocument()
  })

  it('should_render_one_section_per_target', () => {
    const targets = [
      { h: 180, s: 70, l: 50 },
      { h: 60, s: 70, l: 50 },
    ]
    render(
      <SuggestionGrid targets={targets} suggestions={[]} selectedIds={new Set()} onAdd={vi.fn()} />
    )
    expect(screen.getByText('Opción 1')).toBeInTheDocument()
    expect(screen.getByText('Opción 2')).toBeInTheDocument()
  })

  it('should_list_suggestions_under_their_matching_target_closest_first', () => {
    const targets = [{ h: 180, s: 70, l: 50 }]
    const suggestions = [
      makeSuggestion({ product: makeProduct({ id: 'p1', nombre: 'Lana Cercana' }), distance: 2 }),
      makeSuggestion({ product: makeProduct({ id: 'p2', nombre: 'Lana Lejana' }), distance: 20 }),
    ]
    render(
      <SuggestionGrid
        targets={targets}
        suggestions={suggestions}
        selectedIds={new Set()}
        onAdd={vi.fn()}
      />
    )
    expect(screen.getByText('Lana Cercana')).toBeInTheDocument()
    expect(screen.getByText('Lana Lejana')).toBeInTheDocument()
  })

  it('should_show_out_of_stock_suggestions_disabled_instead_of_hiding_them', () => {
    const targets = [{ h: 180, s: 70, l: 50 }]
    const suggestions = [
      makeSuggestion({
        product: makeProduct({ id: 'p1', nombre: 'Lana Agotada', stock: 0 }),
        stockStatus: 'out',
      }),
    ]
    render(
      <SuggestionGrid
        targets={targets}
        suggestions={suggestions}
        selectedIds={new Set()}
        onAdd={vi.fn()}
      />
    )
    expect(screen.getByText('Lana Agotada')).toBeInTheDocument()
    expect(screen.getByText('Agotado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled()
  })

  it('should_call_onAdd_with_the_product_when_agregar_is_tapped', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const product = makeProduct({ id: 'p1' })
    const targets = [{ h: 180, s: 70, l: 50 }]
    const suggestions = [makeSuggestion({ product })]
    render(
      <SuggestionGrid
        targets={targets}
        suggestions={suggestions}
        selectedIds={new Set()}
        onAdd={onAdd}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(onAdd).toHaveBeenCalledWith(product)
  })

  it('should_show_already_selected_suggestions_as_agregado_and_disabled', () => {
    const product = makeProduct({ id: 'p1' })
    const targets = [{ h: 180, s: 70, l: 50 }]
    const suggestions = [makeSuggestion({ product })]
    render(
      <SuggestionGrid
        targets={targets}
        suggestions={suggestions}
        selectedIds={new Set(['p1'])}
        onAdd={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: 'Agregado' })
    expect(button).toBeDisabled()
  })

  it('should_show_a_message_when_a_target_has_no_matching_products', () => {
    const targets = [{ h: 180, s: 70, l: 50 }]
    render(
      <SuggestionGrid targets={targets} suggestions={[]} selectedIds={new Set()} onAdd={vi.fn()} />
    )
    expect(screen.getByText('Sin hilados de ese color en el catálogo')).toBeInTheDocument()
  })
})
