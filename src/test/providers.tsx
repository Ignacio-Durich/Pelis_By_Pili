import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { SessionContext } from '../features/auth/sessionContext'
import { CoupleContext, type Couple } from '../features/couple/coupleContext'

export const nacho = { userId: 'u1', displayName: 'Nacho' }
export const pili = { userId: 'u2', displayName: 'Pili' }

// Envuelve con la sesión de Nacho (u1) y un espacio con los miembros dados.
export function withCouple(ui: ReactNode, members: Couple['members'] = [nacho, pili]) {
  return (
    <SessionContext.Provider value={{ user: { id: 'u1' } } as Session}>
      <CoupleContext.Provider value={{ coupleId: 'c1', memberCount: members.length, members }}>{ui}</CoupleContext.Provider>
    </SessionContext.Provider>
  )
}
