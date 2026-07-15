/**
 * useIdleLock — React hook (T-8.1/T-8.2, REQ-AUTH-3, DD-9).
 *
 * Wires `idleLock.ts`'s pure decision functions into the DOM: real user
 * interaction events reset the idle clock; `visibilitychange`/`pagehide`/
 * `pageshow`/`freeze`/`resume` track background periods; a foreground
 * `setInterval` catches a device left unattended without ever backgrounding
 * (`visibilitychange` never fires in that case). MUST NOT rely on
 * `setTimeout`/`setInterval` alone while hidden — both are throttled or
 * fully suspended by mobile OSes in a backgrounded PWA; the background path
 * is anchored to `Date.now()` at the synchronous resume event instead (see
 * `idleLock.ts`'s own header for the full reasoning).
 *
 * Locking is UX-ONLY (DD-8): it clears `$auth` in memory (mirroring the
 * revoked-user handling in `pinUnlock.ts`) so `<RequireSession>` (T-8.3)
 * redirects to `PinScreen` immediately — the encrypted vault blob at rest
 * is never touched, and re-unlock reuses the same zero-network PIN-decrypt
 * path (REQ-AUTH-3's second scenario), not a fresh `signInWithPassword`.
 *
 * Not unit-tested directly (no React Testing Library in this repo — same
 * precedent as `usePinUnlock.ts`): all the actual idle-elapsed math this
 * hook delegates to is fully covered in `idleLock.test.ts` with an injected
 * clock. This hook's own DOM wiring is residual manual/browser verification
 * (T-9.1/T-9.4), matching the status already flagged for `PinScreen.tsx`/
 * `EmpleadasScreen.tsx`.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $auth } from '@/stores/auth'
import {
  createIdleTracker,
  DEFAULT_IDLE_THRESHOLD_MS,
  evaluateForegroundTick,
  evaluateResume,
  recordActivity,
  recordHidden,
  type IdleTracker,
} from './idleLock'

/** DOM events that count as "the user is actually here" — passive, never preventDefault. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const

/** How often the foreground (never-backgrounded) idle check polls while visible. */
const FOREGROUND_CHECK_INTERVAL_MS = 15_000

export interface UseIdleLockOptions {
  /** Idle threshold in ms. Defaults to the design's proposed 5 minutes. */
  thresholdMs?: number
}

/** UX-only lock (DD-8/DD-9) — the vault blob at rest is never touched. */
function lockNow(): void {
  $auth.set({ session: null, user: null, rol: null, status: 'locked', loading: false })
}

export function useIdleLock({
  thresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
}: UseIdleLockOptions = {}): void {
  const status = useStore($auth).status
  const trackerRef = useRef<IdleTracker>(createIdleTracker())

  // A fresh unlock (daily PIN entry or an idle-lock resume) starts the idle
  // clock over — otherwise time spent on the PIN screen itself would count
  // against the very next unlocked session.
  useEffect(() => {
    if (status === 'unlocked') trackerRef.current = createIdleTracker()
  }, [status])

  useEffect(() => {
    // Nothing to guard while already locked/unlocking — PinScreen owns the
    // screen at that point, and re-arming here would just add idle-tracking
    // overhead to a screen the user is actively trying to get past.
    if (status !== 'unlocked') return

    function onActivity(): void {
      trackerRef.current = recordActivity()
    }

    function onHidden(): void {
      trackerRef.current = recordHidden(trackerRef.current)
    }

    function onResume(): void {
      const { shouldLock, tracker } = evaluateResume(trackerRef.current, thresholdMs)
      trackerRef.current = tracker
      if (shouldLock) lockNow()
    }

    function onVisibilityChange(): void {
      if (document.hidden) onHidden()
      else onResume()
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // `pagehide`/`pageshow` cover bfcache suspend/restore, which does not
    // always pair with a `visibilitychange` event on every browser.
    window.addEventListener('pagehide', onHidden)
    window.addEventListener('pageshow', onResume)
    // `freeze`/`resume` (Page Lifecycle API) are Chromium-only today — inert
    // elsewhere, kept as defense-in-depth for the mobile PWA target.
    window.addEventListener('freeze', onHidden)
    window.addEventListener('resume', onResume)

    const intervalId = window.setInterval(() => {
      if (document.hidden) return // the background path above owns this case
      if (evaluateForegroundTick(trackerRef.current, thresholdMs)) lockNow()
    }, FOREGROUND_CHECK_INTERVAL_MS)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onHidden)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('freeze', onHidden)
      window.removeEventListener('resume', onResume)
      window.clearInterval(intervalId)
    }
  }, [status, thresholdMs])
}
