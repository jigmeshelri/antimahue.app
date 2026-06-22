/**
 * App entry point — mounts RouterProvider + bootstraps Supabase session.
 *
 * Session bootstrap (design.md D3/D4):
 * - Subscribes to onAuthStateChange to keep $auth store in sync.
 * - Initial session is loaded asynchronously; $auth.loading is true until resolved.
 * - The PIN unlock flow (PinScreen) calls supabase.setSession() after decryption.
 */
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/lib/router'
import { supabase } from '@/lib/supabase'
import { $auth } from '@/stores/auth'

// Bootstrap Supabase session listener.
// Must be called before rendering so the auth state is populated on first render.
supabase.auth.getSession().then(({ data: { session } }) => {
  $auth.set({
    session,
    user: session?.user ?? null,
    loading: false,
  })
})

supabase.auth.onAuthStateChange((_event, session) => {
  $auth.set({
    session,
    user: session?.user ?? null,
    loading: false,
  })
})

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <Suspense fallback={<div aria-label="Cargando..." />}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>
)
