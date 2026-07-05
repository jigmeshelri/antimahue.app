# AGENTS — Proyecto Antimahue

> Estado al 2026-07-05: app **LIVE en producción** (`antimahue.com`). La guía completa del repo vive en `CLAUDE.md` — este archivo es el resumen operativo para agentes. Mantener ambos sincronizados.

## Comandos reales

- `pnpm dev` — dev server Vite (`http://localhost:5173`).
- `pnpm build` — typecheck + bundle (build-gate).
- `pnpm typecheck` — typecheck sin emitir.
- `pnpm preview` — sirve el `dist/` buildeado.
- **NO existe `pnpm test`** — la suite de tests es trabajo futuro; no inventarlo.

## Workflow git

- **SIEMPRE vía PR a `main`** — sin push directo (ruleset de GitHub: PR obligatorio, sin force-push ni borrado en `main`/`develop`).
- Conventional commits en inglés, atómicos (single responsibility), sin atribución de IA.

## Seguridad

- `.envrc` y `.env*` contienen secretos (API keys, tokens) — gitignoreados, nunca commitearlos.
- RLS deny-by-default en Supabase. El cliente browser usa SOLO la publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`); jamás la `service_role`.

## Metodología

- Spec-Driven Development vía `openspec/`: ningún cambio de producto sin un change que recorra sus fases (detalle en `CLAUDE.md`).

## Setup

- ✅ Git (`main`), remote: `git@github.com:jigmeshelri/antimahue.app.git`
- ✅ Engram project: `inaction:antimahue.app` (namespace `inaction:` separa proyectos personales de neosoltec)
- ✅ Stack cerrado y deployado: Vite 6 + React 19 + Tailwind 4 + TS + PWA / Supabase / Cloudflare Workers Static Assets (ver `CLAUDE.md`).
