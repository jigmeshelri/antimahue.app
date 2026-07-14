---
change: auth-pin
phase: design
status: completed
depends_on: [data-model, setup-stack]
supersedes: ~
persistence: openspec+engram
updated_at: 2026-07-14
resolves_open_questions: [OQ-1, OQ-2, OQ-3, OQ-4]
carries_forward: [D1, D2, D3, D4, D5, D6]  # proposal decisions — NOT reopened
---

# Design: auth-pin — PIN unlock + admin/empleado roles

## 1. Technical approach

Build the UI/state layer around the already-complete `src/lib/crypto.ts` (PBKDF2 600k + AES-GCM-256),
unblock the schema for a second role, and design the two undesigned flows (enrollment, revocation). The
client bundle is UNTRUSTED: every authorization rule stays a Postgres policy/constraint/RPC. The PIN is a
LOCAL unlock key for an already-authorized refresh token — never a credential, never on the wire (D1).

Four layers, no re-architecture:
1. **DB** — additive migration: widen `profiles.rol` CHECK, add `profiles.activo`, harden the signup
   trigger, add `is_active()`, fold `activo` into `is_admin()`, gate write RPCs + SELECT policies.
2. **Edge** — one admin-gated Deno function at `supabase/functions/enroll-empleado/` (service_role;
   create/list/revoke staff).
3. **Lib** — raw-IndexedDB vault (`src/lib/vault.ts`), supabase-js session lifecycle, lockout persistence.
4. **UI** — PIN unlock (handoff screen 1), device-pairing screen, net-new admin employee-management screen.

## 2. Design decisions

| ID | Resolves | Decision | Rejected |
|----|----------|----------|----------|
| DD-1 | OQ-1 | Raw IndexedDB, thin typed wrapper `src/lib/vault.ts`, ZERO dep | `idb-keyval` / `idb` |
| DD-2 | OQ-2 | Client-side persisted lockout + backoff table + terminal blob-wipe; `auth_attempts` is authenticated-only telemetry (cannot gate offline unlock); PBKDF2 600k is the real backstop | Server-throttled unlock; in-memory-only counter |
| DD-3 | OQ-3 | Pairing: admin types password ONCE, employee sets OWN PIN; daily = selector + 4 digits; entry via "+ vincular" affordance on PIN screen | Admin pre-sets a temp PIN |
| DD-4 | OQ-4 | `auth.admin.createUser({email,password,email_confirm:true,app_metadata:{rol}})` | `inviteUserByEmail` |
| DD-5 | — | Additive, reversible migration (see §3) | Destructive ALTER |
| DD-6 | — | `enroll-empleado` Edge Function: verify caller is active admin via service_role, then createUser + app_metadata role + audit_log; also serves list/revoke | Trust a client-supplied role; separate function per action |
| DD-7 | — | supabase-js `persistSession:false` + in-memory storage; unlock via `refreshSession({refresh_token})`; RE-ENCRYPT rotated refresh token on every unlock | Default localStorage (plaintext-persists the refresh token — defeats D5) |
| DD-8 | — | Role-based UI concealment is UX-ONLY; RLS/RPC is the sole boundary | Trust route guards for security |
| DD-9 | D6 | Inactivity auto-lock via wall-clock delta on `visibilitychange`/foreground interval, NOT `setTimeout` | Naive `setTimeout` (throttled/frozen in backgrounded PWA) |
| DD-10 | — | PIN screen decomposed onto atomic design (see §6) | Monolithic component |
| DD-11 | — | Employee-management = NET-NEW surface; visual language derived from handoff; roster served by the Edge Function (GET), no `profiles` read-policy widening, no name column | Broad `profiles_select_admin` policy + `nombre` column |
| DD-12 | R1 | Sequence smallest-first: DB → lib → daily vertical slice (pair+unlock) → enrollment → management UI → revocation → polish → verify | Big-bang implementation |
| DD-13 | R4 | Verify = installed-PWA WebCrypto/IDB smoke test + multi-role JWT battery + revoked-user battery | Trust `crypto.ts` untested in SW context |

### DD-1 — IndexedDB access (OQ-1)
The vault stores, per enrolled profile in THIS browser, a single record keyed by `user_id`. This is a
one-object-store get/getAll/put/delete surface — exactly `idb-keyval`'s scope, but small enough (~40 LOC)
that a dependency is not justified under the post-TanStack supply-chain posture (`minimumReleaseAge=1440`,
lifecycle scripts blocked — every dep is deliberate cost). `ArrayBuffer`/`Uint8Array` (ciphertext, iv,
salt) are stored natively by IndexedDB via structured clone — the exact serialization a helper would
abstract is already free. `getAll()` over enrolled users fits a named object store better than
`idb-keyval`'s store-per-DB model. RFC: the implementation MUST use raw IDB with a promisified wrapper;
it MUST NOT add an IDB helper dependency.

```ts
// src/lib/vault.ts
export interface VaultRecord {
  userId: string          // auth.users.id — object-store keyPath
  displayName: string     // from user.user_metadata.display_name — powers the PIN selector
  rol: 'admin' | 'empleado'
  salt: Uint8Array        // 16 bytes, from generateSalt()
  iv: Uint8Array          // 12 bytes
  ciphertext: ArrayBuffer // AES-GCM(refresh_token)
  failCount: number       // lockout counter — persisted so reload can't reset it (DD-2)
  lockedUntil: number | null
  pairedAt: number
}
// DB 'antimahue-vault' v1, objectStore 'profiles' keyPath 'userId'.
export function putRecord(r: VaultRecord): Promise<void>
export function getRecord(userId: string): Promise<VaultRecord | undefined>
export function listRecords(): Promise<VaultRecord[]>   // PIN-screen selector source
export function deleteRecord(userId: string): Promise<void>  // terminal wipe (DD-2)
```

### DD-2 — Lockout policy (OQ-2)
Threat model: the "attacker" is a shared store phone / casual on-device guesser, NOT a sophisticated
adversary. Two facts govern the numbers:
- **The blob can be brute-forced OFFLINE if extracted.** 4-digit PIN = 10^4 keyspace; the only real cost
  is PBKDF2 600k SHA-256 (~200-400 ms/attempt on a phone). Client lockout CANNOT protect an exfiltrated
  blob — PBKDF2 is the crypto backstop; lockout is casual/UI defense only. Document this limitation.
- **The daily unlock is OFFLINE and has no authenticated session** (the token is still encrypted), so it
  CANNOT write `auth_attempts` — an anon client has zero grants (deny-by-default). Therefore the unlock
  lockout MUST live client-side, and it MUST be PERSISTED in the same IDB store as the ciphertext (a
  memory-only counter is reset by a reload → trivial bypass). Binding the counter to the vault means you
  cannot reset it without deleting the ciphertext you are attacking. `auth_attempts` records only
  AUTHENTICATED events (successful unlocks, enrollment/re-pair logins) as telemetry — it does NOT gate
  offline failures. `src/stores/lock.ts`'s "mirrored to the server" comment is INCORRECT and MUST be fixed.

Backoff (`failCount` = consecutive GCM auth-tag failures; a successful decrypt resets to 0):

| Consecutive fails | Consequence |
|---|---|
| 1–4 | retry immediately (fat-finger tolerance) |
| 5 | 30 s cooldown |
| 6 | 2 min |
| 7 | 10 min |
| 8 | 1 h |
| 9 | **wipe local blob** → re-pairing required (email+password + set PIN) |

RFC: the counter MUST be persisted per profile in the vault; the cooldown MUST be enforced against
`Date.now()` vs `lockedUntil`; on the 9th failure the client MUST `deleteRecord(userId)` and route to
pairing. Wipe is NOT a permanent account ban (that is admin revocation, D5) — it only removes the local
attack target; re-pairing re-provisions the blob. On a shared, owner-present phone, wipe is a rare
terminal event and its cost (re-entering the enrollment password) is acceptable.

### DD-3 — Device-pairing UX (OQ-3)
Daily path stays ≤2 taps: open app → (pick user if >1) → type 4 digits. Pairing is the heavy ONE-TIME
path and never intrudes on daily use.

Pairing sequence (`PairDeviceScreen`, reachable from the PIN selector's "+ vincular"):
1. Enter email + password (the admin-set enrollment credential). **The admin (Angélica) types the password
   once** — the employee never learns/handles it, keeping the password out of daily use.
2. `supabase.auth.signInWithPassword()` — the ONE network login D1 requires.
3. On success, the EMPLOYEE sets their OWN 4-digit PIN (entered twice to confirm). Admin never knows it
   (no impersonation; the employee owns their secret).
4. `generateSalt()` → `deriveKey(pin,salt)` → `encryptToken(session.refresh_token,key)` →
   `putRecord({userId, displayName: user.user_metadata.display_name, rol, salt, iv, ciphertext, ...})`.
5. Thereafter the user appears in the selector; daily unlock is PIN-only.

RFC: pairing MUST persist ONLY the encrypted refresh token (never plaintext, never the password). The
selector MUST source users ENTIRELY from `listRecords()` (local) — there is no anon-readable staff
directory (`profiles` RLS is own-row-only). If only one record exists it is auto-selected; if none,
the screen shows only "+ vincular". Offline caveat: pairing requires connectivity (it is a real login);
this is expected and rare.

### DD-4 — Enrollment primitive (OQ-4)
`createUser` over `inviteUserByEmail` because: (a) Chilean retail staff may lack reliable email; an invite
magic-link is friction on a one-shared-phone store; (b) Supabase FREE-plan default SMTP is test-only with
a very low rate — invites may not deliver; (c) `createUser` with `email_confirm:true` is immediate, needs
NO email delivery and NO employee email access — the owner provisions the account. The email is only a
login identifier (a store-controlled address is fine; it is never mailed). RFC: enrollment MUST use
`createUser`; the password is admin-set at enrollment; the response MUST NOT return the password or any token.

## 3. Migration (additive, reversible) — DD-5

`supabase/migrations/20260714000000_auth_pin_multirole.sql` (deployed via the GitHub schema integration on
merge to `main`; date-prefixed, strictly increasing; never applied via MCP `apply_migration`).

```sql
-- 1. widen role CHECK (auto-named constraint from the inline scaffold CHECK)
ALTER TABLE public.profiles DROP CONSTRAINT profiles_rol_check;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_rol_check CHECK (rol IN ('admin','empleado'));

-- 2. revocation gate column
ALTER TABLE public.profiles ADD COLUMN activo boolean NOT NULL DEFAULT true;

-- 3. harden signup trigger: role from tamper-proof app_metadata (service_role-only), least-priv default
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_app_meta_data->>'rol', 'empleado'));  -- default flips to least-priv
  RETURN NEW;
END; $$;

-- 4. is_active(): DEFINER, mirrors is_admin() hygiene
CREATE OR REPLACE FUNCTION public.is_active()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND activo);
$$;
REVOKE EXECUTE ON FUNCTION public.is_active() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_active() TO authenticated;

-- 5. fold activo into is_admin (a revoked admin instantly loses admin powers)
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = (select auth.uid()) AND rol = 'admin' AND activo);
$$;

-- 6. gate write RPCs on is_active() (add after the existing auth.uid() checks, via CREATE OR REPLACE)
--    confirmar_venta, deshacer_venta, crear_producto, actualizar_producto:
--      IF NOT public.is_active() THEN RAISE EXCEPTION 'usuario inactivo'; END IF;

-- 7. gate the low-harm SELECT policies so a revoked user loses ALL access on the NEXT request
--    (producto_costos/proveedores/movimientos already gate via is_admin() → now activo-folded)
DROP POLICY productos_select     ON public.productos;
CREATE POLICY productos_select     ON public.productos     FOR SELECT TO authenticated USING ((select public.is_active()));
DROP POLICY ventas_select        ON public.ventas;
CREATE POLICY ventas_select        ON public.ventas        FOR SELECT TO authenticated USING ((select public.is_active()));
DROP POLICY venta_items_select   ON public.venta_items;
CREATE POLICY venta_items_select   ON public.venta_items   FOR SELECT TO authenticated USING ((select public.is_active()));
DROP POLICY configuracion_select ON public.configuracion;
CREATE POLICY configuracion_select ON public.configuracion FOR SELECT TO authenticated USING ((select public.is_active()));
```

Down migration: narrow the CHECK back to `('admin')` (precondition: no `'empleado'` rows), drop `activo`,
restore `handle_new_user` default `'admin'`, restore `USING(true)` policies, drop `is_active()`. RFC: the
`is_active()` predicate MUST be wrapped `(select ...)` for init-plan caching, matching the existing policy
style; it is one PK-indexed lookup per request (cheap, STABLE).

## 4. enroll-empleado Edge Function — DD-6

Path `supabase/functions/enroll-empleado/index.ts` (Deno). Retains the approved proposal path; internally a
small admin function for staff administration. Auth chain (MUST, in order):

1. CORS preflight (`OPTIONS`) → allow the SPA origin.
2. Read caller JWT from `Authorization: Bearer`. Missing/invalid → **401**.
3. With SERVICE_ROLE, `SELECT rol, activo FROM profiles WHERE id = <caller>`; require `rol='admin' AND
   activo`. Not admin / inactive → **403**. (Never trust a client-supplied role.)
4. Dispatch by method:

| Method | Action | Body | Effect | Errors |
|---|---|---|---|---|
| `POST` | enroll | `{email,password,displayName}` | `admin.createUser({email,password,email_confirm:true, app_metadata:{rol:'empleado'}, user_metadata:{display_name}})`; trigger writes the profile; `audit_log(actor=caller, action='enroll_empleado', entity='auth.users', entity_id=new.id)` | 409 email exists, 422 weak pw/bad email |
| `GET` | list | — | `admin.listUsers()` ∩ `profiles` → `[{id,email,displayName,rol,activo,banned}]` — roster for the management screen | — |
| `PATCH` | revoke/restore | `{userId,activo}` | `UPDATE profiles SET activo=<>`; on revoke also `admin.updateUserById(userId,{ban_duration:'876000h'})`; on restore `ban_duration:'none'`; audit_log | 404 unknown user |

RFC: SERVICE_ROLE_KEY MUST come from the function env and MUST NEVER appear under `src/`. Responses MUST
NOT include the password or any token. The DB `activo` flip (immediate gate) and the `ban_duration`
hard-lock (durable) are BOTH done here so one round-trip closes both the ≤1h access-token window and
refresh.

## 5. SPA session architecture — DD-7 / DD-8 / DD-9

**Client (`src/lib/supabase.ts`)**: set `persistSession:false` + an in-memory `storage` shim so supabase-js
NEVER writes the refresh token to plaintext localStorage (the current default DEFEATS D5). `autoRefreshToken:
true` keeps the access token warm in memory while unlocked.

**Unlock primitive** (`usePinUnlock`): `getRecord(userId)` → `deriveKey(pin,salt)` →
`decryptToken({ciphertext,iv},key)` → `supabase.auth.refreshSession({refresh_token})`. On success: session
is in memory; supabase rotates the refresh token → RE-ENCRYPT the returned `session.refresh_token` with the
SAME key/salt and `putRecord` it (else the next unlock uses a stale token and fails). Reset `failCount`.
Fetch own `profiles` row → `rol` into `$auth`. Edge case: a rotated/reused-detected refresh token →
`refreshSession` fails → route to re-pairing.

**Stores**:
```ts
// src/stores/auth.ts — extend
interface AuthState { session: Session|null; user: User|null;
  rol: 'admin'|'empleado'|null; status: 'locked'|'unlocking'|'unlocked'; loading: boolean }
// src/stores/lock.ts — failCount/lockedUntil mirror the vault record (DD-2); fix the stale comment
```

**Route guards (RRv7 `createBrowserRouter`)**: `<RequireSession>` redirects to `/` when
`status!=='unlocked'`; `<RequireAdmin>` redirects `empleado` away from `/proveedor`, `/dte`, `/empleadas`,
cost views. **DD-8**: guards + hidden cost/margin cards + hidden nav items are UX-ONLY. A revoked/empleado
user who reaches `/proveedor` still gets `[]` from RLS — nothing leaks. The boundary is Postgres.

**Inactivity auto-lock (D6/DD-9)**: after N min idle, clear the in-memory access token (via
`$auth.status='locked'`) → router shows PIN. Re-unlock = PIN decrypt (local) → `refreshSession` (network;
graceful offline retry). The encrypted blob stays at rest — no authorization gained/lost. Timer MUST use a
wall-clock delta: on `visibilitychange`→hidden record `Date.now()`; on →visible, if `now-hidden > threshold`
lock immediately; a foreground `setInterval` covers active use. MUST NOT rely on `setTimeout` alone
(throttled/frozen when the PWA is backgrounded). Handle `pagehide`/`freeze`/bfcache resume.

## 6. PIN screen + pairing components (atomic design) — DD-10

Maps handoff screen 1 (Terraza tokens, DM Sans, Phosphor `fill`).

| Layer | Component | Handoff spec |
|---|---|---|
| atom | `PinDot` | 13×13, filled `#8B5E3C` / empty border `#D9C3A0`, 150 ms fill |
| atom | `PinKey` | 66×66 circle, `#FDFAF4` bg, `1px #D9C3A0`, 22px/500 |
| atom | `AppIcon` | 70×70 maple-leaf SVG, gradient `#C84030→#8A2010` |
| molecule | `PinDots` | row of 4 `PinDot` |
| molecule | `PinPad` | 3×4 grid + `Backspace` (Phosphor) + empty [9,0] cell |
| molecule | `UserSelector` | avatars/names from `listRecords()`; auto-select if 1; "+ vincular" |
| organism | `PinUnlockPanel` | AppIcon + title "Antimahue" + subtitle(selected) + "INGRESA TU PIN" + PinDots + PinPad + lockout countdown |
| feature | `PinScreen.tsx` | container; `usePinUnlock` state machine; disabled pad while locked |
| feature | `PairDeviceScreen.tsx` | email+password → set-PIN×2 → encrypt → vault (DD-3) |
| hook | `usePinUnlock` | 4 digits → unlock; failure → backoff (DD-2) |

Behavior (handoff): 4th digit → 350 ms → navigate `/dashboard`; reset dots after navigate. NOTE: the
handoff's "todo PIN de 4 dígitos funciona en el MVP" is a PROTOTYPE stub — the real gate is GCM decrypt
success (a wrong PIN never advances).

## 7. Employee-management surface (NET-NEW) — DD-11

> FLAG FOR USER REVIEW: this screen is ABSENT from the 9-screen hi-fi handoff — it is invented, not
> replicated (Risk R2). Visual language derived from the handoff (terracota header, pergamino body, card
> list, DM Sans, Phosphor `fill`).

Route `/empleadas` (admin-only). Terracota header: back + "Vendedoras" + "+" (add). Body: roster cards
(displayName + `activo` badge + revoke/restore toggle) from `enroll-empleado` `GET`. "+" → inline form
(nombre, email, password) → `POST`. Revoke toggle → `PATCH`. Roster comes from the Edge Function (service_role
joins `auth.users`+`profiles`) — no broad `profiles` read policy, no `nombre` column.

## 8. Sequencing (smallest-first, counters R1) — DD-12

| # | Slice | Ships/testable independently |
|---|---|---|
| 1 | Migration (§3) + run deferred JWT battery T-5.1..T-5.5 | DB deploys via GitHub integration; verify SQL |
| 2 | `src/lib/vault.ts` + extend `$auth`/`$lock` + `supabase.ts` `persistSession:false` | pure lib, unit-testable |
| 3 | `PairDeviceScreen` (creates the first blob — Angélica pairs) | vertical: real login → PIN → vault |
| 4 | PIN atoms/molecules/organism + `usePinUnlock` + real `PinScreen` | DAILY unlock works for the paired user |
| 5 | `enroll-empleado` Edge Function `POST` | admin creates an employee |
| 6 | `/empleadas` management screen (`GET` list + form) | net-new UI |
| 7 | Revocation (`PATCH`: activo + ban) + wire revoke toggle | fired-employee lockout |
| 8 | Inactivity auto-lock + route guards + role concealment | UX polish |
| 9 | Verify (§9) | PWA smoke + JWT + revoked battery |

The scope-creep pieces (5-7) land AFTER the core daily path (1-4) already works — if scope must be cut,
the daily unlock still ships. **APPLY GATE (from proposal): apply is BLOCKED until a minimal toolchain
(linter+formatter+test runner+CI) exists AND `supabase gen types typescript` is run.**

## 9. Verify strategy — DD-13

| Layer | Test | How |
|---|---|---|
| PWA (R4) | WebCrypto/IDB roundtrip INSIDE the installed PWA (standalone, SW-controlled) | harness page: `generateSalt`→`deriveKey`→`encryptToken`→`putRecord`→reload→`getRecord`→`decryptToken`→assert; assert `crypto.subtle` present in standalone context |
| JWT T-5.1 | empleado → `GET producto_costos` → `[]` (RLS), NOT 403 | supabase-js with a real empleado session |
| JWT T-5.2 | empleado → `GET proveedores` → `[]` | " |
| JWT T-5.3 | empleado → `confirmar_venta` → success (selling shared) | " |
| JWT T-5.4 | empleado → `crear_producto`/`actualizar_producto` → RAISE 'solo admin' | " |
| JWT T-5.5 | admin → all sensitive reads/writes permitted | admin session |
| Revoked (new) | `activo=false` empleado → `confirmar_venta` → RAISE 'usuario inactivo'; `productos` SELECT → `[]`; revoked admin → `is_admin()` false | flip `activo`, re-run |
| Network | unlock request trace shows NO PIN and NO token (only the one-time enrollment login authenticates) | devtools/network |

## 10. File changes

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260714000000_auth_pin_multirole.sql` | Create | §3 additive migration |
| `supabase/functions/enroll-empleado/index.ts` | Create | §4 admin Edge Function |
| `src/lib/vault.ts` | Create | DD-1 raw-IDB vault |
| `src/lib/supabase.ts` | Modify | DD-7 `persistSession:false` + memory storage |
| `src/stores/auth.ts` | Modify | DD-7 add `rol`/`status` |
| `src/stores/lock.ts` | Modify | DD-2 finalize backoff; fix "mirrored to server" comment |
| `src/features/auth/PinScreen.tsx` | Modify | skeleton → real container (DD-10) |
| `src/features/auth/PairDeviceScreen.tsx` | Create | DD-3 pairing |
| `src/features/auth/usePinUnlock.ts` | Create | unlock state machine |
| `src/components/atoms/{PinDot,PinKey,AppIcon}.tsx` | Create | DD-10 atoms |
| `src/components/molecules/{PinDots,PinPad,UserSelector}.tsx` | Create | DD-10 molecules |
| `src/features/empleadas/EmpleadasScreen.tsx` | Create | DD-11 net-new admin screen |
| `src/lib/router.tsx` | Modify | `/empleadas` route + `RequireSession`/`RequireAdmin` guards |

## Open questions
None blocking. Residual (defer to tasks/apply): exact idle threshold minutes (D6) — propose 5 min, confirm
with user; whether re-pairing after a DD-2 wipe should let the employee rotate the admin-set password to a
self-known one (nice-to-have, not MVP).
