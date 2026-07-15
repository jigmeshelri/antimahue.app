/**
 * App router — D1.
 *
 * React Router v7, createBrowserRouter (SPA library mode, no SSR — REQ-SETUP-11).
 * All feature screens are lazy-loaded to keep the initial bundle minimal (PWA goal).
 *
 * Route map (9 handoff screens, design.md component architecture):
 *   /           → PinScreen      (auth gate — always first, never guarded)
 *   /pair       → PairDeviceScreen (TEMP, T-3.2 — standalone testability for
 *                 device pairing; superseded by the "+ vincular" affordance
 *                 wired into UserSelector in Phase 4, T-4.6; never guarded —
 *                 pairing itself establishes no `$auth` session)
 *   /dashboard  → DashboardScreen       (<RequireSession>)
 *   /venta      → SaleScreen            (<RequireSession>)
 *   /venta/:id/ticket → TicketView      (<RequireSession>)
 *   /escaner    → ScannerScreen         (<RequireSession>)
 *   /catalogo   → CatalogScreen         (<RequireSession>)
 *   /catalogo/:id → ProductDetailScreen (<RequireSession>)
 *   /proveedor  → SupplierScreen        (<RequireAdmin> — session + role)
 *   /dte        → DteImportScreen       (<RequireAdmin> — session + role)
 *   /empleadas  → EmpleadasScreen (NET-NEW, Phase 6 T-6.3, DD-11 — admin-only
 *                 employee-management screen, absent from the 9-screen
 *                 hi-fi handoff; now wrapped in <RequireAdmin> (T-8.4) on
 *                 top of its own pre-existing in-component admin gate,
 *                 which stays as defense-in-depth)
 *
 * Route guards (T-8.3/T-8.4, DD-8): `<RequireSession>`/`<RequireAdmin>`
 * below are thin JSX wrappers over the pure decision functions in
 * `./routeGuards` (unit-tested there without a router harness). Both are
 * UX concealment only — the real authorization boundary is Postgres
 * (RLS/RPC), never this layer. See `routeGuards.ts`'s own header for the
 * full reasoning, including the cold-load/deep-link `from` handling.
 */
import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import { lazy, type ReactNode } from 'react'
import { useStore } from '@nanostores/react'
import { $auth } from '@/stores/auth'
import { decideAdminGuard, decideSessionGuard } from './routeGuards'

// Lazy imports — each feature slice is a separate chunk in the build.
const PinScreen = lazy(() => import('@/features/auth/PinScreen'))
const PairDeviceScreen = lazy(() => import('@/features/auth/PairDeviceScreen'))
const DashboardScreen = lazy(() => import('@/features/dashboard/DashboardScreen'))
const SaleScreen = lazy(() => import('@/features/venta/SaleScreen'))
const TicketView = lazy(() => import('@/features/venta/TicketView'))
const ScannerScreen = lazy(() => import('@/features/escaner/ScannerScreen'))
const CatalogScreen = lazy(() => import('@/features/catalogo/CatalogScreen'))
const ProductDetailScreen = lazy(() => import('@/features/catalogo/ProductDetailScreen'))
const SupplierScreen = lazy(() => import('@/features/proveedor/SupplierScreen'))
const DteImportScreen = lazy(() => import('@/features/dte/DteImportScreen'))
const EmpleadasScreen = lazy(() => import('@/features/empleadas/EmpleadasScreen'))

/**
 * T-8.3 — redirects to `/` (PinScreen) whenever `$auth.status !== 'unlocked'`.
 * Threads the current path through as `location.state.from` so `PinScreen`
 * can return the user to their original destination after a successful
 * unlock (see `routeGuards.ts`'s own header for the cold-load/deep-link
 * reasoning) instead of always bouncing to `/dashboard`.
 */
function RequireSession({ children }: { children: ReactNode }) {
  const auth = useStore($auth)
  const location = useLocation()
  const decision = decideSessionGuard(auth, location.pathname)

  if (decision.kind === 'redirect') {
    return <Navigate to={decision.to} replace state={{ from: decision.from }} />
  }
  return children
}

/**
 * T-8.4 — admin-only routes. Composes the session check (an admin route is
 * also, obviously, a session-requiring route) so callers only ever need to
 * wrap ONE guard around an admin screen, never both.
 */
function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useStore($auth)
  const location = useLocation()
  const decision = decideAdminGuard(auth, location.pathname)

  if (decision.kind === 'redirect') {
    return <Navigate to={decision.to} replace state={{ from: decision.from }} />
  }
  return children
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PinScreen />,
  },
  {
    path: '/pair',
    element: <PairDeviceScreen />,
  },
  {
    path: '/dashboard',
    element: (
      <RequireSession>
        <DashboardScreen />
      </RequireSession>
    ),
  },
  {
    path: '/venta',
    element: (
      <RequireSession>
        <SaleScreen />
      </RequireSession>
    ),
  },
  {
    path: '/venta/:id/ticket',
    element: (
      <RequireSession>
        <TicketView />
      </RequireSession>
    ),
  },
  {
    path: '/escaner',
    element: (
      <RequireSession>
        <ScannerScreen />
      </RequireSession>
    ),
  },
  {
    path: '/catalogo',
    element: (
      <RequireSession>
        <CatalogScreen />
      </RequireSession>
    ),
  },
  {
    path: '/catalogo/:id',
    element: (
      <RequireSession>
        <ProductDetailScreen />
      </RequireSession>
    ),
  },
  {
    path: '/proveedor',
    element: (
      <RequireAdmin>
        <SupplierScreen />
      </RequireAdmin>
    ),
  },
  {
    path: '/dte',
    element: (
      <RequireAdmin>
        <DteImportScreen />
      </RequireAdmin>
    ),
  },
  {
    path: '/empleadas',
    element: (
      <RequireAdmin>
        <EmpleadasScreen />
      </RequireAdmin>
    ),
  },
])
