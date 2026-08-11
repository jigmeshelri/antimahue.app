import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Toast from './Toast'
import { $ui, showToast, clearToast } from '@/stores/ui'

describe('Toast', () => {
  beforeEach(() => {
    clearToast()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should_render_toast_message_when_set', () => {
    showToast('Venta confirmada', 'success')
    render(<Toast />)

    expect(screen.getByText('Venta confirmada')).toBeInTheDocument()
  })

  it('should_not_render_when_no_message_is_set', () => {
    render(<Toast />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('should_auto_dismiss_after_4_seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    showToast('Mensaje temporal', 'info')
    render(<Toast />)

    expect(screen.getByText('Mensaje temporal')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(4000)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('should_clear_timer_on_unmount', () => {
    vi.useFakeTimers()
    showToast('Mensaje', 'error')
    const { unmount } = render(<Toast />)

    unmount()
    vi.advanceTimersByTime(4000)

    expect($ui.get().toastMessage).toBe('Mensaje')
  })
})
