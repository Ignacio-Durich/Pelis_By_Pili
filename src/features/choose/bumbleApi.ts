import { supabase } from '../../lib/supabase'
import { callRpc, CodedError } from '../../lib/rpc'
import { subscribeCouple, type Change } from '../../lib/realtime'
import type { Vote } from './bumbleLogic'

// Partida de dos celulares. (Con un solo celular la partida no pasa por la base.)
export type BumbleSession = { id: string; deck: string[]; votes: Vote[] }

export type BumbleErrorKind = 'network' | 'closed' | 'invalid_deck' | 'no_partner' | 'not_found' | 'not_in_deck'

export class BumbleError extends CodedError<BumbleErrorKind> {}

type VoteRow = { id: string; user_id: string; round: number; title_id: string; liked: boolean; created_at: string }

export async function loadOpenBumble(coupleId: string): Promise<BumbleSession | null> {
  const { data, error } = await supabase
    .from('bumble_sessions')
    .select('id, deck, bumble_votes(id, user_id, round, title_id, liked, created_at)')
    .eq('couple_id', coupleId)
    .eq('status', 'open')
    .maybeSingle()
  if (error) throw new BumbleError('network')
  if (!data) return null
  const rows = (data.bumble_votes as VoteRow[]).toSorted((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  // En orden de llegada: "Deshacer" saca el último de cada uno.
  return {
    id: data.id as string,
    deck: data.deck as string[],
    votes: rows.map((r) => ({ userId: r.user_id, round: r.round, titleId: r.title_id, liked: r.liked })),
  }
}

const call = <T>(name: string, args: Record<string, unknown>) =>
  callRpc<T, BumbleErrorKind>(name, args, ['closed', 'invalid_deck', 'no_partner', 'not_found', 'not_in_deck'], (kind) => new BumbleError(kind))

export const startBumble = (titleIds: string[]) => call<string>('start_bumble', { p_title_ids: titleIds })

export const bumbleVote = (sessionId: string, round: number, titleId: string, liked: boolean) =>
  call<void>('bumble_vote', { p_session_id: sessionId, p_round: round, p_title_id: titleId, p_liked: liked })

export const bumbleUndo = (sessionId: string) => call<void>('bumble_undo', { p_session_id: sessionId })

export const finishBumble = (sessionId: string, resultTitleId: string | null) =>
  call<void>('finish_bumble', { p_session_id: sessionId, p_result_title_id: resultTitleId })

// Ante cualquier cambio (incluido deshacer, que borra un voto) se recarga la partida entera.
export function subscribeBumble(coupleId: string, onChange: () => void): () => void {
  const changes: Change[] = [
    ['INSERT', 'bumble_sessions'],
    ['UPDATE', 'bumble_sessions'],
    ['INSERT', 'bumble_votes'],
    ['DELETE', 'bumble_votes'],
  ]
  return subscribeCouple('bumble', coupleId, changes, onChange)
}
