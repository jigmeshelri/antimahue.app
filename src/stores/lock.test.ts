/**
 * Lockout curve state-transition tests — T-2.4 (DD-2 backoff table).
 */
import { describe, expect, it } from 'vitest'
import { isLocked, nextLockState, type LockState } from './lock'

describe('nextLockState', () => {
  it('should_not_lock_when_failure_count_is_below_5', () => {
    for (let previous = 0; previous <= 3; previous++) {
      const state = nextLockState(previous, 1_000)

      expect(state.failCount).toBe(previous + 1)
      expect(state.lockedUntil).toBeNull()
      expect(state.requiresRelogin).toBe(false)
    }
  })

  it('should_lock_for_30_seconds_on_the_5th_consecutive_failure', () => {
    const now = 1_000
    const state = nextLockState(4, now)

    expect(state.failCount).toBe(5)
    expect(state.lockedUntil).toBe(now + 30_000)
    expect(state.requiresRelogin).toBe(false)
  })

  it('should_lock_for_2_minutes_on_the_6th_consecutive_failure', () => {
    const now = 1_000
    const state = nextLockState(5, now)

    expect(state.failCount).toBe(6)
    expect(state.lockedUntil).toBe(now + 2 * 60_000)
  })

  it('should_lock_for_10_minutes_on_the_7th_consecutive_failure', () => {
    const now = 1_000
    const state = nextLockState(6, now)

    expect(state.failCount).toBe(7)
    expect(state.lockedUntil).toBe(now + 10 * 60_000)
  })

  it('should_lock_for_1_hour_on_the_8th_consecutive_failure', () => {
    const now = 1_000
    const state = nextLockState(7, now)

    expect(state.failCount).toBe(8)
    expect(state.lockedUntil).toBe(now + 60 * 60_000)
    expect(state.requiresRelogin).toBe(false)
  })

  it('should_require_relogin_with_no_timed_cooldown_on_the_9th_consecutive_failure', () => {
    const now = 1_000
    const state = nextLockState(8, now)

    expect(state.failCount).toBe(9)
    expect(state.lockedUntil).toBeNull()
    expect(state.requiresRelogin).toBe(true)
  })

  it('should_keep_requiring_relogin_for_failure_counts_beyond_9', () => {
    const state = nextLockState(9, 1_000)

    expect(state.failCount).toBe(10)
    expect(state.lockedUntil).toBeNull()
    expect(state.requiresRelogin).toBe(true)
  })

  it('should_default_now_to_Date_now_when_not_provided', () => {
    const before = Date.now()
    const state = nextLockState(4)
    const after = Date.now()

    expect(state.lockedUntil).not.toBeNull()
    expect(state.lockedUntil as number).toBeGreaterThanOrEqual(before + 30_000)
    expect(state.lockedUntil as number).toBeLessThanOrEqual(after + 30_000)
  })
})

describe('isLocked', () => {
  const baseState: LockState = { failCount: 0, lockedUntil: null, requiresRelogin: false }

  it('should_return_false_when_lockedUntil_is_null', () => {
    expect(isLocked(baseState)).toBe(false)
  })

  it('should_return_true_when_now_is_before_lockedUntil', () => {
    const state: LockState = { ...baseState, failCount: 5, lockedUntil: Date.now() + 10_000 }

    expect(isLocked(state)).toBe(true)
  })

  it('should_return_false_once_lockedUntil_has_passed', () => {
    const state: LockState = { ...baseState, failCount: 5, lockedUntil: Date.now() - 1 }

    expect(isLocked(state)).toBe(false)
  })
})
