import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StockBadge from './StockBadge'

describe('StockBadge', () => {
  it('should_render_ok_badge_when_stock_is_above_minimum', () => {
    render(<StockBadge stock={10} stockMinimo={5} />)
    expect(screen.getByText('En stock')).toBeInTheDocument()
  })

  it('should_render_low_badge_when_stock_is_below_minimum_but_positive', () => {
    render(<StockBadge stock={2} stockMinimo={5} />)
    expect(screen.getByText('Bajo')).toBeInTheDocument()
  })

  it('should_render_out_badge_when_stock_is_zero', () => {
    render(<StockBadge stock={0} stockMinimo={5} />)
    expect(screen.getByText('Agotado')).toBeInTheDocument()
  })

  it('should_use_configured_default_when_stock_minimo_is_null', () => {
    render(<StockBadge stock={3} stockMinimo={null} defaultMinimo={5} />)
    expect(screen.getByText('Bajo')).toBeInTheDocument()
  })
})
