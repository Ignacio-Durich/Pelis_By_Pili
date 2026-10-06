import { createContext, useContext } from 'react'

export type Couple = { coupleId: string; memberCount: number }

export const CoupleContext = createContext<Couple | null>(null)

export function useCouple(): Couple {
  const couple = useContext(CoupleContext)
  if (!couple) throw new Error('useCouple fuera de CoupleGate')
  return couple
}
