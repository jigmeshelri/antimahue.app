/**
 * StatCard tests.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('should_render_label_value_and_icon', () => {
    render(<StatCard icon={<span data-testid="icon" />} label="Ventas hoy" value="$15.000" />)

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('Ventas hoy')).toBeInTheDocument()
    expect(screen.getByText('$15.000')).toBeInTheDocument()
  })

  it('should_render_subtitle_when_provided', () => {
    render(<StatCard icon={<span />} label="Ventas hoy" value="$15.000" subtitle="2 ventas" />)

    expect(screen.getByText('2 ventas')).toBeInTheDocument()
  })

  it('should_not_render_subtitle_when_not_provided', () => {
    render(<StatCard icon={<span />} label="Ventas hoy" value="$15.000" />)

    expect(screen.queryByText('2 ventas')).not.toBeInTheDocument()
  })
})
