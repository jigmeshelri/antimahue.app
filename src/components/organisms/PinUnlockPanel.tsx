/**
 * PinUnlockPanel — organism (T-4.7, DD-10).
 *
 * Composes handoff screen 1 in full: `AppIcon` + title "Antimahue" +
 * subtitle (the selected profile's name/role) + "INGRESA TU PIN" label +
 * `PinDots` + `PinPad`, plus a lockout countdown this organism reads
 * directly from `$lock` (per design.md §6's own component table) rather
 * than having the container thread it through as a prop. The countdown
 * re-renders once a second by ticking a `now` STATE value from a
 * `setInterval` — `Date.now()` itself is only ever called inside that
 * effect callback, never during render, per the impure-render-body rule
 * (`react-hooks/purity`).
 */
import { useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'
import AppIcon from '@/components/atoms/AppIcon'
import PinDots from '@/components/molecules/PinDots'
import PinPad from '@/components/molecules/PinPad'
import { $lock, isLocked } from '@/stores/lock'
import type { Rol, VaultRecord } from '@/lib/vault'

interface PinUnlockPanelProps {
  selectedUser: VaultRecord | null
  filledCount: number
  errorMessage: string | null
  onDigit: (digit: string) => void
  onBackspace: () => void
}

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administradora',
  empleado: 'Vendedora',
}

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`
}

export default function PinUnlockPanel({
  selectedUser,
  filledCount,
  errorMessage,
  onDigit,
  onBackspace,
}: PinUnlockPanelProps) {
  const lock = useStore($lock)
  const locked = isLocked(lock)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!locked) return
    const intervalId = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(intervalId)
  }, [locked])

  const countdownText =
    locked && lock.lockedUntil !== null ? formatCountdown(lock.lockedUntil - now) : null

  return (
    <div className="flex w-full flex-col items-center px-[32px] pt-[10px] font-sans">
      <AppIcon />
      <h1 className="mt-[14px] mb-1 text-[26px] font-bold tracking-[-0.025em] text-text-primary">
        Antimahue
      </h1>
      <p className="mb-[38px] text-[13px] text-text-secondary">
        {selectedUser ? `${selectedUser.displayName} · ${ROL_LABEL[selectedUser.rol]}` : ' '}
      </p>
      <p className="mb-4 text-[12px] font-medium tracking-[0.06em] text-text-muted uppercase">
        Ingresa tu PIN
      </p>
      <div className="mb-10">
        <PinDots filledCount={filledCount} />
      </div>
      {countdownText ? (
        <p role="alert" className="mb-3 min-h-[16px] text-[12px] font-medium text-error">
          Bloqueado. Probá de nuevo en {countdownText}.
        </p>
      ) : (
        <p role="alert" className="mb-3 min-h-[16px] text-[12px] font-medium text-error">
          {errorMessage}
        </p>
      )}
      <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={locked || !selectedUser} />
    </div>
  )
}
