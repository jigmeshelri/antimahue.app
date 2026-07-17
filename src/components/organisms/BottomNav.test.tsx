import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomNav from './BottomNav'

describe('BottomNav', () => {
  it('should_render_four_tabs', () => {
    render(<BottomNav active="inicio" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /inicio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /venta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /catálogo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /más/i })).toBeInTheDocument()
  })

  it('should_highlight_active_tab', () => {
    render(<BottomNav active="catalogo" onNavigate={vi.fn()} />)
    const active = screen.getByRole('button', { name: /catálogo/i })
    expect(active).toHaveClass('text-nav-active')
  })

  it('should_call_onNavigate_when_a_tab_is_clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<BottomNav active="inicio" onNavigate={onNavigate} />)
    await user.click(screen.getByRole('button', { name: /venta/i }))
    expect(onNavigate).toHaveBeenCalledWith('/venta')
  })
})
