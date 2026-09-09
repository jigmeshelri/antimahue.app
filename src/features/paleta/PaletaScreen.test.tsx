/**
 * PaletaScreen integration tests — the full seed → rule → suggestions →
 * palette → share/encargo flow (REQ-CPA-1..8).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { clearPalette } from './paletaStore'
import { $ui, clearToast } from '@/stores/ui'
import type { Product } from '../catalogo/catalogoTypes'
import type { AuthState } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  fetchColoredProducts: vi.fn(),
  savePedidoPendiente: vi.fn(),
}))

vi.mock('./paletaApi', () => ({
  fetchColoredProducts: mocks.fetchColoredProducts,
  savePedidoPendiente: mocks.savePedidoPendiente,
}))

vi.mock('@/stores/auth', async () => {
  const { atom } = await import('nanostores')
  return {
    $auth: atom({ session: null, user: null, rol: 'admin', status: 'unlocked', loading: false }),
  }
})

import PaletaScreen from './PaletaScreen'
import { $auth } from '@/stores/auth'

function setRol(rol: AuthState['rol']): void {
  $auth.set({ session: null, user: null, rol, status: 'unlocked', loading: false })
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: '123456',
    nombre: 'Lana Base',
    tipo: 'lana',
    marca: 'Merino',
    grosor: 'Fino',
    peso_metraje: '50g',
    color_nombre: 'Rojo terracota',
    color_hex: '#FF0000',
    color_h: 0,
    color_s: 100,
    color_l: 50,
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

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/paleta']}>
      <Routes>
        <Route path="/paleta" element={<PaletaScreen />} />
        <Route path="/dashboard" element={<div>DashboardScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  clearPalette()
  clearToast()
  setRol('admin')
  mocks.fetchColoredProducts.mockReset()
  mocks.savePedidoPendiente.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PaletaScreen', () => {
  it('should_show_a_loading_state_while_products_load', async () => {
    let resolve: (value: Product[]) => void = () => {}
    mocks.fetchColoredProducts.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    renderScreen()
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    resolve([])
    await waitFor(() => expect(screen.queryByText('Cargando…')).not.toBeInTheDocument())
  })

  it('should_show_an_error_when_products_fail_to_load', async () => {
    mocks.fetchColoredProducts.mockRejectedValue(
      new Error('No se pudo cargar los colores del catálogo')
    )
    renderScreen()
    expect(
      await screen.findByText('No se pudo cargar los colores del catálogo')
    ).toBeInTheDocument()
  })

  it('should_show_suggestions_once_a_seed_is_selected', async () => {
    const user = userEvent.setup()
    mocks.fetchColoredProducts.mockResolvedValue([
      makeProduct({ id: 's1', nombre: 'Lana Base', color_h: 0 }),
      makeProduct({ id: 'p1', nombre: 'Lana Complementaria', color_h: 180, stock: 10 }),
    ])
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Lana Base/i }))
    expect((await screen.findAllByText('Lana Complementaria')).length).toBeGreaterThan(0)
  })

  it('should_update_suggestions_when_the_harmony_rule_changes', async () => {
    const user = userEvent.setup()
    mocks.fetchColoredProducts.mockResolvedValue([
      makeProduct({ id: 's1', nombre: 'Lana Base', color_h: 0 }),
      makeProduct({ id: 'p1', nombre: 'Lana Complementaria', color_h: 180, stock: 10 }),
    ])
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Lana Base/i }))
    // Default rule is "analogous" — two targets.
    expect(await screen.findByText('Opción 1')).toBeInTheDocument()
    expect(screen.getByText('Opción 2')).toBeInTheDocument()

    // Complementary — a single target.
    await user.click(screen.getByRole('button', { name: 'Complementarios' }))
    expect(screen.getByText('Opción 1')).toBeInTheDocument()
    expect(screen.queryByText('Opción 2')).not.toBeInTheDocument()
  })

  it('should_show_out_of_stock_suggestions_disabled', async () => {
    const user = userEvent.setup()
    mocks.fetchColoredProducts.mockResolvedValue([
      makeProduct({ id: 's1', nombre: 'Lana Base', color_h: 0 }),
      makeProduct({ id: 'p1', nombre: 'Lana Agotada', color_h: 180, stock: 0 }),
    ])
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Lana Base/i }))
    // Complementary rule → a single target, so a single suggestion section.
    await user.click(screen.getByRole('button', { name: 'Complementarios' }))
    expect(await screen.findByRole('button', { name: 'Agregar' })).toBeDisabled()
    expect(screen.getByText('Agotado')).toBeInTheDocument()
  })

  it('should_add_a_suggestion_remove_it_and_reorder_the_palette', async () => {
    const user = userEvent.setup()
    mocks.fetchColoredProducts.mockResolvedValue([
      makeProduct({ id: 's1', nombre: 'Lana Base', color_h: 0 }),
      makeProduct({ id: 'p1', nombre: 'Lana Complementaria', color_h: 180, stock: 10 }),
    ])
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Lana Base/i }))
    await user.click(screen.getByRole('button', { name: 'Complementarios' }))
    await user.click(await screen.findByRole('button', { name: 'Agregar' }))

    expect(
      screen.queryByText('Agrega hilados sugeridos para armar tu paleta')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar Lana Complementaria' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar Lana Complementaria' }))
    expect(screen.getByText('Agrega hilados sugeridos para armar tu paleta')).toBeInTheDocument()
  })

  it('should_open_a_whatsapp_share_link_with_the_palette', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mocks.fetchColoredProducts.mockResolvedValue([
      makeProduct({ id: 's1', nombre: 'Lana Base', color_h: 0 }),
      makeProduct({ id: 'p1', nombre: 'Lana Complementaria', color_h: 180, stock: 10 }),
    ])
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Lana Base/i }))
    await user.click(screen.getByRole('button', { name: 'Complementarios' }))
    await user.click(await screen.findByRole('button', { name: 'Agregar' }))
    await user.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='),
      '_blank',
      'noopener'
    )
    const url = openSpy.mock.calls[0][0] as string
    expect(decodeURIComponent(url)).toContain('Lana Complementaria')
  })

  it('should_save_an_encargo_note_and_show_a_success_toast', async () => {
    const user = userEvent.setup()
    mocks.savePedidoPendiente.mockResolvedValue(undefined)
    mocks.fetchColoredProducts.mockResolvedValue([])
    renderScreen()

    const textarea = await screen.findByPlaceholderText(/Nombre y teléfono del cliente/i)
    await user.type(textarea, 'Cliente busca verde musgo')
    await user.click(screen.getByRole('button', { name: 'Anotar encargo' }))

    await waitFor(() => expect(mocks.savePedidoPendiente).toHaveBeenCalled())
    expect($ui.get().toastMessage).toBe('Encargo guardado')
    expect($ui.get().toastType).toBe('success')
  })

  it('should_show_an_error_toast_when_saving_the_encargo_fails', async () => {
    const user = userEvent.setup()
    mocks.savePedidoPendiente.mockRejectedValue(new Error('No se pudo guardar el encargo'))
    mocks.fetchColoredProducts.mockResolvedValue([])
    renderScreen()

    const textarea = await screen.findByPlaceholderText(/Nombre y teléfono del cliente/i)
    await user.type(textarea, 'Cliente busca verde musgo')
    await user.click(screen.getByRole('button', { name: 'Anotar encargo' }))

    await waitFor(() => expect($ui.get().toastType).toBe('error'))
    expect($ui.get().toastMessage).toBe('No se pudo guardar el encargo')
  })

  it('should_hide_the_encargo_section_for_an_empleado', async () => {
    setRol('empleado')
    mocks.fetchColoredProducts.mockResolvedValue([])
    renderScreen()

    await waitFor(() => expect(mocks.fetchColoredProducts).toHaveBeenCalled())
    expect(screen.queryByText('¿Falta un color? Anota el encargo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anotar encargo' })).not.toBeInTheDocument()
  })
})
