/**
 * ProductFormScreen integration tests — create and edit flows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import type { Product } from './catalogoTypes'

const mocks = vi.hoisted(() => ({
  fetchProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('./catalogoApi', () => ({
  fetchProductById: mocks.fetchProductById,
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
}))

vi.mock('@/stores/auth', async () => {
  const { atom } = await import('nanostores')
  return {
    $auth: atom({ rol: 'admin' as 'admin' | 'empleado' | null }),
  }
})

import ProductFormScreen from './ProductFormScreen'

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

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/catalogo/new']}>
      <Routes>
        <Route path="/catalogo/new" element={<ProductFormScreen mode="create" />} />
        <Route path="/catalogo/:id" element={<div>DetailScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/${id}/edit`]}>
      <Routes>
        <Route path="/catalogo/:id/edit" element={<ProductFormScreen mode="edit" />} />
        <Route path="/catalogo/:id" element={<div>DetailScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function fillRequiredFields() {
  await userEvent.clear(screen.getByRole('textbox', { name: /nombre/i }))
  await userEvent.type(screen.getByRole('textbox', { name: /nombre/i }), 'Lana Nueva')
  await userEvent.clear(screen.getByRole('spinbutton', { name: /precio de venta/i }))
  await userEvent.type(screen.getByRole('spinbutton', { name: /precio de venta/i }), '5000')
}

describe('ProductFormScreen create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createProduct.mockResolvedValue('new-id')
  })

  it('should_render_create_title', () => {
    renderCreate()
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('should_show_validation_error_when_name_is_empty', async () => {
    renderCreate()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument())
  })

  it('should_call_createProduct_and_navigate_on_valid_submit', async () => {
    renderCreate()
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalled())
    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Lana Nueva',
        precio_venta: 5000,
      })
    )
    expect(screen.getByText('DetailScreen')).toBeInTheDocument()
  })
})

describe('ProductFormScreen edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchProductById.mockResolvedValue(makeProduct())
    mocks.updateProduct.mockResolvedValue(undefined)
  })

  it('should_render_edit_title', async () => {
    renderEdit()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Editar producto' })).toBeInTheDocument()
    )
  })

  it('should_prefill_form_with_product_data', async () => {
    renderEdit()
    await waitFor(() => expect(screen.getByDisplayValue('Lana Merino')).toBeInTheDocument())
    expect(screen.getByDisplayValue('4800')).toBeInTheDocument()
  })

  it('should_call_updateProduct_with_changes', async () => {
    renderEdit()
    await waitFor(() => expect(screen.getByDisplayValue('Lana Merino')).toBeInTheDocument())
    await userEvent.clear(screen.getByRole('textbox', { name: /nombre/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /nombre/i }), 'Lana Editada')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.updateProduct).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ nombre: 'Lana Editada' })
      )
    )
  })
})
