/**
 * Wall-clock idle-lock decision tests — T-8.1 (REQ-AUTH-3, DD-9).
 *
 * All cases use an injected `now`, never a real wall-clock sleep — this is
 * the exact scenario design.md/tasks.md prescribe ("fake-timer test: hidden
 * 6min→visible locks; hidden 2min→visible stays unlocked").
 */
import { describe, expect, it } from 'vitest'
import {
  createIdleTracker,
  DEFAULT_IDLE_THRESHOLD_MS,
  evaluateForegroundTick,
  evaluateResume,
  recordActivity,
  recordHidden,
  type IdleTracker,
} from './idleLock'

const THRESHOLD = 5 * 60_000 // 5 min, matching DEFAULT_IDLE_THRESHOLD_MS

describe('createIdleTracker', () => {
  it('should_start_with_no_hidden_mark_at_the_given_instant', () => {
    const tracker = createIdleTracker(1_000)

    expect(tracker).toEqual({ lastActiveAt: 1_000, hiddenAt: null })
  })
})

describe('recordActivity', () => {
  it('should_reset_lastActiveAt_and_clear_any_pending_hidden_mark', () => {
    const tracker = recordActivity(2_000)

    expect(tracker).toEqual({ lastActiveAt: 2_000, hiddenAt: null })
  })
})

describe('recordHidden', () => {
  it('should_stamp_hiddenAt_on_the_first_hidden_signal', () => {
    const tracker = createIdleTracker(1_000)

    const next = recordHidden(tracker, 1_500)

    expect(next.hiddenAt).toBe(1_500)
  })

  it('should_not_move_hiddenAt_forward_on_a_repeated_hidden_signal', () => {
    const tracker = recordHidden(createIdleTracker(1_000), 1_500)

    const next = recordHidden(tracker, 9_999)

    expect(next.hiddenAt).toBe(1_500)
  })
})

describe('evaluateResume — the background (visibilitychange) path', () => {
  it('should_lock_when_hidden_for_6_minutes', () => {
    const hiddenAt = 0
    const tracker: IdleTracker = { lastActiveAt: hiddenAt, hiddenAt }
    const resumeAt = 6 * 60_000

    const result = evaluateResume(tracker, THRESHOLD, resumeAt)

    expect(result.shouldLock).toBe(true)
  })

  it('should_stay_unlocked_when_hidden_for_only_2_minutes', () => {
    const hiddenAt = 0
    const tracker: IdleTracker = { lastActiveAt: hiddenAt, hiddenAt }
    const resumeAt = 2 * 60_000

    const result = evaluateResume(tracker, THRESHOLD, resumeAt)

    expect(result.shouldLock).toBe(false)
  })

  it('should_treat_exactly_the_threshold_as_still_unlocked', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: 0 }

    const result = evaluateResume(tracker, THRESHOLD, THRESHOLD)

    expect(result.shouldLock).toBe(false)
  })

  it('should_lock_one_millisecond_past_the_threshold', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: 0 }

    const result = evaluateResume(tracker, THRESHOLD, THRESHOLD + 1)

    expect(result.shouldLock).toBe(true)
  })

  it('should_never_lock_when_hiddenAt_is_null_even_at_a_far_future_now', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: null }

    const result = evaluateResume(tracker, THRESHOLD, 10 * THRESHOLD)

    expect(result.shouldLock).toBe(false)
  })

  it('should_reset_the_tracker_for_a_fresh_foreground_period_regardless_of_the_lock_decision', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: 0 }

    const locked = evaluateResume(tracker, THRESHOLD, 6 * 60_000)
    const notLocked = evaluateResume(tracker, THRESHOLD, 60_000)

    expect(locked.tracker).toEqual({ lastActiveAt: 6 * 60_000, hiddenAt: null })
    expect(notLocked.tracker).toEqual({ lastActiveAt: 60_000, hiddenAt: null })
  })

  it('should_default_now_to_Date_now_when_not_provided', () => {
    const before = Date.now()
    const result = evaluateResume({ lastActiveAt: 0, hiddenAt: null }, THRESHOLD)
    const after = Date.now()

    expect(result.tracker.lastActiveAt).toBeGreaterThanOrEqual(before)
    expect(result.tracker.lastActiveAt).toBeLessThanOrEqual(after)
  })
})

describe('evaluateForegroundTick — the foreground (unattended, never-hidden) path', () => {
  it('should_lock_when_idle_in_the_foreground_beyond_the_threshold', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: null }

    expect(evaluateForegroundTick(tracker, THRESHOLD, 6 * 60_000)).toBe(true)
  })

  it('should_stay_unlocked_when_within_the_foreground_threshold', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: null }

    expect(evaluateForegroundTick(tracker, THRESHOLD, 60_000)).toBe(false)
  })

  it('should_defer_to_the_background_path_and_never_lock_once_a_hidden_mark_exists', () => {
    const tracker: IdleTracker = { lastActiveAt: 0, hiddenAt: 0 }

    expect(evaluateForegroundTick(tracker, THRESHOLD, 10 * THRESHOLD)).toBe(false)
  })
})

describe('DEFAULT_IDLE_THRESHOLD_MS', () => {
  it('should_be_5_minutes', () => {
    expect(DEFAULT_IDLE_THRESHOLD_MS).toBe(5 * 60 * 1000)
  })
})
