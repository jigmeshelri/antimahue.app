/**
 * PinUnlockPanel tests — unpair/switch affordances (T-3, unpair-device).
 * REQ-AUTH-5, REQ-AUTH-6, REQ-AUTH-9, REQ-AUTH-10; DD-1, DD-2, DD-6, DD-7, DD-8, DD-9.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetLock } from '@/stores/lock'
import type { VaultRecord } from '@/lib/vault'
import PinUnlockPanel from './PinUnlockPanel'

const UNPAIR_LINK_NAME = /desvincular este teléfono/i
const NOTE_TEXT = 'Necesitarás el correo y la contraseña para volver a vincular.'

function makeUser(overrides: Partial<VaultRecord> = {}): VaultRecord {
  return {
    userId: 'u1',
    displayName: 'Angélica',
    rol: 'admin',
    salt: new Uint8Array(16),
    iv: new Uint8Array(12),
    ciphertext: new ArrayBuffer(16),
    failCount: 0,
    lockedUntil: null,
    pairedAt: Date.now(),
    ...overrides,
  }
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof PinUnlockPanel>> = {}) {
  return {
    selectedUser: makeUser(),
    filledCount: 0,
    errorMessage: null,
    onDigit: vi.fn(),
    onBackspace: vi.fn(),
    onUnpair: vi.fn(),
    onSwitchUser: null,
    ...overrides,
  }
}

describe('PinUnlockPanel — unpair and switch', () => {
  beforeEach(() => {
    resetLock()
  })

  it('should_show_the_unpair_link_when_a_profile_is_selected', () => {
    render(<PinUnlockPanel {...defaultProps()} />)
    expect(screen.getByRole('button', { name: UNPAIR_LINK_NAME })).toBeInTheDocument()
  })

  it('should_hide_both_links_when_no_profile_is_selected', () => {
    render(<PinUnlockPanel {...defaultProps({ selectedUser: null, onSwitchUser: vi.fn() })} />)
    expect(screen.queryByRole('button', { name: UNPAIR_LINK_NAME })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar de usuario' })).not.toBeInTheDocument()
  })

  it('should_show_the_consequence_note_and_confirm_buttons_after_tapping_the_link', async () => {
    const user = userEvent.setup()
    render(<PinUnlockPanel {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))

    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sí, desvincular' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: UNPAIR_LINK_NAME })).not.toBeInTheDocument()
  })

  it('should_move_focus_to_cancelar_on_entering_the_confirm_state', async () => {
    const user = userEvent.setup()
    render(<PinUnlockPanel {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('should_expose_the_note_as_aria_describedby_of_the_confirm_button_group', async () => {
    const user = userEvent.setup()
    render(<PinUnlockPanel {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))

    const group = screen.getByRole('group', { name: /confirmar desvinculación/i })
    const note = screen.getByText(NOTE_TEXT)
    expect(group).toHaveAttribute('aria-describedby', note.id)
  })

  it('should_restore_the_link_and_change_nothing_on_cancel', async () => {
    const user = userEvent.setup()
    const onUnpair = vi.fn()
    render(<PinUnlockPanel {...defaultProps({ onUnpair })} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: UNPAIR_LINK_NAME })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(onUnpair).not.toHaveBeenCalled()
  })

  it('should_move_focus_back_to_the_link_on_cancel', async () => {
    const user = userEvent.setup()
    render(<PinUnlockPanel {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: UNPAIR_LINK_NAME })).toHaveFocus()
  })

  it('should_call_onUnpair_once_when_confirm_is_tapped', async () => {
    const user = userEvent.setup()
    const onUnpair = vi.fn()
    render(<PinUnlockPanel {...defaultProps({ onUnpair })} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))
    await user.click(screen.getByRole('button', { name: 'Sí, desvincular' }))

    expect(onUnpair).toHaveBeenCalledTimes(1)
  })

  it('should_show_the_switch_link_only_when_onSwitchUser_is_provided', () => {
    const { rerender } = render(<PinUnlockPanel {...defaultProps({ onSwitchUser: null })} />)
    expect(screen.queryByRole('button', { name: 'Cambiar de usuario' })).not.toBeInTheDocument()

    rerender(<PinUnlockPanel {...defaultProps({ onSwitchUser: vi.fn() })} />)
    expect(screen.getByRole('button', { name: 'Cambiar de usuario' })).toBeInTheDocument()
  })

  it('should_call_onSwitchUser_when_the_switch_link_is_tapped', async () => {
    const user = userEvent.setup()
    const onSwitchUser = vi.fn()
    render(<PinUnlockPanel {...defaultProps({ onSwitchUser })} />)

    await user.click(screen.getByRole('button', { name: 'Cambiar de usuario' }))

    expect(onSwitchUser).toHaveBeenCalledTimes(1)
  })

  it('should_disable_the_unpair_and_switch_links_while_a_pin_attempt_is_in_flight', () => {
    render(<PinUnlockPanel {...defaultProps({ onSwitchUser: vi.fn(), filledCount: 4 })} />)

    expect(screen.getByRole('button', { name: UNPAIR_LINK_NAME })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cambiar de usuario' })).toBeDisabled()
  })

  it('should_disable_the_confirm_button_while_a_pin_attempt_is_in_flight', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PinUnlockPanel {...defaultProps({ filledCount: 0 })} />)

    await user.click(screen.getByRole('button', { name: UNPAIR_LINK_NAME }))
    rerender(<PinUnlockPanel {...defaultProps({ filledCount: 4 })} />)

    expect(screen.getByRole('button', { name: 'Sí, desvincular' })).toBeDisabled()
  })
})
