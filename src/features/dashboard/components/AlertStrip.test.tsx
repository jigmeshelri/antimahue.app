/**
 * AlertStrip tests.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AlertStrip from './AlertStrip'

describe('AlertStrip', () => {
  it('should_render_when_alerts_exist', () => {
    const onNavigate = vi.fn()
    render(<AlertStrip alertCount={3} onNavigate={onNavigate} />)

    expect(screen.getByText('Tienes productos con stock bajo')).toBeInTheDocument()
    expect(screen.getByText('Ver →')).toBeInTheDocument()
  })

  it('should_navigate_to_catalog_on_click', () => {
    const onNavigate = vi.fn()
    render(<AlertStrip alertCount={3} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('Tienes productos con stock bajo'))
    expect(onNavigate).toHaveBeenCalledWith('/catalogo')
  })

  it('should_not_render_when_no_alerts', () => {
    const { container } = render(<AlertStrip alertCount={0} onNavigate={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })
})
