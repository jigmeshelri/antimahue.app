---
change: setup-stack
phase: design
status: in_progress
depends_on: [proposal, spec]
supersedes: ~
persistence: openspec
resolves_proposal_deferred: ["§7.router", "§7.host", "§7.pin", "§7.state-lib", "§7.supabase-client"]
produces_proposal: ["§8.threat-model"]
---

# Design: Setup Stack — Infrastructure + Security Scaffold

## Technical Approach

Static SPA (Vite + React 19 + TS + Tailwind v4 + `vite-plugin-pwa`) talks directly to Supabase (`sa-east-1`) via `@supabase/supabase-js` with the **anon key only**. The browser bundle is UNTRUSTED (spec Governing Principle): real authorization is RLS/Postgres, never JS. This design resolves the four deferred decisions of proposal §7, produces the STRIDE-lite threat model of §8, and maps the 9 handoff screens to a feature-sliced + atomic component tree. Scope is infra + minimal security scaffold only — business tables are the future `data-model` change. Every decision below states its security posture, per proposal §2.

## Architecture Decisions

### D1 — Router: React Router v7 (REQ-SETUP-2)

| Option | Tradeoff | Decision |
|---|---|---|
| React Router v7 (declarative, data APIs) | Mature, huge ecosystem, **NOT hit by the 2026-05-11 supply-chain incident**; SPA `createBrowserRouter` is first-class | **CHOSEN** |
| TanStack Router | Best-in-class type-safe routing, but `@tanstack/react-router` was among the 2026-05-11 compromised packages (proposal §5) | Rejected |

**Rationale**: Both routers are technically adequate for a 9-screen private SPA. The `minimumReleaseAge: 1440` guard (REQ-SETUP-3) already neutralizes the TanStack incident, but **security-first means lowest-attack-surface by default, not "mitigated risk"** — picking the package with no incident history is the conservative posture proposal §2 demands. TanStack's type-safety edge is marginal for a small fixed route set. Pin to a React Router v7 release published after 2026-05-12 (guard enforces this automatically). Use `createBrowserRouter` (no SSR / no loaders-as-server — pure client, satisfies REQ-SETUP-11 "no SSR").

### D2 — State library: nanostores (proposal §7)

| Option | Tradeoff | Decision |
|---|---|---|
| nanostores | ~1 KB, framework-agnostic atoms, trivial to keep auth/session state OUT of React tree and OUT of `localStorage`; pairs cleanly with Supabase's own listeners | **CHOSEN** |
| zustand | Ergonomic, popular, but larger; its `persist` middleware tempts storing session in `localStorage` — an anti-pattern here (see D4) | Rejected |

**Rationale**: State here is small (auth status, PIN-lock status, current sale draft, UI flags). nanostores keeps the bundle lean (PWA goal) and its minimalism discourages persisting sensitive state to disk. Server data (catalog, sales) is owned by Supabase, **not** the client store — the store holds UI/session flags only.

### D3 — Supabase client pattern (REQ-SETUP-9)

Single shared browser client created from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, instantiated once in `src/lib/supabase.ts`. `service_role` NEVER imported client-side (REQ-SETUP-9, V-4). Server-side logic (DTE parse, future) lives in Supabase Edge Functions using `service_role` from the function's own secret store — never shipped to the bundle.

```ts
// src/lib/supabase.ts — the ONLY place a client is created
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, storage: secureSessionStorage, autoRefreshToken: true } }
)
```

### D4 — On-device session token storage (REQ-SETUP-9, proposal §2 "manejo seguro del token")

| Option | Tradeoff | Decision |
|---|---|---|
| `localStorage` (supabase default) | Persists across reboots, but readable by any XSS-injected script; survives indefinitely | Rejected |
| `sessionStorage` + PIN-gated re-auth | Cleared on tab close; XSS still reads it while open, but exposure window is one session | Partial |
| **In-memory refresh token + PIN unlock** (see D5) | Refresh token held in JS memory (or IndexedDB encrypted by a PIN-derived key); access token never touches durable storage; PIN re-derives the unlock key each session | **CHOSEN** |

**Rationale**: The PWA may stay installed for weeks; a token sitting in `localStorage` is the highest-value XSS target (threat T3). We store the **refresh token encrypted at rest** in IndexedDB under a key derived from the PIN (WebCrypto PBKDF2/AES-GCM, see D5); the short-lived access token lives only in memory. Combined with a strict CSP, this caps XSS token theft. `autoRefreshToken: true` keeps the access token fresh from the in-memory refresh token while the app is unlocked.

### D5 — PIN strategy: "unlock an issued credential" (REQ-SETUP-7/8, proposal §2 "PIN endurecido") — SECURITY-CRITICAL

The PIN is **NOT** a credential and NEVER goes to the server. Model: **real login once → device-bound token → PIN unlocks it locally**.

```
ONE-TIME ENROLL (real Supabase Auth login, email+password):
  Supabase issues {access_token, refresh_token}
  user sets PIN p
  salt = random(16);  k = PBKDF2(p, salt, 600k iters, SHA-256)  // WebCrypto
  store in IndexedDB: { enc = AES-GCM(refresh_token, k), salt, fail_count=0, locked_until=null }
  // p and k are NEVER persisted; refresh_token plaintext never persisted

DAILY UNLOCK (PIN entry — Screen 1):
  if now < locked_until: reject (temporary lockout)
  k' = PBKDF2(pin_attempt, salt, 600k, SHA-256)
  try refresh_token = AES-GCM-decrypt(enc, k')
    success → fail_count=0; supabase.setSession(refresh_token); app unlocked
    failure (wrong PIN → GCM auth tag fails) → fail_count++; apply backoff (table below)
```

**Rate-limiting + lockout** (4 digits = 10 000 combos = brute-forceable, proposal §2):

| Failed attempts | Action |
|---|---|
| 1–4 | allow, increment counter |
| 5 | lock 30 s (`locked_until = now+30s`) |
| 6 | lock 5 min |
| 7 | lock 1 h |
| 8+ | lock 24 h + require full re-login (email+password), wipe `enc` |

Lockout state lives in IndexedDB (client) AND is mirrored to a server-side `auth_attempts` row on each failure so a wipe-IndexedDB attacker still faces server throttling — **defense in depth**: the cryptographic gate (GCM tag) means a wrong PIN yields no token even with zero rate-limit; rate-limit just stops online grinding. PBKDF2 600k iterations makes offline grinding of a stolen IndexedDB blob costly per-guess.

**Multi-user-ready WITHOUT redesign (proposal §6)**: enrollment is per-`auth.users` row; the IndexedDB record is keyed by Supabase `user.id`. Adding employees later = more `profiles` rows + relaxing the `rol` CHECK constraint (REQ-SETUP-8) + per-role RLS — the PIN/unlock mechanism is unchanged. MVP enrolls exactly one record (Angélica/admin).

### D6 — Host: Cloudflare Pages — **RESOLVED: Cloudflare Pages** (REQ-SETUP-11)

| Criterion | Vercel | Cloudflare Pages | Edge |
|---|---|---|---|
| Edge latency from Chile | ~17 ms (measured) | ~17 ms (measured) | tie |
| Santiago PoP | no | **yes** (CF has Santiago) | CF |
| Real bottleneck (DB RTT, São Paulo) | ~70 ms — same for both | ~70 ms | tie |
| Static SPA + HTTPS + HTTP→HTTPS redirect | yes | yes | tie |
| CSP / security headers (`_headers` file) | via config | **native `_headers`** | CF slight |
| Cost at this scale | free tier OK | free tier OK | tie |

**RESOLVED (2026-06-21): Cloudflare Pages** — confirmed by user. Latency to the *edge* ties (~17 ms), and the DB RTT (~70 ms to São Paulo) dominates either way — tiebreakers are CF's Santiago PoP (closest to Angélica) and its first-class `_headers` for the strict CSP this design relies on (T3 mitigation). Decision is **reversible** (pure static bundle, REQ-SETUP-11) — flipping to Vercel later is a deploy-config change, no code change.

## Threat Model (STRIDE-lite) — proposal §8, MANDATORY

**Assets**: A1 money/sales data; A2 third-party PII (clients, suppliers, RUT from DTE); A3 auth sessions/tokens; A4 stock integrity.

| ID | STRIDE | Threat | Mitigation | Maps to §2 |
|---|---|---|---|---|
| T1 | Tampering | Manipulated client sells at altered price / drives stock negative | Server-side validation: Postgres CHECK constraints + atomic RPC for sale (future `data-model`); client cannot bypass | "validación e integridad server-side" |
| T2 | Info disclosure | Anon/manipulated client reads rows it shouldn't (A1/A2) | **RLS deny-by-default on every `public` table** day 1 (REQ-SETUP-7); anon query returns 0 rows w/o policy (V-7) | "cliente no confiable", "RLS deny-by-default" |
| T3 | Tampering/Spoofing | XSS steals session token (A3) | Strict CSP via CF `_headers` (no inline/eval, locked `connect-src`); access token in-memory only; refresh token PIN-encrypted at rest (D4/D5); `vite-plugin-pwa` SW from same origin | "manejo seguro del token", "HTTPS siempre" |
| T4 | Elevation of privilege | `service_role` key leaks into bundle → full RLS bypass | Key separation (REQ-SETUP-9); `service_role` only in Edge Function secrets; build-time check `grep -r service_role dist/` empty (V-4) | "separación de claves", "mínimo privilegio" |
| T5 | Spoofing | PIN brute force (10k combos, A3) | PIN unlocks, isn't a credential (D5); GCM cryptographic gate + exponential lockout + server-mirrored throttle + PBKDF2 600k | "PIN endurecido + rate-limiting + bloqueo" |
| T6 | Tampering (supply chain) | Malicious dep executes on install (e.g. TanStack 2026-05-11) | pnpm v11 `minimumReleaseAge=1440` + empty `allowBuilds` + committed lockfile + `pnpm audit` in CI (REQ-SETUP-3/4); React Router chosen over TanStack (D1) | "cadena de suministro" |
| T7 | Repudiation | Operator denies a money/stock action | Audit log (author+timestamp+detail) on every money/stock op — scaffold table now, populated by `data-model` | "trazabilidad / auditoría" |
| T8 | Info disclosure | Secrets committed to git | `.gitignore` covers `.env*`/`.envrc`; only `.env.example` committed (REQ-SETUP-10, V-5) | "datos personales / mínimo privilegio" |
| T9 | DoS / loss | Data loss = money loss (A1) | Supabase managed backups; documented restore plan from day 1 | "continuidad: backups y restore" |

> **MUST:** T2 (RLS) and T4 (key separation) are blocking for any apply that writes business data — they are the spec Governing Principle made operational.

## Component Architecture — 9 handoff screens → feature-sliced + atomic (REQ-SETUP-1)

Feature-sliced `src/features/*` (vertical slices) + shared atomic `src/components/` (horizontal UI primitives), container/presentational inside each feature.

```
src/
├── components/                 # ATOMIC shared UI (presentational, no data)
│   ├── atoms/                  # Button, Input, PinDot, Badge, Icon
│   ├── molecules/              # PinPad, SearchBar, ProductCard, KpiCard
│   └── organisms/              # AppShell, NavBar, ProductGrid, TicketLines
├── features/                   # VERTICAL slices (container = data+logic)
│   ├── auth/                   # Screen 1 PIN  → PinScreen(container) + usePinUnlock + lockout store
│   ├── dashboard/              # Screen 2 Dashboard → DashboardScreen + KPI queries
│   ├── venta/                  # Screen 3 Venta + Screen 5 Ticket → SaleScreen, TicketView, sale-draft store
│   ├── escaner/                # Screen 4 Escáner → ScannerScreen (Barcode Detection API)
│   ├── catalogo/               # Screen 6 Catálogo + Screen 7 Detalle → CatalogScreen, ProductDetailScreen
│   ├── proveedor/              # Screen 8 Proveedor → SupplierScreen
│   └── dte/                    # Screen 9 DTE Import → DteImportScreen (fast-xml-parser / Edge Fn)
├── lib/                        # supabase.ts (D3), crypto.ts (D5 WebCrypto), router.tsx (D1)
├── stores/                     # nanostores: auth.ts, lock.ts, saleDraft.ts, ui.ts (D2)
└── main.tsx                    # router + AppShell + Supabase session bootstrap
```

| Screen | Feature slice | Container | Notes |
|---|---|---|---|
| 1 PIN | `auth` | `PinScreen` | gates app; D5 unlock; uses `PinPad` molecule |
| 2 Dashboard | `dashboard` | `DashboardScreen` | KPI cards (read-only) |
| 3 Venta | `venta` | `SaleScreen` | sale draft in store; atomic RPC at confirm (future) |
| 4 Escáner | `escaner` | `ScannerScreen` | client-side Barcode Detection API |
| 5 Ticket | `venta` | `TicketView` | render of completed sale |
| 6 Catálogo | `catalogo` | `CatalogScreen` | `ProductGrid` organism |
| 7 Detalle | `catalogo` | `ProductDetailScreen` | color fields scaffolded (proposal §6) |
| 8 Proveedor | `proveedor` | `SupplierScreen` | supplier PII → RLS-protected (T2) |
| 9 DTE Import | `dte` | `DteImportScreen` | XML parse client or Edge Fn; RUT is PII (A2) |

> Folders/boundaries only. Per-component specs are out of scope (future business changes). All data access goes through `src/lib/supabase.ts`; no component imports `@supabase/supabase-js` directly.

## File Changes

| File | Action | Description |
|---|---|---|
| `vite.config.ts` | Create | Vite + react + tailwind v4 + VitePWA (REQ-SETUP-2) |
| `.npmrc` | Create | `minimumReleaseAge=1440`, `allowBuilds=` (REQ-SETUP-3) |
| `.gitignore` | Create/Modify | ignore `.env*`, `.envrc` (REQ-SETUP-10) |
| `.env.example` | Create | placeholder `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only |
| `public/_headers` | Create | CSP + HSTS + HTTP→HTTPS (CF Pages, D6, T3) |
| `src/lib/supabase.ts` | Create | single client, anon key, secure session (D3/D4) |
| `src/lib/crypto.ts` | Create | WebCrypto PBKDF2/AES-GCM for PIN unlock (D5) |
| `src/lib/router.tsx` | Create | React Router v7 `createBrowserRouter` (D1) |
| `src/stores/*.ts` | Create | nanostores: auth, lock, saleDraft, ui (D2) |
| `src/features/*` | Create | 9-screen slices (skeletons) |
| `src/components/{atoms,molecules,organisms}` | Create | atomic shared UI |
| `supabase/migrations/20260621000000_initial_scaffold.sql` | Create | `profiles` + RLS enable + `auth_attempts` + audit-log scaffold (REQ-SETUP-6/7/8, T5/T7) |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `crypto.ts` PIN derive/encrypt/decrypt; lockout backoff state machine (D5) | Vitest, WebCrypto in jsdom/node |
| Integration | RLS deny-by-default (anon `profiles` → 0 rows, V-7); migration applies (V-6) | Supabase local / PostgREST request |
| Build/Security | `pnpm build` exit 0 (V-1); `grep service_role dist/` empty (V-4); `.env*` ignored (V-5); `pnpm audit` clean (V-9) | shell in CI |
| E2E (light) | PIN unlock happy path + lockout after 5 fails | Playwright (deferred to apply if time) |

## Migration / Rollout

No data migration (greenfield). Single forward migration creates scaffold tables with RLS deny-by-default. Host is reversible (D6): swap deploy target without code change.

## Advisors — Accepted False Positives (W2)

Running `get_advisors(security)` on the Supabase project WILL report 2 WARN entries that are **FALSE POSITIVES — NOT actionable**:

| Lint ID | Rule | Function | Verdict |
|---------|------|----------|---------|
| 0028 | `anon_security_definer_function_executable` | `public.rls_auto_enable()` | FALSE POSITIVE — see below |
| 0029 | `authenticated_security_definer_function_executable` | `public.rls_auto_enable()` | FALSE POSITIVE — see below |

**Why these are inert (evidence):**

`rls_auto_enable()` is a Supabase platform EVENT TRIGGER — its return type is `event_trigger`, it fires on `ddl_command_end`, and its owner is `postgres` (platform-managed). Functions that return `event_trigger` are unreachable as an attack surface:

1. PostgREST DOES NOT expose event trigger functions as RPC — the `event_trigger` return type is not JSON-serializable, so it never appears at `/rest/v1/rpc/rls_auto_enable`.
2. Postgres itself prevents direct invocation: `SELECT rls_auto_enable()` raises `ERROR: event trigger functions cannot be called directly`.
3. The `GRANT EXECUTE TO PUBLIC` the linter flags is inert for the same reason.

**MUST NOT fix**: Do not revoke EXECUTE on this function or otherwise modify `public.rls_auto_enable()`. It is a platform-owned object that implements Supabase's automatic-RLS feature. Touching it may break RLS auto-enforcement at the platform level.

**When running `get_advisors`**: ignore specifically lint IDs `0028` and `0029` on `rls_auto_enable`. All other WARNs should be investigated normally.

The 3 INFO entries (`rls_enabled_no_policy` on `profiles`, `auth_attempts`, `audit_log`) are INTENTIONAL — they confirm deny-by-default posture (T2). They resolve as policies are added in the `data-model` change.

## Open Questions

- [x] **OQ-1 RESOLVED (2026-06-21):** Host = **Cloudflare Pages** (user confirmed). See D6 above.
- [x] **OQ-2 RESOLVED (2026-06-21):** Scaffold empty `audit_log` table now in `setup-stack` as security infrastructure (T7). Per-table triggers deferred to `data-model` change.
- [x] **OQ-3 RESOLVED:** PBKDF2 600k iterations confirmed (WebCrypto native, zero WASM dependency). Argon2id revisit deferred if threat profile rises.
