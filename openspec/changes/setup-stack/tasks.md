---
change: setup-stack
phase: tasks
status: pending_apply
depends_on: [proposal, spec, design]
persistence: openspec
updated_at: "2026-06-21T23:44:27Z"
---

# Tasks: Setup Stack — Infrastructure + Security Scaffold

## Phase 1: Repo & Tooling Bootstrap (REQ-SETUP-1/2/3)

- [x] 1.1 Init repo with `pnpm init` + set `packageManager: "pnpm@11"` in `package.json`; enable corepack (`corepack enable pnpm`). Commit `package.json`.
- [x] 1.2 Write `.npmrc` with `minimumReleaseAge=1440` and `allowBuilds=` (empty — REQ-SETUP-3). **VERIFY** syntax against pnpm v11 docs before committing (open risk: `allowBuilds` key name may differ across v11 minor versions — run `pnpm install` and confirm lifecycle scripts are blocked).
- [x] 1.3 Install Vite + React 19 + TypeScript deps: `pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom` (REQ-SETUP-2).
- [x] 1.4 Install Tailwind v4 + Vite plugin: `pnpm add -D tailwindcss @tailwindcss/vite` (REQ-SETUP-2).
- [x] 1.5 Install `vite-plugin-pwa` and `workbox-window`: `pnpm add -D vite-plugin-pwa workbox-window` (REQ-SETUP-2).
- [x] 1.6 Create `vite.config.ts` with `react()` + `tailwindcss()` + `VitePWA({ registerType: 'autoUpdate' })` plugins per spec REQ-SETUP-2 contract.
- [x] 1.7 Create `tsconfig.json` + `tsconfig.app.json` (strict mode, path aliases `@/*` → `src/*`).
- [x] 1.8 Create `index.html` entry point referencing `src/main.tsx`.
- [x] 1.9 Write `.gitignore`: must cover `.env`, `.env.*`, `.envrc`, `dist/`, `node_modules/`, `.DS_Store` (REQ-SETUP-10, T8).
- [x] 1.10 Commit `pnpm-lock.yaml` after first `pnpm install` (REQ-SETUP-3, V-8).

## Phase 2: Supabase Project Setup (REQ-SETUP-5/6)

- [x] 2.1 Create Supabase project in region `sa-east-1` (São Paulo). Enable Auth + Storage + PostgREST (REQ-SETUP-5). Confirm region in project settings dashboard.
- [ ] 2.2 Create `.env.local` (gitignored) with real `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; add `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix — REQ-SETUP-9).
- [x] 2.3 Create `.env.example` with placeholder values only (`VITE_SUPABASE_URL=`, `VITE_SUPABASE_PUBLISHABLE_KEY=`) — this is the ONLY env file committed to git (REQ-SETUP-10).
- [x] 2.4 Create `supabase/migrations/` directory; write `20260621000000_initial_scaffold.sql` (populated in Phase 3).

## Phase 3: Security Scaffold — SQL Migration (REQ-SETUP-6/7/8, D4/D5, T2/T5/T7)

- [x] 3.1 Write `profiles` table in migration per REQ-SETUP-8 exact schema: `id uuid PK → auth.users(id) ON DELETE CASCADE`, `rol text NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin'))`, `created_at timestamptz DEFAULT now()`.
- [x] 3.2 Add `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;` — deny-by-default (no policy = no access, REQ-SETUP-7, T2).
- [x] 3.3 Write the signup trigger SQL (intentionally omitted from spec, MUST be here): `CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN INSERT INTO public.profiles(id) VALUES (NEW.id); RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;` + `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();` (satisfies REQ-SETUP-8 scenario "profile row created on user signup"). Also: REVOKE EXECUTE FROM PUBLIC (advisor lint 0028/0029 — trigger functions must not be PostgREST-callable).
- [x] 3.4 Create `auth_attempts` table: `(id uuid PK DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), attempted_at timestamptz DEFAULT now(), success boolean NOT NULL)`. Enable RLS deny-by-default. Used by D5 server-mirrored throttle (T5 defense in depth).
- [x] 3.5 Create empty `audit_log` table (OQ-2 RESOLVED): `(id uuid PK DEFAULT gen_random_uuid(), actor_id uuid REFERENCES auth.users(id), action text NOT NULL, entity text, entity_id text, detail jsonb, created_at timestamptz DEFAULT now())`. Enable RLS deny-by-default (T7). Per-table triggers deferred to `data-model` change.
- [x] 3.6 Verify migration applies cleanly: applied via Supabase MCP `apply_migration` → `list_migrations` shows `20260621000000_initial_scaffold` as applied; `list_tables` confirms all 3 tables with `rls_enabled: true` (V-6 precursor).

## Phase 4: App Shell & Routing Skeleton (REQ-SETUP-1/2, D1/D2)

- [x] 4.1 Install React Router v7: `pnpm add react-router` (pin to a release published after 2026-05-12 — guard enforces; verify with `pnpm why react-router`). D1.
- [x] 4.2 Install nanostores: `pnpm add nanostores @nanostores/react`. D2.
- [x] 4.3 Install `@supabase/supabase-js`: `pnpm add @supabase/supabase-js`.
- [x] 4.4 Create `src/lib/supabase.ts` — single shared client (D3): `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })`. No `service_role` import anywhere in `src/`.
- [x] 4.5 Create `src/lib/crypto.ts` — WebCrypto helpers per D5: `deriveKey(pin, salt)` using PBKDF2 600k iterations SHA-256; `encryptToken(token, key)` AES-GCM; `decryptToken(enc, key)` AES-GCM. **Flag**: WebCrypto + IndexedDB must be validated inside the installed PWA (not just browser — SW context may differ; add a smoke test in 5.6).
- [x] 4.6 Create `src/lib/router.tsx` — `createBrowserRouter` with 9 routes, each lazy-importing its feature screen (D1, REQ-SETUP-11 pure static SPA).
- [x] 4.7 Create `src/stores/`: `auth.ts` (session atom), `lock.ts` (PIN lockout state), `saleDraft.ts` (current sale), `ui.ts` (global UI flags). nanostores atoms only (D2).
- [x] 4.8 Scaffold feature directories and skeleton screens (index files with `export default function XScreen() { return <div>XScreen</div> }`): `auth/PinScreen`, `dashboard/DashboardScreen`, `venta/SaleScreen` + `TicketView`, `escaner/ScannerScreen`, `catalogo/CatalogScreen` + `ProductDetailScreen`, `proveedor/SupplierScreen`, `dte/DteImportScreen`.
- [x] 4.9 Scaffold `src/components/`: create empty `atoms/`, `molecules/`, `organisms/` directories with placeholder index files.
- [x] 4.10 Create `src/main.tsx` — mounts `<RouterProvider>` + Supabase session bootstrap listener (calls `supabase.auth.onAuthStateChange`).

## Phase 5: Cloudflare Pages Deploy Config + CSP (D6/OQ-1, T3)

- [x] 5.1 Create `public/_headers` file with strict CSP per T3 mitigation: `default-src 'self'`, `connect-src 'self' https://*.supabase.co`, `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`), `style-src 'self' 'unsafe-inline'` (Tailwind runtime needs this — document the exception), `img-src 'self' data: blob:`, `frame-ancestors 'none'`. Also include `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- [x] 5.2 Create `wrangler.jsonc` (CF Pages config) with `pages_build_output_dir = "dist"` and `compatibility_date` (JSON format per wrangler skill — `wrangler.toml` is legacy; JSONC is current). Instructions for CF dashboard are documented inline.
- [ ] 5.3 Configure CF Pages project in Cloudflare dashboard: connect repo, set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in CF Pages settings (REQ-SETUP-9 — no `service_role` in CF Pages env vars client-side). REQUIRES HUMAN — needs CF dashboard credentials.

## Phase 6: Supply-chain Guards & Env Validation (REQ-SETUP-3/4/9/10)

- [x] 6.1 Run `pnpm audit` after all installs; resolve any critical/high findings before proceeding (REQ-SETUP-4, V-9). Result: "No known vulnerabilities found".
- [x] 6.2 Verify `.npmrc` `allowBuilds=` is correct pnpm v11 syntax by running `pnpm install` on a dep with a known `postinstall` (or check `pnpm config` output). Document confirmed syntax in a code comment inside `.npmrc`.
- [x] 6.3 Verify `grep -r "service_role" dist/` returns empty after `pnpm build` (V-4, T4). Confirmed: no match in dist/.
- [x] 6.4 Verify `git status` shows `.env.local` as ignored, not untracked (V-5, T8). Confirmed via `git check-ignore`.
- [x] 6.5 Verify `git ls-files pnpm-lock.yaml` returns the file (V-8). Confirmed: tracked.

## Phase 7: Acceptance Criteria Verification (V-1 → V-9)

- [x] 7.1 V-1: Run `pnpm build` → exit 0, `dist/index.html` exists, no TS errors. CONFIRMED.
- [ ] 7.2 V-2: Run `pnpm dev` → dev server at `http://localhost:5173` without errors. REQUIRES HUMAN — needs browser/display environment; .env.local with real values also needed.
- [ ] 7.3 V-3: Open app in browser → network tab shows successful Supabase anon request (URL resolves, no 401/404 on auth endpoint). REQUIRES HUMAN — browser test.
- [x] 7.4 V-4: `grep -r "service_role" dist/` → empty output. CONFIRMED (rg returns no matches).
- [x] 7.5 V-5: `git status` after creating `.env.local` → file is ignored. CONFIRMED via `git check-ignore`.
- [x] 7.6 V-6: Query `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` → `rowsecurity=true` for `profiles`, `auth_attempts`, `audit_log`. CONFIRMED via Supabase MCP.
- [x] 7.7 V-7: Anon PostgREST `GET /rest/v1/profiles` → **401 Unauthorized**. RESOLVED BY DESIGN DECISION (2026-06-22): 401 is the CORRECT state for setup-stack — deny-by-default at two layers (no DML grant for anon + RLS enabled without policy). The `[]` state (requires `GRANT SELECT TO anon` + RLS policy `auth.uid() = id`) is deferred to the `data-model` change. Granting DML before needed violates least-privilege. Spec updated accordingly.
- [x] 7.8 V-8: `git ls-files pnpm-lock.yaml` → `pnpm-lock.yaml` (committed). CONFIRMED.
- [x] 7.9 V-9: `pnpm audit` → no critical/high CVEs. CONFIRMED: "No known vulnerabilities found".
- [ ] 7.10 PWA smoke test (D5 flag): install PWA locally, run `crypto.ts` `deriveKey` + `encryptToken` + `decryptToken` round-trip inside the installed SW context; confirm WebCrypto + IndexedDB work as expected (not just in normal browser tab). REQUIRES HUMAN — steps below.

---

## Notes for human-required tasks

### V-7 — RESOLVED: 401 accepted as correct state for setup-stack

**Decision (2026-06-22):** The 401 response from anon `GET /profiles` is the CORRECT and EXPECTED outcome for `setup-stack`. It reflects deny-by-default at two independent layers:

1. **No DML grant** — `anon` and `authenticated` roles have no `SELECT` privilege on `public.profiles` (consequence of `expose-new-tables = OFF` in Supabase; verified via `information_schema.role_table_grants`).
2. **RLS without policy** — even if a grant were present, no permissive RLS policy exists, so all rows would be filtered.

The state `[]` (Option B — standard Supabase pattern with `GRANT SELECT TO anon`) is **deferred to `data-model`**, where the table is actually exposed to the client with appropriate RLS policies. Granting DML permissions before they are needed violates the principle of least privilege.

Spec (REQ-SETUP-7 scenario + V-7 acceptance row) updated to match.

### 7.10 — PWA smoke test steps (REQUIRES HUMAN + BROWSER)

Prerequisites: `.env.local` with real Supabase values, Chrome/Edge (PWA install support).

1. Run `pnpm build && pnpm preview` (serves `dist/` at `http://localhost:4173`).
2. Open `http://localhost:4173` in Chrome. Install the PWA via the address bar install icon.
3. Open the installed PWA (standalone window, not browser tab).
4. Open DevTools → Console. Run this snippet:
```js
// Round-trip test for crypto.ts helpers
const { deriveKey, encryptToken, decryptToken } = await import('/src/lib/crypto.ts')
const pin = '1234'
const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await deriveKey(pin, salt)
const token = 'test-refresh-token-value'
const enc = await encryptToken(token, key)
const dec = await decryptToken(enc, key)
console.assert(dec === token, 'Round-trip FAILED')
console.log('Round-trip result:', dec === token ? 'PASS' : 'FAIL')
```
5. Confirm console prints `Round-trip result: PASS` with no assertion errors.
6. Also verify IndexedDB is accessible: DevTools → Application → IndexedDB should show no access errors.

### 7.2 / 7.3 — Dev server + browser check (REQUIRES HUMAN)

Prerequisites: `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set.

1. Run `pnpm dev`.
2. Confirm server starts at `http://localhost:5173` with no console errors.
3. Open browser → Network tab → check for a Supabase auth request (should succeed with 200).

### 5.3 — Cloudflare Pages dashboard setup (REQUIRES CF CREDENTIALS)

1. Go to https://dash.cloudflare.com → Pages → Create project → Connect to Git.
2. Select the `antimahue` GitHub repo.
3. Set: Build command = `pnpm build`; Build output directory = `dist`.
4. In Settings → Environment variables, add:
   - `VITE_SUPABASE_URL` = (value from Supabase dashboard)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (publishable key from Supabase dashboard)
   - DO NOT add `SUPABASE_SERVICE_ROLE_KEY` here (REQ-SETUP-9, T4).
5. Trigger first deploy. Verify site loads and CSP headers are applied (check via curl -I).
