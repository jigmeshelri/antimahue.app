import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Stepper from './Stepper'

describe('Stepper', () => {
  it('should_display_the_given_quantity', () => {
    render(<Stepper quantity={3} onChange={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should_increment_when_plus_is_clicked', async () => {
    const onChange = vi.fn()
    render(<Stepper quantity={3} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /incrementar/i }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('should_decrement_when_minus_is_clicked', async () => {
    const onChange = vi.fn()
    render(<Stepper quantity={3} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('should_not_decrement_below_one', async () => {
    const onChange = vi.fn()
    render(<Stepper quantity={1} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('should_respect_max_quantity_when_provided', async () => {
    const onChange = vi.fn()
    render(<Stepper quantity={5} max={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /incrementar/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
