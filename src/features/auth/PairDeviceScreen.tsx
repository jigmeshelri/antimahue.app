/**
 * PairDeviceScreen — device pairing, one-time (DD-3, T-3.1/T-3.2).
 *
 * NET-NEW surface, absent from the 9-screen hi-fi handoff (flagged in
 * proposal.md's Risk R2 — same status as the Phase 6 employee-management
 * screen). Visual language is derived from the handoff's Terraza palette
 * (docs/design_handoff_antimahue/README.md) and kept deliberately minimal:
 * this is the rare, heavy, ONE-TIME path (DD-3), never the daily one, and
 * there is no repo-wide Tailwind entry stylesheet wired yet (that lands
 * with Phase 4's atomic PIN components) — plain inline styles avoid
 * depending on a pipeline that doesn't exist yet for this slice.
 *
 * Two steps, matching DD-3 exactly:
 *   1. Email + admin-set password → `signInForPairing` (the ONE network
 *      login). The password is cleared from state the instant this
 *      resolves, success or failure — it is never needed again.
 *   2. The employee sets their OWN 4-digit PIN (entered twice to confirm,
 *      admin never learns it) → `completePairing` (local crypto + vault
 *      write, zero network). The PIN and the session are cleared from
 *      state once used.
 *
 * All orchestration logic lives in `pairDevice.ts` (unit-tested there,
 * mocking only supabase-js) — this component is a thin, testable-by-
 * inspection container over that logic plus form state.
 */
import { useState, type CSSProperties, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { completePairing, PairingError, signInForPairing } from './pairDevice'

type Step = 'credentials' | 'pin' | 'success'

const PIN_PATTERN = /^\d{4}$/

const colors = {
  bgScreen: '#F5EED8',
  bgCard: '#FDFAF4',
  borderSand: '#D9C3A0',
  textPrimary: '#2D1F14',
  textSecondary: '#B09070',
  madera: '#8B5E3C',
  corteza: '#2D1F14',
  errorText: '#A33A2A',
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: colors.bgScreen,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'DM Sans, system-ui, sans-serif',
  padding: '24px 16px',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  background: colors.bgCard,
  border: `1px solid ${colors.borderSand}`,
  borderRadius: 12,
  padding: '24px 20px',
  boxSizing: 'border-box',
}

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: colors.textPrimary,
  letterSpacing: '-0.025em',
  margin: '0 0 4px',
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: colors.textSecondary,
  margin: '0 0 20px',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: colors.textSecondary,
  marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: colors.bgCard,
  border: `1px solid ${colors.borderSand}`,
  borderRadius: 10,
  padding: '11px 13px',
  fontSize: 15,
  color: colors.textPrimary,
  marginBottom: 14,
}

const buttonStyle: CSSProperties = {
  width: '100%',
  background: colors.corteza,
  color: colors.bgScreen,
  border: 'none',
  borderRadius: 12,
  padding: 14,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: colors.errorText,
  margin: '0 0 12px',
}

export default function PairDeviceScreen() {
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const nextSession = await signInForPairing(email, password)
      setSession(nextSession)
      setStep('pin')
    } catch (err) {
      setError(err instanceof PairingError ? err.message : 'No se pudo conectar. Intenta de nuevo.')
    } finally {
      // The password is never needed again past this call — clear it
      // immediately regardless of the outcome.
      setPassword('')
      setSubmitting(false)
    }
  }

  async function handlePinSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!PIN_PATTERN.test(pin)) {
      setError('El PIN debe tener 4 dígitos.')
      return
    }
    if (pin !== pinConfirm) {
      setError('Los PIN ingresados no coinciden.')
      setPinConfirm('')
      return
    }
    if (!session) {
      setError('La sesión expiró. Vuelve a ingresar tu contraseña.')
      setStep('credentials')
      return
    }

    setSubmitting(true)
    try {
      await completePairing(session, pin)
      setStep('success')
    } catch (err) {
      setError(err instanceof PairingError ? err.message : 'No se pudo vincular el dispositivo.')
    } finally {
      // Neither the PIN nor the session (the still-unencrypted refresh
      // token's holder) should linger once pairing is done — success or not.
      setPin('')
      setPinConfirm('')
      setSession(null)
      setSubmitting(false)
    }
  }

  function handlePinDigitsChange(raw: string, setter: (value: string) => void) {
    setter(raw.replace(/\D/g, '').slice(0, 4))
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit}>
            <h1 style={titleStyle}>Vincular dispositivo</h1>
            <p style={subtitleStyle}>Ingresa con la cuenta que te creó Angélica.</p>
            {error && <p style={errorStyle}>{error}</p>}
            <label style={labelStyle} htmlFor="pair-email">
              Email
            </label>
            <input
              id="pair-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <label style={labelStyle} htmlFor="pair-password">
              Contraseña
            </label>
            <input
              id="pair-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" style={buttonStyle} disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={handlePinSubmit}>
            <h1 style={titleStyle}>Elige tu PIN</h1>
            <p style={subtitleStyle}>4 dígitos que usarás todos los días. Nadie más lo sabrá.</p>
            {error && <p style={errorStyle}>{error}</p>}
            <label style={labelStyle} htmlFor="pair-pin">
              PIN
            </label>
            <input
              id="pair-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => handlePinDigitsChange(e.target.value, setPin)}
              style={inputStyle}
            />
            <label style={labelStyle} htmlFor="pair-pin-confirm">
              Confirma tu PIN
            </label>
            <input
              id="pair-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              required
              value={pinConfirm}
              onChange={(e) => handlePinDigitsChange(e.target.value, setPinConfirm)}
              style={inputStyle}
            />
            <button type="submit" style={buttonStyle} disabled={submitting}>
              {submitting ? 'Vinculando…' : 'Vincular dispositivo'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div>
            <h1 style={titleStyle}>¡Listo!</h1>
            <p style={subtitleStyle}>
              Este dispositivo quedó vinculado. Desde ahora puedes entrar solo con tu PIN.
            </p>
            <a
              href="/"
              style={{
                ...buttonStyle,
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Ir al inicio
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
