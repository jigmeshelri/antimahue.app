# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Idioma: este archivo es mixto Claude+humano con instrucciones del user → español rioplatense (convención global del user). El header de arriba es boilerplate fijo de `/init`.

## Qué es Antimahue

PWA de **inventario y punto de venta** para la tienda de lanas, algodón, hilos, palillos y crochet de Angélica (Chile). **No es un e-commerce ni un CRM** — es una herramienta teléfono-first para vender, consultar stock y gestionar proveedores. La definición de producto vive en `docs/product-definition.md` (documento vivo, fuente de verdad del alcance).

Principios de diseño que condicionan toda decisión técnica (de `docs/product-definition.md`): cero fricción (≤2 toques por tarea frecuente), lenguaje familiar ("ovillo", "madeja", "palillo" — no jerga de sistemas), teléfono-first, tolerante a errores (deshacer en vez de diálogos de confirmación).

## Estado del repo: `setup-stack` cerrado y archivado — LIVE en producción (`antimahue.com`)

El bootstrapping está COMPLETO (apply 48/48, cerrado 2026-06-22). Existe `package.json` (pnpm@11), Vite 6 + React 19 + Tailwind 4 + TS + `vite-plugin-pwa`, el árbol `src/` (atomic design: `components/{atoms,molecules,organisms}` + `features/` + `lib/` + `stores/`), `vite.config.ts`, `tsconfig*.json`, `index.html`, `public/_headers` (CSP), el scaffold de seguridad de la DB en `supabase/migrations/` (`profiles` + trigger de signup + RLS deny-by-default + `audit_log`), y `wrangler.jsonc` (Workers Static Assets). **El build da verde** (PWA generada) y la app está **LIVE en `antimahue.com`** (Cloudflare Workers Static Assets, HTTP 200 + CSP/HSTS + SPA fallback).

Comandos reales (de `package.json`):
- `pnpm dev` — dev server Vite (`http://localhost:5173`).
- `pnpm build` — `tsc -p tsconfig.app.json && vite build` (build-gate: typecheck + bundle).
- `pnpm typecheck` — typecheck sin emitir.
- `pnpm preview` — sirve el `dist/` buildeado.

**Todavía NO hay tests** (no inventes `pnpm test` — falla; la suite de tests es trabajo futuro). El change `setup-stack` está **cerrado y archivado** (apply 48/48 + `sdd-archive` ejecutados el 2026-06-22, ver `diario/2026-06-22.md`): vive en `openspec/changes/archive/2026-06-22-setup-stack/` y su spec consolidada quedó en `openspec/specs/setup-stack/spec.md`.

El cambio `data-model` está **LIVE en producción y archivado** (apply 48/48, verify PASS 0 CRITICAL, `sdd-archive` 2026-07-06): desplegado a `sa-east-1` con 7 tablas + 4 funciones RPC para 4 dominios (catalogo, venta, configuracion, seguridad). Vive en `openspec/changes/archive/2026-07-06-data-model/` y los specs consolidados en `openspec/specs/{catalogo,venta,configuracion,seguridad}/spec.md`. Nota: el host terminó en **Cloudflare Workers Static Assets**, no Pages classic (el dashboard nuevo de CF corre `wrangler deploy`, no `pages deploy`).

## Metodología: Spec-Driven Development (SDD) vía openspec

Todo cambio de producto pasa por `openspec/` antes de tocar código. No se implementa nada sin un change que recorra sus fases.

- `openspec/project.yaml` — config del proyecto: stack declarado y lista de `active_changes`.
- `openspec/changes/<nombre>/` — un directorio por feature/cambio:
  - `proposal.md` — intención, alternativas con tradeoffs, decisión.
  - `state.yaml` — `status` global + `phase_states` (explore → proposal → specs → design → tasks → apply → verify → archive). **Leé esto primero** para saber en qué fase está un change antes de actuar sobre él.
  - (Luego se suman `spec.md`, `design.md`, `tasks.md` a medida que avanza.)

Changes activos al momento de escribir esto (verificá `state.yaml` actual, esto envejece):

| Change | Fase actual | Qué es |
| --- | --- | --- |
| `color-palette-assistant` | proposal completo, `specs` pending | Asistente de armonía cromática que mapea teoría de color contra stock real. |

Changes archivados:
- `setup-stack` (2026-06-22) — bootstrapping del stack SPA+Supabase+CF
- `data-model` (2026-07-06) — schema MVP: 7 tablas, 4 funciones RPC, RLS/GRANTs, live en producción

Los changes cerrados viven en `openspec/changes/archive/`.

La orquestación SDD del user (skills `sdd-*`, `/sdd-*`) genera artefactos en **doble formato** cuando aplica: `.html` rico para revisión humana + `.md` agent-optimized para el LLM. Ver el global CLAUDE.md del user para la convención completa.

## Stack: CERRADO y bootstrapped (resuelto 2026-06-21 en la fase `design`)

La vieja tensión Astro+FastAPI vs React+Vite **se resolvió** a favor del stack liviano: sin Astro, sin backend propio.

- **Frontend:** SPA con **Vite 6 + React 19 + Tailwind 4 + TypeScript**, PWA vía `vite-plugin-pwa`. Routing con **React Router v7** (NO TanStack — descartado por el incidente supply-chain del 2026-05-11). Estado con **nanostores**. Atomic design en `src/components/`.
- **Backend:** **Supabase directo** (PostgreSQL + Auth + Storage + RLS + PostgREST + Edge Functions), región `sa-east-1` (São Paulo), ref `aruteznqhdaaxxvllvzm`. **Sin FastAPI, sin Railway, sin Docker en prod, sin TimescaleDB** — Antimahue no tiene visión-IA ni series temporales que los justifiquen.
- **Host:** Cloudflare **Workers Static Assets** (bundle estático en el edge; reversible). LIVE en `antimahue.com`. NO Pages classic: el dashboard nuevo de CF corre `wrangler deploy` (Workers Builds), por eso `wrangler.jsonc` usa `assets.directory` + `not_found_handling: single-page-application`, no `pages_build_output_dir`.
- **Package manager:** **pnpm 11** secure-by-default: `minimumReleaseAge=1440` en `.npmrc`; `allowBuilds` (solo `esbuild`, security-reviewed) + `strictDepBuilds: true` en `pnpm-workspace.yaml` (NO en `.npmrc` — esa key no existe ahí en v11).
- **Seguridad = principio rector:** maneja dinero + datos de terceros → RLS deny-by-default, cliente no confiable (autorización en Postgres, no en el JS), separación de claves anon/service_role, PIN endurecido con PBKDF2. Presente en cada fase, no al final.

> Si `product-definition.md` o el handoff de diseño todavía marcan el stack como "candidato" o proponen Astro/FastAPI, está viejo: la fuente de verdad es `openspec/project.yaml` + `setup-stack/design.md`.

## Sistema de diseño: el handoff es la fuente de verdad para UI

Al construir cualquier pantalla, **replicá visualmente los prototipos** — son hi-fi y pixel-perfect, no aproximaciones:

- `docs/design_handoff_antimahue/README.md` — **spec de diseño completa**: paleta "Terraza" (tokens CSS de marca, fondos, estados de stock), tipografía (DM Sans), espaciado, radios, transiciones, ícono de app (SVG path), y la spec pantalla por pantalla (9 pantallas: PIN, Dashboard, Venta, Escáner, Ticket, Catálogo, Detalle, Proveedor, Import DTE).
- `docs/design_handoff_antimahue/*.dc.html` — prototipos interactivos navegables (`Antimahue Prototipo`, `Ticket Térmico`, `Antimahue Logo`). Son **referencia, no código de producción** — recrealos en el stack elegido.
- `docs/mockups/*.html` + `*.png` — set anterior de 5 pantallas (login, dashboard, venta, producto nuevo, ticket). El handoff es más nuevo y detallado; ante conflicto, gana el handoff.
- Íconos: **Phosphor Icons** variante `fill`. Fuente: **DM Sans** (DM Mono para el ticket térmico).

Skills de diseño fijadas en el repo (`.agents/skills/`, lockeadas en `skills-lock.json`): `frontend-design` (anthropics/skills) y `web-design-guidelines` (vercel-labs). Aplicalas al trabajar UI.

## Dominio específico (Chile / tienda de lanas)

- **DTE (Documento Tributario Electrónico):** la importación de compras parsea **XML de factura/boleta electrónica chilena** — DTE Tipo 33/46 (factura) y Tipo 39 (boleta). Se descartó OCR de PDF y el timbre PDF417 (no traen detalle de ítems) — el XML es la única vía soportada (razones en `docs/product-definition.md`).
- **Roles + auth:** PIN de 4 dígitos. Admin (Angélica) ve costos/proveedores/valor de inventario; empleados **solo venden** (sin acceso a costos). La UI oculta datos sensibles por rol.
- **Asistente de color:** calcula armonías (análogos / complementarios / tríadas) y mapea contra stock real usando distancia en espacio HSL/RGB (o CIELAB ΔE). Detalle en `openspec/changes/color-palette-assistant/proposal.md`.

## Convenciones y gotchas del repo

- **Workflow git: SIEMPRE vía PR** (decisión 2026-07-05): nada de push directo a `main`, aunque el equipo sea de uno — rama corta → PR → merge. El PR ordena el trabajo y deja trazabilidad. Lo respalda el ruleset "Default" de GitHub sobre `main`/`develop`: PR obligatorio (0 approvals — podés mergear tu propio PR), sin force-push, sin borrado. Ojo: el admin tiene bypass "always" — el ruleset no te frena a vos, la disciplina es nuestra. GitHub borra la rama al mergear (`deleteBranchOnMerge`). (`required_signatures` está **activo** y no muerde: la firma SSH está configurada a nivel repo — `gpg.format ssh` + key personal `id_ed25519_j` + `commit.gpgsign`, config `--local` y no global porque la otra key de la máquina es de trabajo — y la key está registrada como *Signing Key* en GitHub, así que los commits salen "Verified". Gotcha: con esta regla, mergear por merge-commit o squash — el rebase-merge de GitHub recrea los commits SIN firma y rebota.)
- **Secretos:** `.envrc` y `.env*` contienen API keys/tokens y están gitignoreados. Nunca commitearlos. (Ver `AGENTS.md`.)
- **`AGENTS.md`** es el archivo de instrucciones de agentes del repo (mínimo hoy, pensado para crecer cuando haya código). Mantenelo y este CLAUDE.md sincronizados.
- **Idioma de docs:** español (la audiencia primaria son humanos chilenos y Angélica). Aplica a `product-definition.md`, READMEs, diario, artefactos de revisión.
- **Diario:** `diario/<fecha>.md` registra avances/pendientes por sesión.
- **Remote / proyecto Engram:** repo en `git@github.com:jigmeshelri/antimahue.app.git`; memoria Engram bajo namespace `inaction:antimahue.app`.
- **Deploy de schema (Supabase):** el path oficial es la GitHub integration (schema-as-code): al mergear a `main`, Supabase aplica `supabase/migrations/` automáticamente. **Activada el 2026-07-06** (toggle "Deploy to production" ON, branch `main`, working dir `.`) — estuvo APAGADA desde el inicio del proyecto, por eso tanto el scaffold de junio como el `data-model` de julio se deployaron a mano. Fallback sancionado si la integración falla: MCP `execute_sql` aplicando los archivos de migración en orden, seguido de un `INSERT` manual en `supabase_migrations.schema_migrations` con `version` = prefijo EXACTO del filename (así el registry y el repo quedan idénticos). `apply_migration` del MCP sigue **PROHIBIDO** a secas — registra el timestamp de ejecución como `version`, lo que diverge del repo. `supabase/config.toml` existe solo local (lo genera `supabase init` para el CLI) — decisión de commitearlo todavía pendiente. Verificación post-deploy mínima: `list_migrations` debe matchear los archivos del repo 1:1.
