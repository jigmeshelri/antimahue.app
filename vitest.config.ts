/**
 * Vitest config — T-0.3 (Phase 0 apply gate).
 *
 * Kept separate from `vite.config.ts` (the production build config) so the
 * PWA/Tailwind plugins never load in the test runner — this suite only needs
 * the `@` path alias plus a jsdom environment for future component tests.
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
