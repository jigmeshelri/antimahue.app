/**
 * DashboardHeader tests.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardHeader from './DashboardHeader'

vi.mock('../dashboardUtils', () => ({
  greetingForHour: vi.fn(() => 'Buenos días'),
}))

describe('DashboardHeader', () => {
  it('should_render_greeting_and_user_name', () => {
    render(<DashboardHeader userName="Angélica" alertCount={0} />)

    expect(screen.getByText('Buenos días')).toBeInTheDocument()
    expect(screen.getByText('Angélica')).toBeInTheDocument()
  })

  it('should_show_bell_icon', () => {
    render(<DashboardHeader userName="Angélica" alertCount={0} />)

    expect(screen.getByLabelText('Notificaciones')).toBeInTheDocument()
  })

  it('should_show_notification_badge_when_alerts_exist', () => {
    const { container } = render(<DashboardHeader userName="Angélica" alertCount={3} />)

    expect(container.querySelector('.rounded-full')).toBeInTheDocument()
  })

  it('should_not_show_notification_badge_when_no_alerts', () => {
    const { container } = render(<DashboardHeader userName="Angélica" alertCount={0} />)

    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument()
  })
})
