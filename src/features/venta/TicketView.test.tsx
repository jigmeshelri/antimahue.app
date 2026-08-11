/**
 * TicketView tests — Phases 7, 8 and 9.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { $auth } from '@/stores/auth'
import { $ui } from '@/stores/ui'
import type { Venta } from './ventaTypes'
import type { AuthState } from '@/stores/auth'

const mocks = vi.hoisted(() => ({
  fetchVenta: vi.fn(),
  fetchStoreName: vi.fn(),
  undoSale: vi.fn(),
}))

vi.mock('./ventaApi', () => ({
  fetchVenta: mocks.fetchVenta,
  fetchStoreName: mocks.fetchStoreName,
  undoSale: mocks.undoSale,
}))

function makeVenta(overrides: Partial<Venta> = {}): Venta {
  return {
    id: 'a1b2c3d4-1234-5678-9abc-def012345678',
    created_at: '2026-01-15T09:52:00.000Z',
    medio_pago: 'efectivo',
    total: 9600,
    estado: 'confirmada',
    actor_id: 'user-123',
    items: [
      {
        id: 'p1',
        cantidad: 2,
        precio_unitario: 4800,
        nombre: 'Lana Merino',
      },
    ],
    ...overrides,
  }
}

function renderScreen(
  initialEntries: string[] = ['/venta/a1b2c3d4-1234-5678-9abc-def012345678/ticket']
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/venta/:id/ticket" element={<TicketView />} />
        <Route path="/venta" element={<div>SaleScreen</div>} />
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

import TicketView from './TicketView'

describe('TicketView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAuth({})
    $ui.set({ sidebarOpen: false, toastMessage: null, toastType: null })
    mocks.fetchStoreName.mockResolvedValue('Antimahue Test')
  })

  it('should_show_loading_state', () => {
    mocks.fetchVenta.mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('should_render_not_found_state', async () => {
    mocks.fetchVenta.mockResolvedValue(null)
    renderScreen()
    await waitFor(() =>
      expect(screen.getByText(/Venta no encontrada o no accesible/i)).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nueva venta' }))
    await waitFor(() => expect(screen.getByText('SaleScreen')).toBeInTheDocument())
  })

  it('should_render_receipt_with_store_name_lines_total_and_reference', async () => {
    mocks.fetchVenta.mockResolvedValue(makeVenta())
    renderScreen()

    const card = await screen.findByTestId('receipt-card')
    await waitFor(() => expect(within(card).getByText('ANTIMAHUE TEST')).toBeInTheDocument())
    expect(within(card).getByText('Lana Merino')).toBeInTheDocument()
    expect(within(card).getAllByText('$9.600')).toHaveLength(2)
    expect(within(card).getByText('Efectivo')).toBeInTheDocument()
    expect(within(card).getByText('#a1b2c3d4')).toBeInTheDocument()
  })

  it('should_show_seller_name_only_on_own_sale', async () => {
    setAuth({
      user: {
        id: 'user-123',
        email: 'angelica@example.com',
        user_metadata: { display_name: 'Angélica' },
      } as unknown as AuthState['user'],
    })
    mocks.fetchVenta.mockResolvedValue(makeVenta())
    renderScreen()

    const card = await screen.findByTestId('receipt-card')
    await waitFor(() => expect(within(card).getByText('Angélica')).toBeInTheDocument())
  })

  it('should_fall_back_to_email_local_part_when_display_name_missing', async () => {
    setAuth({
      user: {
        id: 'user-123',
        email: 'angelica@example.com',
        user_metadata: {},
      } as AuthState['user'],
    })
    mocks.fetchVenta.mockResolvedValue(makeVenta())
    renderScreen()

    const card = await screen.findByTestId('receipt-card')
    await waitFor(() => expect(within(card).getByText('angelica')).toBeInTheDocument())
  })

  it('should_omit_seller_for_someone_elses_sale', async () => {
    setAuth({
      user: {
        id: 'user-999',
        email: 'otra@example.com',
        user_metadata: { display_name: 'Otra' },
      } as unknown as AuthState['user'],
    })
    mocks.fetchVenta.mockResolvedValue(makeVenta())
    renderScreen()

    const card = await screen.findByTestId('receipt-card')
    await waitFor(() => expect(within(card).getByText('ANTIMAHUE TEST')).toBeInTheDocument())
    expect(within(card).queryByText('Vendedora')).not.toBeInTheDocument()
  })

  it('should_show_confirmada_banner_by_default', async () => {
    mocks.fetchVenta.mockResolvedValue(makeVenta())
    renderScreen()
    await waitFor(() => expect(screen.getByText('Venta confirmada')).toBeInTheDocument())
  })

  describe('undo', () => {
    beforeEach(() => {
      mocks.fetchVenta.mockResolvedValue(makeVenta())
    })

    it('should_call_undoSale_on_second_tap', async () => {
      const user = userEvent.setup()
      mocks.undoSale.mockResolvedValue(undefined)

      renderScreen()
      const undo = await screen.findByRole('button', { name: /Deshacer última venta/i })
      await user.click(undo)
      expect(screen.getByText(/¿Confirmar\?/i)).toBeInTheDocument()

      mocks.fetchVenta.mockResolvedValue(makeVenta({ estado: 'deshecha' }))
      await user.click(undo)

      await waitFor(() => expect(mocks.undoSale).toHaveBeenCalledTimes(1))
    })

    it('should_show_deshecha_banner_and_hide_actions_after_undo', async () => {
      const user = userEvent.setup()
      mocks.undoSale.mockResolvedValue(undefined)

      renderScreen()
      const undo = await screen.findByRole('button', { name: /Deshacer última venta/i })
      await user.click(undo)

      mocks.fetchVenta.mockResolvedValue(makeVenta({ estado: 'deshecha' }))
      await user.click(undo)

      await waitFor(() => expect(screen.getByText('Venta deshecha')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /WhatsApp/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Imprimir/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Deshacer/i })).not.toBeInTheDocument()
      expect($ui.get().toastMessage).toBe('Venta deshecha')
    })

    it('should_show_toast_and_hide_undo_on_not_last_sale', async () => {
      const user = userEvent.setup()
      mocks.undoSale.mockRejectedValue(
        new Error('solo se puede deshacer la última venta confirmada')
      )

      renderScreen()
      const undo = await screen.findByRole('button', { name: /Deshacer última venta/i })
      await user.click(undo)
      await user.click(undo)

      await waitFor(() =>
        expect($ui.get().toastMessage).toBe('solo se puede deshacer la última venta confirmada')
      )
      expect(screen.queryByRole('button', { name: /Deshacer/i })).not.toBeInTheDocument()
    })
  })

  describe('print and share', () => {
    beforeEach(() => {
      mocks.fetchVenta.mockResolvedValue(makeVenta())
    })

    it('should_call_window_print', async () => {
      const user = userEvent.setup()
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

      renderScreen()
      const printBtn = await screen.findByRole('button', { name: /Imprimir ticket/i })
      await user.click(printBtn)

      expect(printSpy).toHaveBeenCalledTimes(1)
      printSpy.mockRestore()
    })

    it('should_open_whatsapp_with_encoded_text', async () => {
      const user = userEvent.setup()
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      renderScreen()
      const shareBtn = await screen.findByRole('button', { name: /WhatsApp/i })
      await user.click(shareBtn)

      expect(openSpy).toHaveBeenCalledTimes(1)
      const url = openSpy.mock.calls[0][0] as string
      expect(url.startsWith('https://wa.me/?text=')).toBe(true)
      expect(decodeURIComponent(url)).toContain('Lana Merino')
      openSpy.mockRestore()
    })
  })
})
