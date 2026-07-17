import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductCard from './ProductCard'
import type { Product } from '@/features/catalogo/catalogoTypes'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: '123456',
    nombre: 'Lana Merino Rojo',
    tipo: 'lana',
    marca: 'Merino',
    grosor: 'Fino',
    peso_metraje: '50g',
    color_nombre: 'Rojo',
    color_hex: '#C84A3A',
    precio_venta: 4800,
    stock: 12,
    stock_minimo: 5,
    imagen_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    producto_costos: null,
    ...overrides,
  }
}

describe('ProductCard', () => {
  it('should_render_product_name_and_price', () => {
    render(<ProductCard product={makeProduct()} onClick={vi.fn()} />)
    expect(screen.getByText('Lana Merino Rojo')).toBeInTheDocument()
    expect(screen.getByText('$4.800')).toBeInTheDocument()
  })

  it('should_render_stock_badge', () => {
    render(<ProductCard product={makeProduct({ stock: 2, stock_minimo: 5 })} onClick={vi.fn()} />)
    expect(screen.getByText('Bajo')).toBeInTheDocument()
  })

  it('should_call_onClick_when_clicked', async () => {
    const onClick = vi.fn()
    render(<ProductCard product={makeProduct()} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('p1')
  })
})
