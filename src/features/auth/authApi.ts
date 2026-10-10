import type { Session } from '@supabase/supabase-js'
import { isPlausibleEmail, normalizeEmail } from '../../lib/email'
import { supabase } from '../../lib/supabase'
import { clearCaches } from '../../lib/offline'
import { CodedError } from '../../lib/rpc'

export type AuthErrorKind = 'invalid_email' | 'rate_limited' | 'wrong_code' | 'network'

export class AuthError extends CodedError<AuthErrorKind> {}

type SupabaseAuthError = { name: string; status?: number; code?: string }

function isNetwork(error: SupabaseAuthError) {
  return error.name === 'AuthRetryableFetchError' || error.status === 0
}

function toAuthError(error: SupabaseAuthError, otherwise: AuthErrorKind): AuthError {
  if (isNetwork(error)) return new AuthError('network')
  if (error.status === 429 || error.code?.startsWith('over_')) return new AuthError('rate_limited')
  return new AuthError(otherwise)
}

function validEmail(raw: string): string {
  const email = normalizeEmail(raw)
  if (!isPlausibleEmail(email)) throw new AuthError('invalid_email')
  return email
}

export async function requestCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email: validEmail(email) })
  if (error) throw toAuthError(error, 'invalid_email')
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: validEmail(email), token: code, type: 'email' })
  if (error) throw toAuthError(error, 'wrong_code')
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  // Sin red no sabemos si hay sesión; cualquier otro error (sesión vencida) es "sin sesión".
  if (error && isNetwork(error)) throw new AuthError('network')
  return data.session
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  // INITIAL_SESSION llega con null también ante un error de red; el arranque lo decide getSession.
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'INITIAL_SESSION') cb(session)
  })
  return () => data.subscription.unsubscribe()
}

// Solo este celular. Con el token vencido y sin red, supabase-js no puede renovarlo y devuelve el
// error sin borrar la sesión: se borra a mano y la segunda vuelta avisa SIGNED_OUT. Las listas se
// olvidan al final, por si una carga terminó mientras tanto.
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      for (const key of Object.keys(localStorage)) if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key)
      await supabase.auth.signOut({ scope: 'local' })
    }
  } finally {
    clearCaches()
  }
}
