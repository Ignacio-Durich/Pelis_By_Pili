import { supabase } from '../../lib/supabase'
import { callRpc, CodedError } from '../../lib/rpc'
import type { Couple } from './coupleContext'

export type CoupleErrorKind =
  | 'already_in_couple'
  | 'couple_full'
  | 'invite_invalid'
  | 'not_a_member'
  | 'invalid_name'
  | 'network'

export class CoupleError extends CodedError<CoupleErrorKind> {}

const knownKinds: string[] = ['already_in_couple', 'couple_full', 'invite_invalid', 'not_a_member', 'invalid_name']

// Las funciones SQL lanzan excepciones cuyo mensaje es exactamente el código.
function toCoupleError(error: { message: string }): CoupleError {
  return new CoupleError(knownKinds.includes(error.message) ? (error.message as CoupleErrorKind) : 'network')
}

const rpc = (name: string, args?: Record<string, string>) =>
  callRpc<string, CoupleErrorKind>(name, args, knownKinds as CoupleErrorKind[], (kind) => new CoupleError(kind))

export async function getMyCouple(): Promise<Couple | null> {
  // RLS solo deja ver las filas del propio espacio, y cada persona está en un solo espacio.
  const { data, error } = await supabase.from('couple_members').select('couple_id, user_id, display_name')
  if (error) throw toCoupleError(error)
  if (data.length === 0) return null
  return {
    coupleId: data[0].couple_id as string,
    memberCount: data.length,
    members: data.map((m) => ({ userId: m.user_id as string, displayName: m.display_name as string | null })),
  }
}

export async function setDisplayName(name: string): Promise<void> {
  await rpc('set_display_name', { p_name: name })
}

export const createCouple = () => rpc('create_couple')
export const createInvite = () => rpc('create_invite')
export const acceptInvite = (token: string) => rpc('accept_invite', { p_token: token })
