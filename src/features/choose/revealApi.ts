import { supabase } from '../../lib/supabase'
import { callRpc, CodedError } from '../../lib/rpc'
import { subscribeCouple } from '../../lib/realtime'

// Partida de Top 3 secreto con dos celulares. Antes de revelar, `picks` trae solo la elección
// propia: la del otro la esconde la base (RLS). (Con un solo celular no pasa por la base.)
export type RevealSession = { id: string; ready: string[]; revealed: boolean; picks: { userId: string; titleIds: string[] }[] }

export type RevealErrorKind = 'network' | 'closed' | 'invalid_picks' | 'no_partner' | 'not_found' | 'not_in_picks' | 'not_revealed'

export class RevealError extends CodedError<RevealErrorKind> {}

type Row = { id: string; ready: string[]; revealed_at: string | null; reveal_picks: { user_id: string; title_ids: string[] }[] }

export async function loadOpenReveal(coupleId: string): Promise<RevealSession | null> {
  const { data, error } = await supabase
    .from('reveal_sessions')
    .select('id, ready, revealed_at, reveal_picks(user_id, title_ids)')
    .eq('couple_id', coupleId)
    .eq('status', 'open')
    .maybeSingle()
  if (error) throw new RevealError('network')
  if (!data) return null
  const row = data as Row
  return {
    id: row.id,
    ready: row.ready,
    revealed: row.revealed_at !== null,
    picks: row.reveal_picks.map((p) => ({ userId: p.user_id, titleIds: p.title_ids })),
  }
}

const call = <T>(name: string, args?: Record<string, unknown>) =>
  callRpc<T, RevealErrorKind>(
    name,
    args,
    ['closed', 'invalid_picks', 'no_partner', 'not_found', 'not_in_picks', 'not_revealed'],
    (kind) => new RevealError(kind),
  )

export const startReveal = () => call<string>('start_reveal')

export const submitReveal = (sessionId: string, titleIds: string[]) =>
  call<void>('submit_reveal', { p_session_id: sessionId, p_title_ids: titleIds })

export const finishReveal = (sessionId: string, resultTitleId: string | null) =>
  call<void>('finish_reveal', { p_session_id: sessionId, p_result_title_id: resultTitleId })

// Solo la partida: cuando alguien elige cambia `ready`, y al revelar, `revealed_at`. Las
// elecciones nunca viajan por Realtime; se piden recargando.
export function subscribeReveal(coupleId: string, onChange: () => void): () => void {
  return subscribeCouple('reveal', coupleId, [['INSERT', 'reveal_sessions'], ['UPDATE', 'reveal_sessions']], onChange)
}
