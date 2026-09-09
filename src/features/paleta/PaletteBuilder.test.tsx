import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaletteBuilder from './PaletteBuilder'
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

describe('PaletteBuilder', () => {
  it('should_show_an_empty_message_when_no_product_is_selected', () => {
    render(<PaletteBuilder selected={[]} onRemove={vi.fn()} onMove={vi.fn()} />)
    expect(screen.getByText('Agrega hilados sugeridos para armar tu paleta')).toBeInTheDocument()
  })

  it('should_list_every_selected_product', () => {
    const selected = [
      makeProduct({ id: 'p1', nombre: 'Lana Roja' }),
      makeProduct({ id: 'p2', nombre: 'Lana Azul' }),
    ]
    render(<PaletteBuilder selected={selected} onRemove={vi.fn()} onMove={vi.fn()} />)
    expect(screen.getByText('Lana Roja')).toBeInTheDocument()
    expect(screen.getByText('Lana Azul')).toBeInTheDocument()
  })

  it('should_call_onRemove_when_quitar_is_tapped', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const selected = [makeProduct({ id: 'p1', nombre: 'Lana Roja' })]
    render(<PaletteBuilder selected={selected} onRemove={onRemove} onMove={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Quitar Lana Roja' }))
    expect(onRemove).toHaveBeenCalledWith('p1')
  })

  it('should_call_onMove_up_and_down_for_a_middle_item', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    const selected = [
      makeProduct({ id: 'p1', nombre: 'Lana Roja' }),
      makeProduct({ id: 'p2', nombre: 'Lana Verde' }),
      makeProduct({ id: 'p3', nombre: 'Lana Azul' }),
    ]
    render(<PaletteBuilder selected={selected} onRemove={vi.fn()} onMove={onMove} />)
    await user.click(screen.getByRole('button', { name: 'Subir Lana Verde' }))
    expect(onMove).toHaveBeenCalledWith('p2', 'up')
    await user.click(screen.getByRole('button', { name: 'Bajar Lana Verde' }))
    expect(onMove).toHaveBeenCalledWith('p2', 'down')
  })

  it('should_disable_subir_for_the_first_item_and_bajar_for_the_last_item', () => {
    const selected = [
      makeProduct({ id: 'p1', nombre: 'Lana Roja' }),
      makeProduct({ id: 'p2', nombre: 'Lana Azul' }),
    ]
    render(<PaletteBuilder selected={selected} onRemove={vi.fn()} onMove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Subir Lana Roja' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Lana Azul' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Lana Roja' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir Lana Azul' })).not.toBeDisabled()
  })
})
