import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScreenHeader from './ScreenHeader'

describe('ScreenHeader', () => {
  it('should_render_title', () => {
    render(<ScreenHeader title="Catálogo" />)
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
  })

  it('should_render_back_button_and_call_onBack', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<ScreenHeader title="Catálogo" onBack={onBack} />)
    const back = screen.getByRole('button', { name: /volver/i })
    expect(back).toBeInTheDocument()
    await user.click(back)
    expect(onBack).toHaveBeenCalled()
  })

  it('should_render_right_action', () => {
    render(<ScreenHeader title="Catálogo" rightAction={<span data-testid="action">+</span>} />)
    expect(screen.getByTestId('action')).toBeInTheDocument()
  })
})
