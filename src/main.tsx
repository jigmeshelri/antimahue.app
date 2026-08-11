/**
 * App entry point — mounts RouterProvider + bootstraps Supabase session.
 *
 * Session bootstrap (design.md D3/D4, DD-7):
 * - Subscribes to onAuthStateChange to keep $auth store in sync.
 * - Initial session is loaded asynchronously; $auth.loading is true until resolved.
 * - The PIN unlock flow (PinScreen) calls supabase.setSession() after decryption.
 *
 * `rol` is intentionally left `null` here — REQ-AUTH-4 resolves it by
 * reading the caller's own `profiles` row, which is `usePinUnlock`'s job
 * (Phase 4), not this bootstrap. `status` is derived from session presence
 * only as a placeholder: since `persistSession: false` (DD-7) means
 * supabase-js never restores a session across a reload, `getSession()` on a
 * fresh load normally resolves `session: null` → `'locked'`, which is
 * exactly the desired "always boots to PinScreen" behavior.
 *
 * Idle auto-lock (DD-9, Phase 8, T-8.2): `useIdleLock` is called from
 * `AppShell` below, ONE level above `RouterProvider`, so it runs for the
 * lifetime of the app regardless of route — a route-scoped placement would
 * stop tracking idle time the moment `<RequireSession>` (T-8.3) redirects
 * to `/`, which is exactly the wrong moment to stop.
 */
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/lib/router'
import { supabase } from '@/lib/supabase'
import { $auth } from '@/stores/auth'
import { useIdleLock } from '@/features/auth/useIdleLock'
import { Toast } from '@/components/organisms'
import '@/index.css'

// Bootstrap Supabase session listener.
// Must be called before rendering so the auth state is populated on first render.
supabase.auth.getSession().then(({ data: { session } }) => {
  $auth.set({
    session,
    user: session?.user ?? null,
    rol: null,
    status: session ? 'unlocked' : 'locked',
    loading: false,
  })
})

supabase.auth.onAuthStateChange((_event, session) => {
  $auth.set({
    session,
    user: session?.user ?? null,
    rol: $auth.get().rol,
    status: session ? 'unlocked' : 'locked',
    loading: false,
  })
})

/** Mounts the idle-lock watcher above the router so it survives every route (T-8.2). */
function AppShell() {
  useIdleLock()
  return (
    <>
      <RouterProvider router={router} />
      <Toast />
    </>
  )
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <Suspense fallback={<div aria-label="Cargando..." />}>
      <AppShell />
    </Suspense>
  </StrictMode>
)
