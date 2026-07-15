/**
 * PinScreen — auth feature (Screen 1), real container (T-4.9, DD-10).
 *
 * Wires `listRecords()` (the local PIN-selector source, DD-3 RFC) +
 * `usePinUnlock` into the atomic-design layer built for this phase:
 * `UserSelector` when there's a choice to make (0 or 2+ paired profiles on
 * this device), `PinUnlockPanel` once a single profile is selected — either
 * chosen by the employee or auto-selected when it's the only one paired
 * (handoff-mandated ≤2-tap daily path).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import PinUnlockPanel from '@/components/organisms/PinUnlockPanel'
import UserSelector from '@/components/molecules/UserSelector'
import { listRecords, type VaultRecord } from '@/lib/vault'
import { usePinUnlock } from './usePinUnlock'

export default function PinScreen() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<VaultRecord[] | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listRecords().then((loaded) => {
      if (cancelled) return
      setRecords(loaded)
      if (loaded.length === 1) setSelectedUserId(loaded[0].userId)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { filledCount, errorMessage, pressDigit, pressBackspace } = usePinUnlock({
    userId: selectedUserId,
    onUnlocked: () => navigate('/dashboard'),
    onWiped: () => navigate('/pair'),
  })

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
          selectedUser={selectedUser}
          filledCount={filledCount}
          errorMessage={errorMessage}
          onDigit={pressDigit}
          onBackspace={pressBackspace}
        />
      )}
    </div>
  )
}
