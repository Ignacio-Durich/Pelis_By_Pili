import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { SessionContext } from '../features/auth/sessionContext'
import { CoupleContext, type Couple } from '../features/couple/coupleContext'

export const tomas = { userId: 'u1', displayName: 'Tomás' }
export const juli = { userId: 'u2', displayName: 'Juli' }

// Envuelve con la sesión de Tomás (u1) y un espacio con los miembros dados.
export function withCouple(ui: ReactNode, members: Couple['members'] = [tomas, juli]) {
  return (
    <SessionContext.Provider value={{ user: { id: 'u1' } } as Session}>
      <CoupleContext.Provider value={{ coupleId: 'c1', memberCount: members.length, members }}>{ui}</CoupleContext.Provider>
    </SessionContext.Provider>
  )
}
