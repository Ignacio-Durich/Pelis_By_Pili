import { supabase } from '../../lib/supabase'
import type { Vote } from './bumbleLogic'

// Partida de dos celulares. (Con un solo celular la partida no pasa por la base.)
export type BumbleSession = { id: string; deck: string[]; votes: Vote[] }

export type BumbleErrorKind = 'network' | 'closed' | 'invalid_deck' | 'no_partner' | 'not_found' | 'not_in_deck'

export class BumbleError extends Error {
  kind: BumbleErrorKind
  constructor(kind: BumbleErrorKind) {
    super(kind)
    this.kind = kind
  }
}

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

// Las funciones SQL lanzan excepciones cuyo mensaje es exactamente el código.
const functionErrors: string[] = ['closed', 'invalid_deck', 'no_partner', 'not_found', 'not_in_deck']

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new BumbleError(functionErrors.includes(error.message) ? (error.message as BumbleErrorKind) : 'network')
  return data as T
}

export const startBumble = (titleIds: string[]) => call<string>('start_bumble', { p_title_ids: titleIds })

export const bumbleVote = (sessionId: string, round: number, titleId: string, liked: boolean) =>
  call<void>('bumble_vote', { p_session_id: sessionId, p_round: round, p_title_id: titleId, p_liked: liked })

export const bumbleUndo = (sessionId: string) => call<void>('bumble_undo', { p_session_id: sessionId })

export const finishBumble = (sessionId: string, resultTitleId: string | null) =>
  call<void>('finish_bumble', { p_session_id: sessionId, p_result_title_id: resultTitleId })

// Igual que subscribeTitles: ante cualquier cambio se recarga la partida entera. Los DELETE
// (deshacer) van sin filtro porque Realtime no los filtra; con RLS solo traen el id.
export function subscribeBumble(coupleId: string, onChange: () => void): () => void {
  const filter = `couple_id=eq.${coupleId}`
  const channel = supabase
    .channel(`bumble:${coupleId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bumble_sessions', filter }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bumble_sessions', filter }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bumble_votes', filter }, () => onChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bumble_votes' }, () => onChange())
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') onChange()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
