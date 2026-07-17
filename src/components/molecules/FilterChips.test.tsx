import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterChips from './FilterChips'

describe('FilterChips', () => {
  it('should_render_all_type_options', () => {
    render(<FilterChips value="todos" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hilo' })).toBeInTheDocument()
  })

  it('should_mark_active_chip', () => {
    render(<FilterChips value="lana" onChange={vi.fn()} />)
    const active = screen.getByRole('button', { name: 'Lana' })
    expect(active).toHaveAttribute('aria-pressed', 'true')
  })

  it('should_mark_inactive_chips', () => {
    render(<FilterChips value="lana" onChange={vi.fn()} />)
    const inactive = screen.getByRole('button', { name: 'Hilo' })
    expect(inactive).toHaveAttribute('aria-pressed', 'false')
  })

  it('should_call_onChange_when_clicking_a_different_chip', async () => {
    const onChange = vi.fn()
    render(<FilterChips value="todos" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hilo' }))
    expect(onChange).toHaveBeenCalledWith('hilo')
  })

  it('should_not_call_onChange_when_clicking_active_chip', async () => {
    const onChange = vi.fn()
    render(<FilterChips value="lana" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Lana' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
