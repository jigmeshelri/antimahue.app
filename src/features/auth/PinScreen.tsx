/**
 * PinScreen — auth feature (Screen 1), real container (T-4.9, DD-10).
 *
 * Wires `listRecords()` (the local PIN-selector source, DD-3 RFC) +
 * `usePinUnlock` into the atomic-design layer built for this phase:
 * `UserSelector` when there's a choice to make (0 or 2+ paired profiles on
 * this device), `PinUnlockPanel` once a single profile is selected — either
 * chosen by the employee or auto-selected when it's the only one paired
 * (handoff-mandated ≤2-tap daily path).
 *
 * Post-unlock destination (Phase 8, T-8.3): `<RequireSession>`/
 * `<RequireAdmin>` (`src/lib/router.tsx`) redirect here with
 * `location.state.from` set to whatever route the user was actually trying
 * to reach — a cold reload on `/empleadas`, an idle-lock while on `/venta`,
 * etc. On a successful unlock, resume THAT route instead of always landing
 * on `/dashboard`. Falls back to `/dashboard` when there is no `from` (the
 * everyday case: opening the app fresh).
 *
 * Unpair / switch (unpair-device, DD-3, DD-4, DD-5): this container is the
 * sole owner of the vault write and the `$lock` reset — `PinUnlockPanel`
 * only ever calls back through `onUnpair`/`onSwitchUser`. `autoSelectedUserId`
 * is shared between the mount effect and `handleUnpair` so the "0 → /pair,
 * 1 → auto-select, 2+ → selector" rule is expressed exactly once.
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import PinUnlockPanel from '@/components/organisms/PinUnlockPanel'
import UserSelector from '@/components/molecules/UserSelector'
import { deleteRecord, listRecords, type VaultRecord } from '@/lib/vault'
import { resetLock } from '@/stores/lock'
import { usePinUnlock } from './usePinUnlock'

interface PinScreenLocationState {
  from?: string
}

/** 1 record → auto-select it; 0 or 2+ records → no auto-selection (DD-5). */
function autoSelectedUserId(records: VaultRecord[]): string | null {
  return records.length === 1 ? records[0].userId : null
}

export default function PinScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [records, setRecords] = useState<VaultRecord[] | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listRecords().then((loaded) => {
      if (cancelled) return
      setRecords(loaded)
      setSelectedUserId(autoSelectedUserId(loaded))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { filledCount, errorMessage, pressDigit, pressBackspace } = usePinUnlock({
    userId: selectedUserId,
    onUnlocked: () => {
      const from = (location.state as PinScreenLocationState | null)?.from
      navigate(from ?? '/dashboard', { replace: true })
    },
    onWiped: () => navigate('/pair'),
  })

  async function handleUnpair(userId: string) {
    await deleteRecord(userId)
    resetLock()
    const freshRecords = await listRecords()
    if (freshRecords.length === 0) {
      navigate('/pair', { replace: true })
      return
    }
    setRecords(freshRecords)
    setSelectedUserId(autoSelectedUserId(freshRecords))
  }

  function handleSwitchUser() {
    setSelectedUserId(null)
  }

  if (records === null) {
    // Loading `listRecords()` is a single fast IDB round-trip — an empty
    // pergamino-colored frame avoids a flash of unstyled content without
    // needing a dedicated spinner component for this phase.
    return <div className="min-h-screen bg-bg-pantalla" aria-hidden="true" />
  }

  const selectedUser = records.find((record) => record.userId === selectedUserId) ?? null
  const showSelector = records.length !== 1 && selectedUserId === null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg-pantalla py-10 font-sans">
      {showSelector ? (
        <UserSelector records={records} onSelect={setSelectedUserId} />
      ) : (
        <PinUnlockPanel
          key={selectedUser ? selectedUser.userId : 'no-user'}
          selectedUser={selectedUser}
          filledCount={filledCount}
          errorMessage={errorMessage}
          onDigit={pressDigit}
          onBackspace={pressBackspace}
          onUnpair={() => {
            if (selectedUser) return handleUnpair(selectedUser.userId)
          }}
          onSwitchUser={records.length >= 2 ? handleSwitchUser : null}
        />
      )}
    </div>
  )
}
