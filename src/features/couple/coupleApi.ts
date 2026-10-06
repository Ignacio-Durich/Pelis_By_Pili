import { supabase } from '../../lib/supabase'

export type CoupleErrorKind = 'already_in_couple' | 'couple_full' | 'invite_invalid' | 'not_a_member' | 'network'

export class CoupleError extends Error {
  kind: CoupleErrorKind
  constructor(kind: CoupleErrorKind) {
    super(kind)
    this.kind = kind
  }
}

const knownKinds: string[] = ['already_in_couple', 'couple_full', 'invite_invalid', 'not_a_member']

// Las funciones SQL lanzan excepciones cuyo mensaje es exactamente el código.
function toCoupleError(error: { message: string }): CoupleError {
  return new CoupleError(knownKinds.includes(error.message) ? (error.message as CoupleErrorKind) : 'network')
}

async function rpc(name: string, args?: Record<string, string>): Promise<string> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw toCoupleError(error)
  return data as string
}

export async function getMyCouple(): Promise<{ coupleId: string; memberCount: number } | null> {
  // RLS solo deja ver las filas del propio espacio, y cada persona está en un solo espacio.
  const { data, error } = await supabase.from('couple_members').select('couple_id')
  if (error) throw toCoupleError(error)
  if (data.length === 0) return null
  return { coupleId: data[0].couple_id as string, memberCount: data.length }
}

export const createCouple = () => rpc('create_couple')
export const createInvite = () => rpc('create_invite')
export const acceptInvite = (token: string) => rpc('accept_invite', { p_token: token })
