/**
 * usePinUnlock — React hook (T-4.8, DD-2, DD-7, DD-10).
 *
 * Thin state machine over `pinUnlock.ts`'s pure orchestration: accumulates
 * the 4 tapped digits, fires `attemptUnlock` on the 4th, and translates the
 * result into the UI-facing shape `PinUnlockPanel`/`PinScreen` render. Kept
 * framework-free of routing on purpose — `onUnlocked`/`onWiped` are plain
 * callbacks, so a screen other than `PinScreen` (Phase 8's idle-lock
 * re-unlock, per design.md §5) can reuse this same hook without navigating
 * anywhere on success.
 *
 * Not unit-tested directly (no React rendering harness — e.g.
 * `@testing-library/react` — is installed in this repo, matching the same
 * choice already made for `PairDeviceScreen.tsx` in Phase 3): all the
 * security-relevant logic this hook calls into (`attemptUnlock`) is fully
 * covered in `pinUnlock.test.ts`. This hook's own behavior is verified by
 * the manual walkthrough tasks.md T-4.9 already prescribes.
 *
 * Resetting `digits`/`errorMessage` when `userId` changes uses React's
 * documented "adjust state during render" idiom (comparing against a
 * tracked-previous-userId state) rather than a `useEffect` — a `setState`
 * called unconditionally inside an effect body is flagged by
 * `react-hooks/set-state-in-effect` as a cascading-render anti-pattern.
 * Syncing `$lock` from the vault stays in its own effect: it is a real
 * external-system read (IndexedDB), not a React state update.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { attemptUnlock, PinUnlockError, syncLockFromVault } from './pinUnlock'

const NAVIGATE_DELAY_MS = 350

export interface UsePinUnlockOptions {
  userId: string | null
  /** Called ~350ms after a correct PIN, mirroring the handoff's own timing. */
  onUnlocked?: () => void
  /** Called after a 9th-failure wipe — the caller should route to pairing. */
  onWiped?: () => void
}

export interface UsePinUnlockResult {
  filledCount: number
  errorMessage: string | null
  pressDigit: (digit: string) => void
  pressBackspace: () => void
}

export function usePinUnlock({
  userId,
  onUnlocked,
  onWiped,
}: UsePinUnlockOptions): UsePinUnlockResult {
  const [digits, setDigits] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [trackedUserId, setTrackedUserId] = useState(userId)
  const submittingRef = useRef(false)

  if (userId !== trackedUserId) {
    setTrackedUserId(userId)
    setDigits('')
    setErrorMessage(null)
  }

  useEffect(() => {
    if (userId) void syncLockFromVault(userId)
  }, [userId])

  const submit = useCallback(
    async (pin: string) => {
      if (!userId || submittingRef.current) return
      submittingRef.current = true
      try {
        await attemptUnlock(userId, pin)
        window.setTimeout(() => {
          setDigits('')
          onUnlocked?.()
        }, NAVIGATE_DELAY_MS)
      } catch (err) {
        setDigits('')
        if (err instanceof PinUnlockError) {
          setErrorMessage(err.message)
          if (err.kind === 'wiped') onWiped?.()
        } else {
          setErrorMessage('No se pudo desbloquear. Probá de nuevo.')
        }
      } finally {
        submittingRef.current = false
      }
    },
    [userId, onUnlocked, onWiped]
  )

  const pressDigit = useCallback(
    (digit: string) => {
      if (!userId || submittingRef.current) return
      setErrorMessage(null)
      setDigits((previous) => {
        if (previous.length >= 4) return previous
        const next = previous + digit
        if (next.length === 4) void submit(next)
        return next
      })
    },
    [userId, submit]
  )

  const pressBackspace = useCallback(() => {
    if (submittingRef.current) return
    setDigits((previous) => previous.slice(0, -1))
  }, [])

  return { filledCount: digits.length, errorMessage, pressDigit, pressBackspace }
}
