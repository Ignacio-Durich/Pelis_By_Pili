import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AuthError, getSession, onAuthChange, requestCode, verifyCode, type AuthErrorKind } from './authApi'
import { SessionContext } from './sessionContext'

const messages: Record<AuthErrorKind, string> = {
  invalid_email: 'Ese email no parece válido',
  rate_limited: 'Pediste muchos códigos, esperá unos minutos',
  wrong_code: 'Código incorrecto o vencido',
  network: 'Sin conexión. Probá de nuevo.',
}

function kindOf(error: unknown): AuthErrorKind {
  return error instanceof AuthError ? error.kind : 'network'
}

export function AuthGate({ children }: { children: ReactNode }) {
  // undefined = todavía no sabemos si hay sesión
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [offline, setOffline] = useState(false)

  function fetchSession() {
    getSession().then(setSession, () => setOffline(true))
  }

  function retry() {
    setOffline(false)
    setSession(undefined)
    fetchSession()
  }

  useEffect(() => {
    fetchSession()
    return onAuthChange((s) => {
      setOffline(false)
      setSession(s)
    })
  }, [])

  if (offline) {
    return (
      <main className="screen">
        <p>{messages.network}</p>
        <button onClick={retry}>Reintentar</button>
      </main>
    )
  }
  if (session === undefined) return <main className="screen">Cargando…</main>
  if (session === null) return <LoginForm />
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)

  async function sendEmail(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestCode(email)
      setStep('code')
    } catch (e) {
      setError(kindOf(e))
    } finally {
      setBusy(false)
    }
  }

  async function changeCode(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length < 6) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, digits)
      // La sesión llega por onAuthChange y AuthGate muestra la app.
    } catch (e) {
      setError(kindOf(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>Pelis By Pili</h1>
      {step === 'email' ? (
        <form onSubmit={sendEmail}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Enviarme el código
          </button>
        </form>
      ) : (
        <>
          <label>
            Ingresá el código de 6 dígitos que te llegó por email
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              disabled={busy}
              onChange={(e) => changeCode(e.target.value)}
            />
          </label>
          <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }}>
            Usar otro email
          </button>
        </>
      )}
      {error && <p role="alert">{messages[error]}</p>}
    </main>
  )
}
