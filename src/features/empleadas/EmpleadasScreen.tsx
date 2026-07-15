/**
 * EmpleadasScreen — admin-only employee-management screen (Phase 6, T-6.2,
 * DD-11).
 *
 * NET-NEW surface, absent from the 9-screen hi-fi handoff (proposal.md Risk
 * R2) — visual language derived from the handoff's Terraza tokens (terracota
 * header, pergamino body, card list, `docs/design_handoff_antimahue/README.md`)
 * rather than replicated from a specific mock, per design.md §7.
 *
 * Admin gating here is UX-ONLY (DD-8): the real boundary is Postgres
 * (`is_admin()` inside `enroll-empleado`'s auth chain, and the
 * `listar_perfiles()` RPC it calls — see the Phase 6 migration). This
 * component additionally never even ATTEMPTS the roster fetch unless the
 * in-memory `$auth.rol` is `'admin'` — `<RequireAdmin>` route guard lands in
 * Phase 8, out of scope here, so this is the interim "don't render roster
 * data without an admin session state" gate.
 *
 * Pure network/parsing logic lives in `empleadasApi.ts` (unit-tested there,
 * mocking only `supabase.functions.invoke`) — this component is a thin
 * container over that logic plus form/list UI state, mirroring the
 * `pairDevice.ts`/`PairDeviceScreen.tsx` and `pinUnlock.ts`/`PinScreen.tsx`
 * split (T-3.1, T-4.8/T-4.9). No React Testing Library exists in this repo
 * yet (every test so far covers extracted pure logic, never rendering) —
 * this component's interactive behavior is residual manual/browser
 * verification, same status T-4.9 flagged for `PinScreen.tsx`.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import { ArrowLeftIcon, PlusIcon } from '@phosphor-icons/react'
import { $auth } from '@/stores/auth'
import type { Rol } from '@/lib/vault'
import { EmpleadasApiError, enrollEmpleado, fetchRoster, type RosterEntry } from './empleadasApi'

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administradora',
  empleado: 'Vendedora',
}

const GENERIC_LOAD_ERROR = 'No se pudo cargar la lista de vendedoras.'

export default function EmpleadasScreen() {
  const navigate = useNavigate()
  const auth = useStore($auth)
  const isAdmin = auth.rol === 'admin'

  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Kept as a plain (non-memoized) function: called imperatively from event
  // handlers (the "reintentar" button, `onEnrolled`'s refetch) — the initial
  // mount load below deliberately does NOT call this, and instead inlines
  // its own `.then()/.catch()`, to satisfy `react-hooks/set-state-in-effect`
  // (calling a same-file async helper that itself sets state, even past an
  // `await`, is flagged; a `.then()/.catch()` callback literal — the
  // documented "calling setState in a callback function when external state
  // changes" escape valve — is not; same shape `PinScreen.tsx`'s mount
  // effect already uses for `listRecords()`).
  function loadRoster(): void {
    setLoadError(null)
    fetchRoster()
      .then((entries) => setRoster(entries))
      .catch((err: unknown) => {
        setRoster((previous) => previous ?? [])
        setLoadError(err instanceof EmpleadasApiError ? err.message : GENERIC_LOAD_ERROR)
      })
  }

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    fetchRoster()
      .then((entries) => {
        if (cancelled) return
        setRoster(entries)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setRoster((previous) => previous ?? [])
        setLoadError(err instanceof EmpleadasApiError ? err.message : GENERIC_LOAD_ERROR)
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-pantalla px-6 text-center font-sans">
        <p className="text-[15px] font-medium text-text-primary">Acceso restringido</p>
        <p className="text-[13px] text-text-secondary">
          Esta pantalla está disponible solo para la cuenta de administradora.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-pantalla font-sans">
      <header className="bg-terracota px-[22px] pt-[6px] pb-[18px]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-black/[0.14]"
          >
            <ArrowLeftIcon size={18} weight="fill" color="#FAF0E0" />
          </button>
          <h1 className="text-[17px] font-semibold text-[#FAF0E0]">Vendedoras</h1>
          <button
            type="button"
            onClick={() => setShowForm((previous) => !previous)}
            aria-label={showForm ? 'Cerrar formulario' : 'Agregar vendedora'}
            aria-expanded={showForm}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-black/[0.14]"
          >
            <PlusIcon size={18} weight="fill" color="#FAF0E0" />
          </button>
        </div>
      </header>

      <main className="px-[15px] pt-[13px] pb-[24px]">
        {showForm && (
          <EnrollForm
            onEnrolled={() => {
              setShowForm(false)
              loadRoster()
            }}
          />
        )}

        {loadError && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-error">{loadError}</p>
            <button
              type="button"
              onClick={loadRoster}
              className="shrink-0 text-[12px] font-semibold text-madera underline-offset-2 hover:underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {roster === null ? (
          <p className="text-[13px] text-text-secondary">Cargando…</p>
        ) : roster.length === 0 && !loadError ? (
          <p className="text-[13px] text-text-secondary">Todavía no hay vendedoras registradas.</p>
        ) : (
          <ul className="flex flex-col gap-[8px]">
            {roster.map((entry) => (
              <RosterCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function RosterCard({ entry }: { entry: RosterEntry }) {
  return (
    <li className="flex items-center justify-between gap-[12px] rounded-card border border-border-sand bg-bg-card px-[14px] py-[11px]">
      <div className="flex flex-col">
        <span className="text-[14px] font-medium text-text-primary">{entry.displayName}</span>
        <span className="text-[12px] text-text-secondary">{ROL_LABEL[entry.rol]}</span>
      </div>
      <div className="flex items-center gap-[10px]">
        <span
          className={
            entry.activo
              ? 'rounded-badge bg-success-bg px-[8px] py-[3px] text-[11px] font-semibold text-success'
              : 'rounded-badge bg-terracota-alert-bg px-[8px] py-[3px] text-[11px] font-semibold text-error'
          }
        >
          {entry.activo ? 'Activa' : 'Inactiva'}
        </span>
        {/* Revoke/restore toggle STUB (T-6.2) — wired to the `PATCH` action
            in Phase 7 (T-7.2); intentionally non-interactive here. */}
        <button
          type="button"
          disabled
          title="Disponible en una próxima fase"
          aria-label={
            entry.activo
              ? `Revocar acceso de ${entry.displayName} (disponible en una próxima fase)`
              : `Restaurar acceso de ${entry.displayName} (disponible en una próxima fase)`
          }
          className="h-[22px] w-[38px] shrink-0 cursor-not-allowed rounded-full border border-border-sand bg-border-sand-light opacity-60"
        />
      </div>
    </li>
  )
}

interface EnrollFormProps {
  onEnrolled: () => void
}

function EnrollForm({ onEnrolled }: EnrollFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await enrollEmpleado({ email, password, displayName })
      setDisplayName('')
      setEmail('')
      setPassword('')
      onEnrolled()
    } catch (err) {
      setError(
        err instanceof EmpleadasApiError ? err.message : 'No se pudo agregar a la vendedora.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-[13px] flex flex-col gap-[10px] rounded-card border border-border-sand bg-bg-card p-[14px]"
    >
      <h2 className="text-[14px] font-semibold text-text-primary">Nueva vendedora</h2>
      {error && (
        <p role="alert" className="text-[12px] font-medium text-error">
          {error}
        </p>
      )}
      <label
        className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary"
        htmlFor="empleada-nombre"
      >
        Nombre
        <input
          id="empleada-nombre"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-input border border-border-sand bg-bg-card px-[12px] py-[9px] text-[14px] text-text-primary"
        />
      </label>
      <label
        className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary"
        htmlFor="empleada-email"
      >
        Correo
        <input
          id="empleada-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-input border border-border-sand bg-bg-card px-[12px] py-[9px] text-[14px] text-text-primary"
        />
      </label>
      <label
        className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary"
        htmlFor="empleada-password"
      >
        Contraseña inicial
        <input
          id="empleada-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-input border border-border-sand bg-bg-card px-[12px] py-[9px] text-[14px] text-text-primary"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-button bg-corteza px-[14px] py-[11px] text-[14px] font-semibold text-bg-pantalla"
      >
        {submitting ? 'Agregando…' : 'Agregar vendedora'}
      </button>
    </form>
  )
}
