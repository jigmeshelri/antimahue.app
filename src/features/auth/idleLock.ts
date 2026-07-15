/**
 * Wall-clock idle-lock decision logic — Phase 8 (T-8.1; REQ-AUTH-3, DD-9).
 *
 * Pure state-transition functions, zero DOM/React — mirrors the
 * `pinUnlock.ts` / `pairDevice.ts` split (Phases 3/4) so the actual
 * idle-elapsed math is unit-testable with an injected clock, never a real
 * wall-clock sleep. `useIdleLock.ts` wires these into
 * `visibilitychange`/`pagehide`/`pageshow`/`freeze`/`resume` DOM listeners
 * plus a foreground `setInterval`, and is NOT unit-tested directly — same
 * precedent already established for `usePinUnlock.ts` (no React Testing
 * Library in this repo; hook behavior is residual manual/browser
 * verification, matching T-4.9/T-6.2/T-7.2's own flagged status).
 *
 * Two independent paths, both required (design.md §5's own wording):
 *
 * 1. BACKGROUND path (`hiddenAt`) — the robust one for a backgrounded PWA.
 *    `recordHidden` stamps the wall-clock instant the page is last known to
 *    have gone hidden/frozen; `evaluateResume` computes the elapsed delta
 *    against `Date.now()` at the moment the page is confirmed visible
 *    again. This MUST NOT rely on a running timer while hidden — mobile
 *    OSes throttle or fully suspend `setTimeout`/`setInterval` in a
 *    backgrounded tab, but the visibilitychange/pageshow events themselves
 *    still fire synchronously on resume, and `Date.now()` is always correct
 *    at that instant regardless of what happened to any timer in between.
 *
 * 2. FOREGROUND path (`lastActiveAt`) — catches a device left propped up and
 *    genuinely unattended without ever being backgrounded (a phone on a
 *    counter, screen never turned off, `visibilitychange` never fires).
 *    `evaluateForegroundTick` is meant to be polled periodically (a
 *    foreground-only `setInterval`, safe from the throttling concern above
 *    because the tab stays visible the whole time) and compares against the
 *    last real user interaction.
 */

export const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60 * 1000 // 5 min — design.md Open Questions default

export interface IdleTracker {
  /** Wall-clock time of the last confirmed user interaction (click/touch/key). */
  lastActiveAt: number
  /** Wall-clock time the page most recently became hidden/frozen, or null while visible/foreground. */
  hiddenAt: number | null
}

/** Fresh tracker — call once on mount and again every time a session becomes unlocked. */
export function createIdleTracker(now: number = Date.now()): IdleTracker {
  return { lastActiveAt: now, hiddenAt: null }
}

/**
 * Call on any real user interaction. Resets the idle clock and clears any
 * pending hidden-since mark (an interaction can only happen while visible).
 */
export function recordActivity(now: number = Date.now()): IdleTracker {
  return { lastActiveAt: now, hiddenAt: null }
}

/**
 * Call when the page becomes hidden/frozen (`visibilitychange`→hidden,
 * `pagehide`, `freeze`). Idempotent — a repeated "hidden" signal while
 * already tracking one does not push the mark forward, so the ELAPSED time
 * is always measured from the FIRST moment the page left the foreground.
 */
export function recordHidden(tracker: IdleTracker, now: number = Date.now()): IdleTracker {
  return tracker.hiddenAt === null ? { ...tracker, hiddenAt: now } : tracker
}

export interface ResumeResult {
  /** True when the background idle period exceeded the threshold — caller must lock. */
  shouldLock: boolean
  /** The tracker reset for the new foreground period, regardless of the lock decision. */
  tracker: IdleTracker
}

/**
 * Call when the page is confirmed visible/foreground again
 * (`visibilitychange`→visible, `pageshow`, `resume`). Safe to call
 * unconditionally on every such event, including a page's very first load
 * (`hiddenAt` is null then, so `elapsed` is 0 and `shouldLock` is false).
 */
export function evaluateResume(
  tracker: IdleTracker,
  thresholdMs: number,
  now: number = Date.now()
): ResumeResult {
  const elapsed = tracker.hiddenAt === null ? 0 : now - tracker.hiddenAt
  return {
    shouldLock: elapsed > thresholdMs,
    tracker: { lastActiveAt: now, hiddenAt: null },
  }
}

/**
 * Call on each foreground interval tick. Only meaningful while the page has
 * never left the foreground (`hiddenAt === null`) — once a hidden period
 * starts, the background path above owns the decision, so this returns
 * `false` unconditionally in that case rather than double-locking.
 */
export function evaluateForegroundTick(
  tracker: IdleTracker,
  thresholdMs: number,
  now: number = Date.now()
): boolean {
  if (tracker.hiddenAt !== null) return false
  return now - tracker.lastActiveAt > thresholdMs
}
