/**
 * CatalogScreen integration tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import type { Product } from './catalogoTypes'

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
}))

vi.mock('./catalogoApi', () => ({
  fetchProducts: mocks.fetchProducts,
}))

vi.mock('@/stores/auth', async () => {
  const { atom } = await import('nanostores')
  return {
    $auth: atom({ rol: 'admin' as 'admin' | 'empleado' | null }),
  }
})

import CatalogScreen from './CatalogScreen'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: '123456',
    nombre: 'Lana Merino',
    tipo: 'lana',
    marca: 'Merino',
    grosor: 'Fino',
    peso_metraje: '50g',
    color_nombre: 'Rojo',
    color_hex: '#C84A3A',
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

function renderScreen(initialEntries: string[] = ['/catalogo']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/catalogo" element={<CatalogScreen />} />
        <Route path="/catalogo/new" element={<div>NewScreen</div>} />
        <Route path="/catalogo/:id" element={<div>DetailScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CatalogScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchProducts.mockResolvedValue([makeProduct()])
  })

  it('should_render_header_and_search', async () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar producto…')).toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchProducts).toHaveBeenCalled())
  })

  it('should_display_products_from_api', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Lana Merino')).toBeInTheDocument())
    expect(screen.getByText('$4.800')).toBeInTheDocument()
  })

  it('should_show_empty_state_when_no_products', async () => {
    mocks.fetchProducts.mockResolvedValue([])
    renderScreen()
    await waitFor(() => expect(screen.getByText('No hay productos')).toBeInTheDocument())
  })

  it('should_show_error_state_when_api_fails', async () => {
    mocks.fetchProducts.mockRejectedValue(new Error('fail'))
    renderScreen()
    await waitFor(() =>
      expect(screen.getByText('No se pudo cargar el catálogo')).toBeInTheDocument()
    )
  })

  it('should_call_fetchProducts_with_search_after_debounce', async () => {
    renderScreen()
    const input = screen.getByPlaceholderText('Buscar producto…')
    await userEvent.type(input, 'lana')
    await waitFor(() =>
      expect(mocks.fetchProducts).toHaveBeenCalledWith(expect.objectContaining({ search: 'lana' }))
    )
  })

  it('should_call_fetchProducts_with_selected_type', async () => {
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Hilo' }))
    await waitFor(() =>
      expect(mocks.fetchProducts).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'hilo' }))
    )
  })

  it('should_show_create_button_for_admin', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByLabelText('Crear producto')).toBeInTheDocument())
  })

  it('should_navigate_to_new_product_when_plus_clicked', async () => {
    renderScreen()
    await userEvent.click(await screen.findByLabelText('Crear producto'))
    await waitFor(() => expect(screen.getByText('NewScreen')).toBeInTheDocument())
  })

  it('should_navigate_to_detail_when_product_clicked', async () => {
    renderScreen()
    await userEvent.click(await screen.findByText('Lana Merino'))
    await waitFor(() => expect(screen.getByText('DetailScreen')).toBeInTheDocument())
  })

  it('should_load_more_when_button_clicked', async () => {
    mocks.fetchProducts
      .mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, i) => makeProduct({ id: `p${i}`, nombre: `Product ${i}` }))
      )
      .mockResolvedValueOnce([makeProduct({ id: 'p-more', nombre: 'More Product' })])
    renderScreen()
    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(screen.getByText('More Product')).toBeInTheDocument())
  })
})
