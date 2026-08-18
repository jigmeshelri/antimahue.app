/**
 * DashboardScreen tests — integration tests for the dashboard feature.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { $auth } from '@/stores/auth'
import type { AuthState } from '@/stores/auth'
import type { DashboardSummary } from './dashboardTypes'

const mocks = vi.hoisted(() => ({
  fetchDashboardSummary: vi.fn(),
}))

vi.mock('./dashboardApi', () => ({
  fetchDashboardSummary: mocks.fetchDashboardSummary,
}))

vi.mock('@/components/molecules/SearchInput', () => ({
  default: vi.fn(({ value, onChange, placeholder }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )),
}))

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    ventas_hoy: {
      total: 15000,
      cantidad: 2,
      por_medio_pago: { efectivo: 10000, transferencia: 5000 },
    },
    valor_inventario: {
      a_costo: 80000,
      a_venta: 120000,
    },
    alertas_stock: [
      { id: 'p1', nombre: 'Lana Merino', stock: 0, stock_minimo: 5 },
      { id: 'p2', nombre: 'Hilo Algodón', stock: 2, stock_minimo: 5 },
    ],
    ...overrides,
  }
}

function setAuth(partial: Partial<AuthState> = {}) {
  $auth.set({
    session: null,
    user: {
      user_metadata: { display_name: 'Angélica' },
      email: 'angelica@antimahue.com',
    } as unknown as AuthState['user'],
    rol: 'admin',
    status: 'unlocked',
    loading: false,
    ...partial,
  })
}

function renderScreen(initialEntries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/catalogo" element={<div>CatalogScreen</div>} />
        <Route path="/catalogo/:id" element={<div>ProductDetailScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

import DashboardScreen from './DashboardScreen'

describe('DashboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAuth()
  })

  it('should_show_loading_state_then_render_admin_dashboard', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary())

    renderScreen()

    expect(screen.getByText('Angélica')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

    await waitFor(() => {
      expect(screen.getByText('$15.000')).toBeInTheDocument()
    })

    expect(screen.getByText('2 ventas')).toBeInTheDocument()
    expect(screen.getByText('$120.000')).toBeInTheDocument()
    expect(screen.getByText('Valor inventario a costo')).toBeInTheDocument()
    expect(screen.getByText('$80.000')).toBeInTheDocument()
    expect(screen.getByText('Lana Merino')).toBeInTheDocument()
  })

  it('should_hide_cost_value_for_employee', async () => {
    setAuth({ rol: 'empleado', user: { email: 'vendedor@antimahue.com' } as AuthState['user'] })
    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary({ valor_inventario: null }))

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('$15.000')).toBeInTheDocument()
    })

    expect(screen.queryByText('Valor inventario a costo')).not.toBeInTheDocument()
    expect(screen.queryByText('$80.000')).not.toBeInTheDocument()
  })

  it('should_navigate_to_catalog_on_quick_search_submit', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary())
    renderScreen()

    const input = await screen.findByTestId('search-input')
    await userEvent.type(input, 'lana merino')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('CatalogScreen')).toBeInTheDocument()
    })
  })

  it('should_navigate_to_product_detail_when_alert_clicked', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary())
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('Lana Merino')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Lana Merino'))

    await waitFor(() => {
      expect(screen.getByText('ProductDetailScreen')).toBeInTheDocument()
    })
  })

  it('should_show_error_and_allow_retry', async () => {
    mocks.fetchDashboardSummary.mockRejectedValue(new Error('No se pudo cargar el dashboard'))

    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el dashboard')).toBeInTheDocument()
    })

    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary())
    await userEvent.click(screen.getByText('Reintentar'))

    await waitFor(() => {
      expect(screen.getByText('$15.000')).toBeInTheDocument()
    })
  })

  it('should_refresh_when_refresh_button_clicked', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue(makeSummary())
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText('$15.000')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByLabelText('Actualizar'))

    await waitFor(() => {
      expect(mocks.fetchDashboardSummary).toHaveBeenCalledTimes(2)
    })
  })
})
