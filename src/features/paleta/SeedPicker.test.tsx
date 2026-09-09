import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeedPicker from './SeedPicker'
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

describe('SeedPicker', () => {
  it('should_list_every_product_it_receives', () => {
    const products = [
      makeProduct({ id: 'p1', nombre: 'Lana Roja' }),
      makeProduct({ id: 'p2', nombre: 'Lana Azul' }),
    ]
    render(<SeedPicker products={products} seedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Lana Roja')).toBeInTheDocument()
    expect(screen.getByText('Lana Azul')).toBeInTheDocument()
  })

  it('should_mark_the_selected_seed_as_pressed', () => {
    const products = [makeProduct({ id: 'p1', nombre: 'Lana Roja' })]
    render(<SeedPicker products={products} seedId="p1" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Lana Roja/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('should_call_onSelect_with_the_tapped_product_id', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const products = [makeProduct({ id: 'p1', nombre: 'Lana Roja' })]
    render(<SeedPicker products={products} seedId={null} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: /Lana Roja/i }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('should_filter_the_list_by_search_text', async () => {
    const user = userEvent.setup()
    const products = [
      makeProduct({ id: 'p1', nombre: 'Lana Roja' }),
      makeProduct({ id: 'p2', nombre: 'Algodón Azul' }),
    ]
    render(<SeedPicker products={products} seedId={null} onSelect={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Buscar ovillo…'), 'azul')
    expect(screen.queryByText('Lana Roja')).not.toBeInTheDocument()
    expect(screen.getByText('Algodón Azul')).toBeInTheDocument()
  })

  it('should_show_an_empty_message_when_no_product_has_a_registered_color', () => {
    render(<SeedPicker products={[]} seedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('No hay hilados con color registrado')).toBeInTheDocument()
  })
})
