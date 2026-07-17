/**
 * ScannerScreen integration tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'

const barcodeMocks = vi.hoisted(() => ({
  detectBarcode: vi.fn(),
}))

vi.mock('./barcodeDetection', async () => {
  const actual = await import('./barcodeDetection')
  return {
    ...actual,
    detectBarcode: barcodeMocks.detectBarcode,
  }
})

const apiMocks = vi.hoisted(() => ({
  findProductBySku: vi.fn(),
}))

vi.mock('@/features/catalogo/catalogoApi', () => ({
  findProductBySku: apiMocks.findProductBySku,
}))

const saleDraftMocks = vi.hoisted(() => ({
  addLine: vi.fn(),
}))

vi.mock('@/stores/saleDraft', () => ({
  addLine: saleDraftMocks.addLine,
}))

import ScannerScreen from './ScannerScreen'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/escaner']}>
      <Routes>
        <Route path="/escaner" element={<ScannerScreen />} />
        <Route path="/venta" element={<div>SaleScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScannerScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    barcodeMocks.detectBarcode.mockResolvedValue(null)
    apiMocks.findProductBySku.mockResolvedValue(null)

    const stream = {
      getTracks: vi.fn(() => [{ stop: vi.fn() }]),
    } as unknown as MediaStream
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.stubGlobal('BarcodeDetector', undefined)
  })

  it('should_render_scanner_title_and_manual_input_fallback', async () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Escanear' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ingresa el SKU manualmente')).toBeInTheDocument()
    )
  })

  it('should_lookup_sku_from_manual_input', async () => {
    renderScreen()
    const input = await screen.findByPlaceholderText('Ingresa el SKU manualmente')
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(apiMocks.findProductBySku).toHaveBeenCalledWith('123456'))
  })

  it('should_show_product_overlay_when_found', async () => {
    vi.stubGlobal(
      'BarcodeDetector',
      class FakeDetector {
        detect = vi.fn().mockResolvedValue([])
      }
    )
    apiMocks.findProductBySku.mockResolvedValue({
      id: 'p1',
      nombre: 'Lana Escaneada',
      precio_venta: 3000,
      stock: 5,
      sku: '123456',
    })
    barcodeMocks.detectBarcode.mockResolvedValue('123456')
    renderScreen()
    await waitFor(() => expect(screen.getByText('Lana Escaneada')).toBeInTheDocument())
  })

  it('should_show_not_found_message_when_sku_unknown', async () => {
    vi.stubGlobal(
      'BarcodeDetector',
      class FakeDetector {
        detect = vi.fn().mockResolvedValue([])
      }
    )
    barcodeMocks.detectBarcode.mockResolvedValue('999999')
    renderScreen()
    await waitFor(() => expect(screen.getByText('Producto no registrado')).toBeInTheDocument())
  })
})
