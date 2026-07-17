/**
 * ProductDetailScreen integration tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import type { Product } from './catalogoTypes'

const mocks = vi.hoisted(() => ({
  fetchProductById: vi.fn(),
}))

vi.mock('./catalogoApi', () => ({
  fetchProductById: mocks.fetchProductById,
}))

vi.mock('@/stores/auth', async () => {
  const { atom } = await import('nanostores')
  return {
    $auth: atom({
      session: null,
      user: null,
      rol: 'admin' as 'admin' | 'empleado' | null,
      status: 'unlocked' as const,
      loading: false,
    }),
  }
})

const saleDraftMocks = vi.hoisted(() => ({
  addLine: vi.fn(),
}))

vi.mock('@/stores/saleDraft', () => ({
  $saleDraft: {
    get: vi.fn(() => ({ lines: [], note: '' })),
    subscribe: vi.fn(() => () => {}),
    set: vi.fn(),
  },
  addLine: saleDraftMocks.addLine,
}))

import ProductDetailScreen from './ProductDetailScreen'
import { $auth } from '@/stores/auth'

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
    producto_costos: { costo: 2400, proveedor_id: null },
    ...overrides,
  }
}

function renderScreen(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/${id}`]}>
      <Routes>
        <Route path="/catalogo/:id" element={<ProductDetailScreen />} />
        <Route path="/catalogo/:id/edit" element={<div>EditScreen</div>} />
        <Route path="/venta" element={<div>SaleScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProductDetailScreen', () => {
  function setRol(rol: 'admin' | 'empleado') {
    $auth.set({ session: null, user: null, rol, status: 'unlocked', loading: false })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setRol('admin')
    mocks.fetchProductById.mockResolvedValue(makeProduct())
  })

  it('should_render_product_name_and_price', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Lana Merino')).toBeInTheDocument())
    expect(screen.getByText('$4.800')).toBeInTheDocument()
  })

  it('should_show_not_found_when_product_missing', async () => {
    mocks.fetchProductById.mockResolvedValue(null)
    renderScreen()
    await waitFor(() => expect(screen.getByText('Producto no encontrado')).toBeInTheDocument())
  })

  it('should_show_admin_cost_card', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Costo')).toBeInTheDocument())
    expect(screen.getByText('$2.400')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should_hide_admin_cost_card_for_employee', async () => {
    setRol('empleado')
    renderScreen()
    await waitFor(() => expect(screen.getByText('Lana Merino')).toBeInTheDocument())
    expect(screen.queryByText('Costo')).not.toBeInTheDocument()
  })

  it('should_show_edit_button_for_admin', async () => {
    renderScreen()
    await userEvent.click(await screen.findByLabelText('Editar producto'))
    await waitFor(() => expect(screen.getByText('EditScreen')).toBeInTheDocument())
  })

  it('should_add_to_sale_draft', async () => {
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar a la venta' }))
    expect(saleDraftMocks.addLine).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p1',
        name: 'Lana Merino',
        quantity: 1,
        unitPrice: 4800,
      })
    )
  })
})
