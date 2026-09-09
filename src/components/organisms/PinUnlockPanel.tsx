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
 *
 * Unpair/switch action row (unpair-device, DD-1, DD-6, DD-7, DD-8, DD-9):
 * local `unpairState` machine ('idle' | 'confirming' | 'submitting') owns
 * the inline confirm UI in place — the container (`PinScreen`) only ever
 * sees `onUnpair`/`onSwitchUser` callbacks and owns the vault + routing
 * side effects. The action row always occupies the `mb-[38px]` slot
 * (previously on the subtitle) so the pad's vertical rhythm never shifts,
 * whether or not a profile — or its links — are currently shown.
 */
import { useEffect, useId, useRef, useState } from 'react'
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
  /** Confirmed local unpair of `selectedUser`. The container owns vault + routing. */
  onUnpair: () => void | Promise<void>
  /** Back to the picker. `null` when fewer than 2 profiles are paired (hides the link). */
  onSwitchUser: (() => void) | null
}

type UnpairState = 'idle' | 'confirming' | 'submitting'

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administradora',
  empleado: 'Vendedora',
}

const LINK_CLASSES =
  'underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madera disabled:opacity-50'

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
  onUnpair,
  onSwitchUser,
}: PinUnlockPanelProps) {
  const lock = useStore($lock)
  const locked = isLocked(lock)
  const [now, setNow] = useState(() => Date.now())
  const [unpairState, setUnpairState] = useState<UnpairState>('idle')
  const unpairLinkRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const skipNextFocusEffect = useRef(true)
  const noteId = useId()

  useEffect(() => {
    if (!locked) return
    const intervalId = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(intervalId)
  }, [locked])

  // DD-7: move focus to "Cancelar" on entering confirm, back to the link on
  // cancel. Skipped on the very first render so mounting the panel never
  // steals focus.
  useEffect(() => {
    if (skipNextFocusEffect.current) {
      skipNextFocusEffect.current = false
      return
    }
    if (unpairState === 'confirming') cancelRef.current?.focus()
    if (unpairState === 'idle') unpairLinkRef.current?.focus()
  }, [unpairState])

  const countdownText =
    locked && lock.lockedUntil !== null ? formatCountdown(lock.lockedUntil - now) : null

  // DD-6: an in-flight PIN attempt (the 4th digit just landed) writes to the
  // vault record after an await; confirming unpair in that exact window
  // could resurrect the profile if the write lands after `deleteRecord`.
  const pinAttemptInFlight = filledCount === 4
  const submitting = unpairState === 'submitting'

  function handleUnpairTap() {
    setUnpairState('confirming')
  }

  function handleCancel() {
    setUnpairState('idle')
  }

  function handleConfirm() {
    setUnpairState('submitting')
    void onUnpair()
  }

  return (
    <div className="flex w-full flex-col items-center px-[32px] pt-[10px] font-sans">
      <AppIcon />
      <h1 className="mt-[14px] mb-1 text-[26px] font-bold tracking-[-0.025em] text-text-primary">
        Antimahue
      </h1>
      <p className="mb-1 text-[13px] text-text-secondary">
        {selectedUser ? `${selectedUser.displayName} · ${ROL_LABEL[selectedUser.rol]}` : ' '}
      </p>
      <div className="mb-[38px] flex min-h-[44px] flex-col items-center justify-center gap-[8px] text-[13px]">
        {selectedUser && unpairState === 'idle' && (
          <div className="flex flex-col items-center gap-[6px]">
            <button
              ref={unpairLinkRef}
              type="button"
              disabled={pinAttemptInFlight}
              onClick={handleUnpairTap}
              className={`text-text-secondary ${LINK_CLASSES}`}
            >
              ¿No eres tú? Desvincular este teléfono
            </button>
            {onSwitchUser && (
              <button
                type="button"
                disabled={pinAttemptInFlight}
                onClick={onSwitchUser}
                className={`font-semibold text-madera ${LINK_CLASSES}`}
              >
                Cambiar de usuario
              </button>
            )}
          </div>
        )}
        {selectedUser && unpairState !== 'idle' && (
          <div className="flex flex-col items-center gap-[8px]">
            <p id={noteId} className="text-center text-[12px] text-text-muted">
              Necesitarás el correo y la contraseña para volver a vincular.
            </p>
            <div
              role="group"
              aria-label="Confirmar desvinculación"
              aria-describedby={noteId}
              className="flex gap-[8px]"
            >
              <button
                ref={cancelRef}
                type="button"
                disabled={submitting}
                onClick={handleCancel}
                className="rounded-button border border-border-sand bg-bg-card px-[14px] py-[11px] text-[13px] font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madera disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pinAttemptInFlight || submitting}
                onClick={handleConfirm}
                className="rounded-button bg-hoja px-[14px] py-[11px] text-[13px] font-semibold text-bg-pantalla focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madera disabled:opacity-50"
              >
                Sí, desvincular
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mb-4 text-[12px] font-medium tracking-[0.06em] text-text-muted uppercase">
        Ingresa tu PIN
      </p>
      <div className="mb-10">
        <PinDots filledCount={filledCount} />
      </div>
      {countdownText ? (
        <p role="alert" className="mb-3 min-h-[16px] text-[12px] font-medium text-error">
          Bloqueado. Intenta de nuevo en {countdownText}.
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
