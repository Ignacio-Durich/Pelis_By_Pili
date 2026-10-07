import { createContext, useContext } from 'react'

export type Member = { userId: string; displayName: string | null }

export type Couple = { coupleId: string; memberCount: number; members: Member[] }

export const CoupleContext = createContext<Couple | null>(null)

export function useCouple(): Couple {
  const couple = useContext(CoupleContext)
  if (!couple) throw new Error('useCouple fuera de CoupleGate')
  return couple
}

export function useMemberName(): (userId: string | null) => string {
  const { members } = useCouple()
  return (userId) => members.find((m) => m.userId === userId)?.displayName ?? 'alguien'
}
