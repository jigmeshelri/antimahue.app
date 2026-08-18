/**
 * StockAlertList tests.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StockAlertList from './StockAlertList'
import type { StockAlert } from '../dashboardTypes'

function alert(overrides: Partial<StockAlert> = {}): StockAlert {
  return {
    id: 'p1',
    nombre: 'Lana Merino',
    stock: 0,
    stock_minimo: 5,
    ...overrides,
  }
}

describe('StockAlertList', () => {
  it('should_render_empty_state_when_no_alerts', () => {
    render(<StockAlertList alerts={[]} onNavigate={vi.fn()} />)

    expect(screen.getByText('No hay alertas de stock')).toBeInTheDocument()
  })

  it('should_render_header_and_ver_todo_link', () => {
    const onNavigate = vi.fn()
    render(<StockAlertList alerts={[alert()]} onNavigate={onNavigate} />)

    expect(screen.getByText('Alertas de stock')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Ver todo'))
    expect(onNavigate).toHaveBeenCalledWith('/catalogo')
  })

  it('should_classify_agotado_and_navigate_to_product_detail', () => {
    const onNavigate = vi.fn()
    render(<StockAlertList alerts={[alert({ stock: 0 })]} onNavigate={onNavigate} />)

    expect(screen.getByText('Agotado')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Lana Merino'))
    expect(onNavigate).toHaveBeenCalledWith('/catalogo/p1')
  })

  it('should_classify_bajo', () => {
    render(<StockAlertList alerts={[alert({ stock: 2 })]} onNavigate={vi.fn()} />)

    expect(screen.getByText('Bajo')).toBeInTheDocument()
  })
})
