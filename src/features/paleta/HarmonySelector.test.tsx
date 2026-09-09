import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HarmonySelector from './HarmonySelector'

describe('HarmonySelector', () => {
  it('should_render_the_three_harmony_rules', () => {
    render(<HarmonySelector value="analogous" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Análogos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complementarios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Triádicos' })).toBeInTheDocument()
  })

  it('should_mark_the_active_rule_as_pressed', () => {
    render(<HarmonySelector value="complementary" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Complementarios' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Análogos' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('should_call_onChange_when_a_different_rule_is_tapped', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<HarmonySelector value="analogous" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Triádicos' }))
    expect(onChange).toHaveBeenCalledWith('triadic')
  })

  it('should_not_call_onChange_when_the_active_rule_is_tapped_again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<HarmonySelector value="analogous" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Análogos' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
