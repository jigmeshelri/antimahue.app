# AGENTS — Proyecto Antimahue

> Estado al 2026-07-05: app **LIVE en producción** (`antimahue.com`). La guía completa del repo vive en `CLAUDE.md` — este archivo es el resumen operativo para agentes. Mantener ambos sincronizados.

## Comandos reales

- `pnpm dev` — dev server Vite (`http://localhost:5173`).
- `pnpm build` — typecheck + bundle (build-gate).
- `pnpm typecheck` — typecheck sin emitir.
- `pnpm preview` — sirve el `dist/` buildeado.
- `pnpm lint` — ESLint.
- `pnpm format` / `pnpm format:check` — Prettier (escribe / solo chequea).
- `pnpm test` — Vitest. `76 passed | 7 skipped` por default (CI parity); los skips son la batería RLS multi-rol, local-only — `RUN_LOCAL_RLS_BATTERY=1 pnpm test` la fuerza contra un stack Supabase local → 83/83.
- CI (`.github/workflows/ci.yml`, GitHub Actions) corre lint + format:check + typecheck + test + build en cada PR contra `main` y en push a `main`.

## Workflow git

- **SIEMPRE vía PR a `main`** — sin push directo (ruleset de GitHub: PR obligatorio, sin force-push ni borrado en `main`/`develop`).
- Conventional commits en inglés, atómicos (single responsibility), sin atribución de IA.
- **Deploy de schema (Supabase):** el merge a `main` dispara la GitHub integration (schema-as-code). Detalle y fallback sancionado en `CLAUDE.md` → "Convenciones y gotchas del repo".

## Seguridad

- `.envrc` y `.env*` contienen secretos (API keys, tokens) — gitignoreados, nunca commitearlos.
- RLS deny-by-default en Supabase. El cliente browser usa SOLO la publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`); jamás la `service_role`.

## Metodología

- Spec-Driven Development vía `openspec/`: ningún cambio de producto sin un change que recorra sus fases (detalle en `CLAUDE.md`).

## Setup

- ✅ Git (`main`), remote: `git@github.com:jigmeshelri/antimahue.app.git`
- ✅ Engram project: `antimahue.app` (clave plana derivada del git remote — consolidada el 2026-07-14, ver `diario/2026-07-14.md`)
- ✅ Stack cerrado y deployado: Vite 6 + React 19 + Tailwind 4 + TS + PWA / Supabase / Cloudflare Workers Static Assets (ver `CLAUDE.md`).
