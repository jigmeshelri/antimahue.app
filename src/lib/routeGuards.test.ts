/**
 * Route-guard decision tests — T-8.3/T-8.4 (DD-8).
 */
import { describe, expect, it } from 'vitest'
import { decideAdminGuard, decideSessionGuard } from './routeGuards'

describe('decideSessionGuard', () => {
  it('should_allow_when_the_session_is_unlocked', () => {
    const decision = decideSessionGuard({ status: 'unlocked' }, '/dashboard')

    expect(decision).toEqual({ kind: 'allow' })
  })

  it('should_redirect_to_the_pin_screen_with_the_current_path_when_locked', () => {
    const decision = decideSessionGuard({ status: 'locked' }, '/empleadas')

    expect(decision).toEqual({ kind: 'redirect', to: '/', from: '/empleadas' })
  })

  it('should_redirect_to_the_pin_screen_when_unlocking', () => {
    const decision = decideSessionGuard({ status: 'unlocking' }, '/venta')

    expect(decision).toEqual({ kind: 'redirect', to: '/', from: '/venta' })
  })
})

describe('decideAdminGuard', () => {
  it('should_allow_an_unlocked_admin', () => {
    const decision = decideAdminGuard({ status: 'unlocked', rol: 'admin' }, '/empleadas')

    expect(decision).toEqual({ kind: 'allow' })
  })

  it('should_redirect_an_unlocked_empleado_to_the_dashboard', () => {
    const decision = decideAdminGuard({ status: 'unlocked', rol: 'empleado' }, '/empleadas')

    expect(decision).toEqual({ kind: 'redirect', to: '/dashboard' })
  })

  it('should_redirect_to_the_pin_screen_before_ever_checking_role_when_locked', () => {
    const decision = decideAdminGuard({ status: 'locked', rol: null }, '/proveedor')

    expect(decision).toEqual({ kind: 'redirect', to: '/', from: '/proveedor' })
  })

  it('should_redirect_to_the_pin_screen_for_a_locked_admin_never_leaking_the_dashboard_bounce', () => {
    // Guards against a regression where the session check is skipped for a
    // `rol==='admin'` cached hint — the session check MUST run first.
    const decision = decideAdminGuard({ status: 'locked', rol: 'admin' }, '/dte')

    expect(decision).toEqual({ kind: 'redirect', to: '/', from: '/dte' })
  })

  it('should_redirect_an_unlocked_null_rol_session_to_the_dashboard_not_allow_it', () => {
    // Gap #8's residual edge case, made explicit: a session that is somehow
    // 'unlocked' with rol still null (should not happen in practice — see
    // routeGuards.ts's own header note) must never be treated as admin.
    const decision = decideAdminGuard({ status: 'unlocked', rol: null }, '/empleadas')

    expect(decision).toEqual({ kind: 'redirect', to: '/dashboard' })
  })
})
