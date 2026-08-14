/**
 * SaleScreen tests — Phases 5 and 6 cart UI + confirm flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { $saleDraft, clearDraft } from '@/stores/saleDraft'
import { $auth } from '@/stores/auth'
import { $ui } from '@/stores/ui'
import type { Product } from '@/features/catalogo/catalogoTypes'
import type { AuthState } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  confirmSale: vi.fn(),
  fetchStock: vi.fn(),
}))

vi.mock('@/features/catalogo/catalogoApi', () => ({
  fetchProducts: mocks.fetchProducts,
}))

vi.mock('./ventaApi', () => ({
  confirmSale: mocks.confirmSale,
  fetchStock: mocks.fetchStock,
}))

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

function renderScreen(initialEntries: string[] = ['/venta']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/venta" element={<SaleScreen />} />
        <Route path="/escaner" element={<div>ScannerScreen</div>} />
        <Route path="/venta/:id/ticket" element={<div>TicketView</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function setAuth(partial: Partial<AuthState>) {
  $auth.set({
    session: null,
    user: null,
    rol: 'empleado',
    status: 'unlocked',
    loading: false,
    ...partial,
  })
}

import SaleScreen from './SaleScreen'

describe('SaleScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearDraft()
    setAuth({})
    $ui.set({ sidebarOpen: false, toastMessage: null, toastType: null })
    mocks.fetchProducts.mockResolvedValue([])
    mocks.fetchStock.mockResolvedValue({})
  })

  it('should_render_header_search_and_scanner_button', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Nueva venta' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar producto…')).toBeInTheDocument()
    expect(screen.getByLabelText('Escanear código')).toBeInTheDocument()
  })

  it('should_show_empty_state_and_block_confirm_when_cart_is_empty', () => {
    renderScreen()
    expect(screen.getByText(/Tu carrito está vacío/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar venta/i })).toBeDisabled()
  })

  it('should_merge_repeated_product_into_one_line', async () => {
    const user = userEvent.setup()
    mocks.fetchProducts.mockResolvedValue([makeProduct()])

    // Pre-populate a line for the same product so the search tap merges.
    $saleDraft.set({
      lines: [
        {
          productId: 'p1',
          sku: '123456',
          name: 'Lana Merino',
          quantity: 1,
          unitPrice: 4800,
          stockSnapshot: 10,
        },
      ],
      note: '',
      medioPago: 'efectivo',
    })

    renderScreen()
    const input = screen.getByPlaceholderText('Buscar producto…')
    await user.type(input, 'lana')
    await waitFor(() => expect(mocks.fetchProducts).toHaveBeenCalled())

    const product = screen.getAllByText('Lana Merino')[0]
    await user.click(product)

    expect($saleDraft.get().lines).toHaveLength(1)
    expect($saleDraft.get().lines[0].quantity).toBe(2)
  })

  it('should_remove_line_when_stepper_goes_to_zero', async () => {
    const user = userEvent.setup()
    clearDraft()
    $saleDraft.set({
      lines: [makeProduct({ id: 'p1', nombre: 'Lana' })].map((p) => ({
        productId: p.id,
        sku: p.sku ?? '',
        name: p.nombre,
        quantity: 1,
        unitPrice: p.precio_venta,
        stockSnapshot: p.stock,
      })),
      note: '',
      medioPago: 'efectivo',
    })

    renderScreen()
    await waitFor(() => expect(screen.getByText('Lana')).toBeInTheDocument())

    const decrement = screen.getByRole('button', { name: /Disminuir/i })
    await user.click(decrement)

    expect($saleDraft.get().lines).toHaveLength(0)
  })

  it('should_have_efectivo_preselected_and_switch_medio_pago', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect($saleDraft.get().medioPago).toBe('efectivo')

    const transfer = screen.getByRole('button', { name: 'Transfer' })
    await user.click(transfer)

    expect($saleDraft.get().medioPago).toBe('transferencia')
  })

  it('should_update_total_live_when_quantity_changes', async () => {
    const user = userEvent.setup()
    $saleDraft.set({
      lines: [
        {
          productId: 'p1',
          sku: '123',
          name: 'Lana',
          quantity: 1,
          unitPrice: 4800,
          stockSnapshot: 10,
        },
      ],
      note: '',
      medioPago: 'efectivo',
    })

    renderScreen()
    await waitFor(() => expect(screen.getAllByText('$4.800')).toHaveLength(2))

    const increment = screen.getByRole('button', { name: /Incrementar/i })
    await user.click(increment)

    await waitFor(() => {
      expect(screen.queryByText('$4.800')).not.toBeInTheDocument()
      expect(screen.getAllByText('$9.600')).toHaveLength(2)
    })
  })

  it('should_show_warning_and_block_confirm_when_over_stock_snapshot', async () => {
    $saleDraft.set({
      lines: [
        {
          productId: 'p1',
          sku: '123',
          name: 'Lana',
          quantity: 10,
          unitPrice: 4800,
          stockSnapshot: 5,
        },
      ],
      note: '',
      medioPago: 'efectivo',
    })

    renderScreen()
    await waitFor(() => expect(screen.getByText(/Sin stock suficiente/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Confirmar venta/i })).toBeDisabled()

    const increment = screen.getByRole('button', { name: /Incrementar/i })
    expect(increment).toBeDisabled()
  })

  it('should_navigate_to_scanner_when_scanner_button_clicked', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByLabelText('Escanear código'))
    await waitFor(() => expect(screen.getByText('ScannerScreen')).toBeInTheDocument())
  })

  it('should_never_render_cost_for_employee_session', () => {
    $saleDraft.set({
      lines: [
        {
          productId: 'p1',
          sku: '123',
          name: 'Lana',
          quantity: 1,
          unitPrice: 4800,
          stockSnapshot: 10,
        },
      ],
      note: '',
      medioPago: 'efectivo',
    })

    renderScreen()
    expect(screen.queryByText(/Costo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Margen/i)).not.toBeInTheDocument()
  })

  describe('confirm flow', () => {
    beforeEach(() => {
      $saleDraft.set({
        lines: [
          {
            productId: 'p1',
            sku: '123',
            name: 'Lana',
            quantity: 2,
            unitPrice: 4800,
            stockSnapshot: 10,
          },
        ],
        note: '',
        medioPago: 'efectivo',
      })
    })

    it('should_confirm_sale_and_navigate_to_ticket', async () => {
      const user = userEvent.setup()
      mocks.confirmSale.mockResolvedValue('venta-123')

      renderScreen()
      const cta = screen.getByRole('button', { name: /Confirmar venta/i })
      await user.click(cta)

      await waitFor(() => expect(screen.getByText('TicketView')).toBeInTheDocument())
      expect(mocks.confirmSale).toHaveBeenCalledTimes(1)
      expect(mocks.confirmSale).toHaveBeenCalledWith(
        [
          {
            productId: 'p1',
            sku: '123',
            name: 'Lana',
            quantity: 2,
            unitPrice: 4800,
            stockSnapshot: 10,
          },
        ],
        'efectivo'
      )
      expect($saleDraft.get().lines).toHaveLength(0)
    })

    it('should_disable_confirm_while_rpc_is_in_flight_and_block_duplicate_taps', async () => {
      const user = userEvent.setup()
      let resolve: (value: string) => void
      const promise = new Promise<string>((r) => {
        resolve = r
      })
      mocks.confirmSale.mockReturnValue(promise)

      renderScreen()
      const cta = screen.getByRole('button', { name: /Confirmar venta/i })
      await user.click(cta)
      await user.click(cta)

      expect(mocks.confirmSale).toHaveBeenCalledTimes(1)
      expect(cta).toBeDisabled()

      resolve!('venta-123')
      await waitFor(() => expect(screen.getByText('TicketView')).toBeInTheDocument())
    })

    it('should_flag_line_and_keep_draft_on_stock_insuficiente', async () => {
      const user = userEvent.setup()
      const productId = 'a1b2c3d4-1234-5678-9abc-def012345678'
      $saleDraft.set({
        lines: [
          {
            productId,
            sku: '123',
            name: 'Lana',
            quantity: 10,
            unitPrice: 4800,
            stockSnapshot: 10,
          },
        ],
        note: '',
        medioPago: 'efectivo',
      })
      mocks.confirmSale.mockRejectedValue(
        new Error(`stock insuficiente ${productId} (hay 5, pide 10)`)
      )

      renderScreen()
      await user.click(screen.getByRole('button', { name: /Confirmar venta/i }))

      await waitFor(() => expect(screen.getByText(/Sin stock suficiente/i)).toBeInTheDocument())
      expect($saleDraft.get().lines).toHaveLength(1)
      expect($saleDraft.get().lines[0].quantity).toBe(10)
      expect($ui.get().toastMessage).toContain('Stock insuficiente')
    })

    it('should_show_toast_on_unknown_error', async () => {
      const user = userEvent.setup()
      mocks.confirmSale.mockRejectedValue(new Error('medio de pago inválido'))

      renderScreen()
      await user.click(screen.getByRole('button', { name: /Confirmar venta/i }))

      await waitFor(() => expect($ui.get().toastMessage).toBe('medio de pago inválido'))
      expect($saleDraft.get().lines).toHaveLength(1)
    })

    it('should_force_lock_on_usuario_inactivo', async () => {
      const user = userEvent.setup()
      mocks.confirmSale.mockRejectedValue(new Error('usuario inactivo'))

      renderScreen()
      await user.click(screen.getByRole('button', { name: /Confirmar venta/i }))

      await waitFor(() => expect($auth.get().status).toBe('locked'))
      expect($saleDraft.get().lines).toHaveLength(1)
    })

    it('should_refresh_stock_snapshots_on_mount', async () => {
      mocks.fetchStock.mockResolvedValue({ p1: 3 })

      renderScreen()
      await waitFor(() => expect(mocks.fetchStock).toHaveBeenCalledWith(['p1']))
      await waitFor(() => expect($saleDraft.get().lines[0].stockSnapshot).toBe(3))
    })
  })
})
