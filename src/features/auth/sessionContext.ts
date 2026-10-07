import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export const SessionContext = createContext<Session | null>(null)

export function useUserId(): string {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useUserId fuera de AuthGate')
  return session.user.id
}
