---
change: setup-stack
phase: spec
status: completed
depends_on: proposal
supersedes: ~
persistence: openspec
domains:
  - project-structure
  - dependency-strategy
  - supabase-setup
  - security-scaffold
  - hosting
out_of_scope:
  - Business tables (productos, ventas, proveedores, colores, DTE, ticket) → future `data-model` change
  - RLS multi-role policies for employees
  - Atomic sale transaction
  - Business-operations audit log
---

# Setup Stack — Specification

## Governing Principle: Security from Day 0

The client bundle is UNTRUSTED. Authorization MUST live in RLS/Postgres, never in JS alone. Every `public` table MUST have RLS enabled deny-by-default before any business data is written. `service_role` key MUST NEVER appear in the client bundle.

---

## Domain: project-structure

### REQ-SETUP-1: Repository layout

The repository MUST follow the structure below. No `backend/`, `docker/`, or `docker-compose.yml` at root level.

```
/
├── src/
│   ├── components/
│   ├── features/        # auth, venta, catalogo, paletas, dte
│   ├── lib/             # supabase client, helpers
│   └── main.tsx
├── supabase/
│   └── migrations/      # versioned SQL (RLS included)
├── public/              # PWA icons, manifest
├── openspec/
├── index.html
├── vite.config.ts
└── package.json
```

#### Scenario: scaffold verified

- GIVEN the repository has been initialized
- WHEN `ls` is run at root
- THEN `src/`, `supabase/migrations/`, `public/`, `vite.config.ts`, `index.html` are present
- AND no `backend/` or `docker-compose.yml` exist

### REQ-SETUP-2: Frontend build toolchain

The project MUST use Vite + React 19 + TypeScript + Tailwind CSS v4 + `vite-plugin-pwa`. The build MUST produce a static bundle deployable to any CDN edge.

```ts
// vite.config.ts — required plugins
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ registerType: 'autoUpdate' })],
})
```

#### Scenario: production build

- GIVEN dependencies are installed
- WHEN `pnpm build` runs
- THEN exit code is 0 and `dist/` contains `index.html` + hashed JS/CSS assets
- AND no TypeScript errors are reported

#### Scenario: dev server

- GIVEN environment variables are set
- WHEN `pnpm dev` runs
- THEN dev server starts at `http://localhost:5173` without errors

---

## Domain: dependency-strategy

### REQ-SETUP-3: pnpm v11 as exclusive package manager

The project MUST use pnpm v11. npm and yarn MUST NOT be used. `pnpm-lock.yaml` MUST be committed. The following pnpm config MUST be applied:

```yaml
# .npmrc (pnpm config)
minimumReleaseAge=1440
allowBuilds=
```

> **MUST:** `allowBuilds` is empty — blocks all lifecycle scripts (postinstall). No exceptions without explicit security review.

#### Scenario: install blocked for new packages

- GIVEN `minimumReleaseAge=1440` is active
- WHEN a package published less than 24 h ago is added via `pnpm add`
- THEN pnpm rejects the install with a minimum age error

#### Scenario: lifecycle scripts blocked

- GIVEN `allowBuilds` is empty
- WHEN `pnpm install` runs with a dep that declares `postinstall`
- THEN the lifecycle script is NOT executed

### REQ-SETUP-4: Supply-chain audit cadence

The project SHOULD run `pnpm audit` on every PR and MUST run it at least weekly. Critical or high severity CVEs MUST block merge until resolved or explicitly acknowledged.

#### Scenario: audit in CI

- GIVEN a PR is opened
- WHEN CI runs `pnpm audit`
- THEN the run fails on critical/high severity findings
- AND the PR cannot be merged until the finding is resolved

---

## Domain: supabase-setup

### REQ-SETUP-5: Supabase project configuration

The Supabase project MUST be created in region `sa-east-1` (São Paulo). Auth, Storage, and PostgREST MUST be enabled. Edge Functions MAY be used for server-side logic.

#### Scenario: region confirmed

- GIVEN the Supabase project is created
- WHEN the project settings page is checked
- THEN the region shows `sa-east-1`

### REQ-SETUP-6: Migration structure

All schema changes MUST be expressed as versioned SQL files under `supabase/migrations/`. The first migration MUST create the `profiles` table and enable RLS on it.

```
supabase/migrations/
└── 20260621000000_initial_scaffold.sql
```

#### Scenario: migration applied

- GIVEN the Supabase project is connected
- WHEN `supabase db push` runs
- THEN all migrations apply without errors
- AND `supabase migration list` shows them as applied

---

## Domain: security-scaffold

### REQ-SETUP-7: RLS deny-by-default on every public table

Every table in the `public` schema MUST have RLS enabled. The default MUST be deny-all (no permissive policy = no access). Policies that grant access are added per-table in subsequent changes.

```sql
-- Template: applied to EVERY table in public schema
ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
-- No permissive policy = deny by default (Postgres RLS semantics)
```

#### Scenario: anon cannot read profiles — deny at two layers

- GIVEN RLS is enabled on `profiles` AND no DML grant exists for `anon` (expose-new-tables OFF)
- WHEN an anon request queries `profiles` via PostgREST
- THEN the response is **401 Unauthorized** (permission denied before RLS evaluates)
- AND this is the CORRECT state for `setup-stack`: deny-by-default at two layers (no DML grant + RLS without policy)

> **NOTE:** The state `[]` (0 rows) requires a `GRANT SELECT … TO anon` plus at least one RLS policy (`auth.uid() = id`). Both are deferred to the `data-model` change, when the table is actually exposed to the client. Granting DML before it is needed violates the principle of least privilege.

#### Scenario: service_role bypasses RLS correctly

- GIVEN RLS is enabled on `profiles`
- WHEN a server-side call uses the `service_role` key
- THEN it can read all rows (service_role bypasses RLS by design)

### REQ-SETUP-8: Profiles table — minimal MVP scaffold

The initial migration MUST create a `profiles` table linked to `auth.users`. MVP requires exactly 1 row (Angélica / admin).

```sql
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        text NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

> **MUST:** `service_role` key MUST NOT appear in client-side code or `.env` files committed to git.

#### Scenario: profile row created on user signup

- GIVEN a trigger or post-auth function creates a profile row on user creation
- WHEN a new user is created in Supabase Auth
- THEN a corresponding row exists in `public.profiles`
- AND `rol` defaults to `'admin'`

#### Scenario: non-admin rol rejected at DB level

- GIVEN the CHECK constraint `rol IN ('admin')` on MVP
- WHEN an INSERT with `rol = 'employee'` is attempted
- THEN Postgres rejects it with a check constraint violation

### REQ-SETUP-9: Key separation

| Key | Exposed to | Usage |
|-----|-----------|-------|
| `VITE_SUPABASE_URL` | Client bundle | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client bundle | Public anon key (safe only with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/Edge only | MUST NOT be prefixed `VITE_` |

The `SUPABASE_SERVICE_ROLE_KEY` MUST NOT appear in any file prefixed `VITE_` or in any client-side import.

#### Scenario: service_role key not in bundle

- GIVEN the project is built with `pnpm build`
- WHEN `grep -r "service_role" dist/` runs
- THEN the output is empty (key absent from bundle)

### REQ-SETUP-10: Secrets never committed

`.env`, `.env.local`, `.envrc`, and any file containing secret values MUST be listed in `.gitignore`. Only `.env.example` with placeholder values MAY be committed.

#### Scenario: gitignore covers env files

- GIVEN `.gitignore` is present
- WHEN `git status` is run after creating `.env.local`
- THEN `.env.local` shows as ignored, NOT as untracked

---

## Domain: hosting

### REQ-SETUP-11: Host — deferred, bounded decision

The static bundle MAY be deployed to Vercel or Cloudflare Pages. The decision is deferred to the design phase and is reversible (both serve static files from the edge with comparable latency from Chile). HTTPS MUST be enforced on both; HTTP MUST redirect to HTTPS.

> **MUST NOT** use a hosting target that requires server-side rendering or a persistent process — the bundle MUST remain a pure static SPA.

#### Scenario: host decision documented before deploy

- GIVEN the design phase is complete
- WHEN `openspec/changes/setup-stack/design.md` is written
- THEN it includes an explicit host choice (Vercel OR Cloudflare Pages) with rationale

---

## Acceptance / Verify Criteria

| ID | Check | Method |
|----|-------|--------|
| V-1 | `pnpm build` exits 0, no TS errors | `pnpm build` |
| V-2 | `pnpm dev` serves at port 5173 | manual or `curl localhost:5173` |
| V-3 | App connects to Supabase (anon key resolves URL) | browser network tab or e2e |
| V-4 | `grep -r "service_role" dist/` returns empty | shell |
| V-5 | `git status` shows `.env*` files as ignored | shell |
| V-6 | RLS enabled on `profiles` (`pg_tables.rowsecurity = true`) | `supabase db` query |
| V-7 | Anon `GET /profiles` returns **401** (no DML grant + RLS = deny at two layers; `[]` deferred to `data-model`) | PostgREST request |
| V-8 | `pnpm-lock.yaml` exists and is committed | `git ls-files pnpm-lock.yaml` |
| V-9 | `pnpm audit` reports no critical/high CVEs | `pnpm audit` |
