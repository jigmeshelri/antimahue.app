/**
 * PinScreen integration tests — unpair/switch flow (T-5, unpair-device).
 * REQ-AUTH-7, REQ-AUTH-8, REQ-AUTH-9, REQ-AUTH-10; DD-3, DD-4, DD-5.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { $lock, NEUTRAL_LOCK } from '@/stores/lock'
import type { VaultRecord } from '@/lib/vault'

const mocks = vi.hoisted(() => ({
  listRecords: vi.fn(),
  deleteRecord: vi.fn(),
  usePinUnlock: vi.fn(),
}))

vi.mock('@/lib/vault', () => ({
  listRecords: mocks.listRecords,
  deleteRecord: mocks.deleteRecord,
}))

vi.mock('./usePinUnlock', () => ({
  usePinUnlock: mocks.usePinUnlock,
}))

import PinScreen from './PinScreen'

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

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/pin']}>
      <Routes>
        <Route path="/pin" element={<PinScreen />} />
        <Route path="/pair" element={<div>PairScreen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PinScreen — unpair and switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    $lock.set(NEUTRAL_LOCK)
    mocks.usePinUnlock.mockReturnValue({
      filledCount: 0,
      errorMessage: null,
      pressDigit: vi.fn(),
      pressBackspace: vi.fn(),
    })
  })

  it('should_navigate_to_pair_when_the_last_profile_is_unpaired', async () => {
    const user = userEvent.setup()
    const userA = makeUser({ userId: 'a', displayName: 'Angélica' })
    $lock.set({ failCount: 5, lockedUntil: Date.now() + 30_000, requiresRelogin: false })
    mocks.listRecords.mockResolvedValueOnce([userA]).mockResolvedValueOnce([])
    mocks.deleteRecord.mockResolvedValue(undefined)

    renderScreen()

    await screen.findByText('Angélica · Administradora')
    await user.click(screen.getByRole('button', { name: /desvincular este teléfono/i }))
    await user.click(screen.getByRole('button', { name: 'Sí, desvincular' }))

    await waitFor(() => expect(screen.getByText('PairScreen')).toBeInTheDocument())
    expect(mocks.deleteRecord).toHaveBeenCalledWith('a')
    expect($lock.get()).toEqual(NEUTRAL_LOCK)
  })

  it('should_auto_select_the_remaining_profile_after_unpairing_one_of_two', async () => {
    const user = userEvent.setup()
    const userA = makeUser({ userId: 'a', displayName: 'Angélica' })
    const userB = makeUser({ userId: 'b', displayName: 'Constanza', rol: 'empleado' })
    mocks.listRecords.mockResolvedValueOnce([userA, userB]).mockResolvedValueOnce([userB])
    mocks.deleteRecord.mockResolvedValue(undefined)

    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Angélica/i }))
    await user.click(await screen.findByRole('button', { name: /desvincular este teléfono/i }))
    await user.click(screen.getByRole('button', { name: 'Sí, desvincular' }))

    await waitFor(() => expect(screen.getByText('Constanza · Vendedora')).toBeInTheDocument())
    expect(mocks.deleteRecord).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('button', { name: 'Cambiar de usuario' })).not.toBeInTheDocument()
  })

  it('should_show_the_selector_after_unpairing_one_of_three_profiles', async () => {
    const user = userEvent.setup()
    const userA = makeUser({ userId: 'a', displayName: 'Angélica' })
    const userB = makeUser({ userId: 'b', displayName: 'Constanza', rol: 'empleado' })
    const userC = makeUser({ userId: 'c', displayName: 'Ramón', rol: 'empleado' })
    mocks.listRecords
      .mockResolvedValueOnce([userA, userB, userC])
      .mockResolvedValueOnce([userB, userC])
    mocks.deleteRecord.mockResolvedValue(undefined)

    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Angélica/i }))
    await user.click(await screen.findByRole('button', { name: /desvincular este teléfono/i }))
    await user.click(screen.getByRole('button', { name: 'Sí, desvincular' }))

    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Elige tu usuario' })).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /Constanza/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ramón/i })).toBeInTheDocument()
    expect(mocks.deleteRecord).toHaveBeenCalledWith('a')
  })

  it('should_return_to_the_selector_without_deleting_when_switch_is_tapped', async () => {
    const user = userEvent.setup()
    const userA = makeUser({ userId: 'a', displayName: 'Angélica' })
    const userB = makeUser({ userId: 'b', displayName: 'Constanza', rol: 'empleado' })
    mocks.listRecords.mockResolvedValueOnce([userA, userB])

    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Angélica/i }))
    await user.click(await screen.findByRole('button', { name: 'Cambiar de usuario' }))

    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Elige tu usuario' })).toBeInTheDocument()
    )
    expect(mocks.deleteRecord).not.toHaveBeenCalled()
  })
})
