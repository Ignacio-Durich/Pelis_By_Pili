import { supabase } from '../../lib/supabase'

// Partida de Top 3 secreto con dos celulares. Antes de revelar, `picks` trae solo la elección
// propia: la del otro la esconde la base (RLS). (Con un solo celular no pasa por la base.)
export type RevealSession = { id: string; ready: string[]; revealed: boolean; picks: { userId: string; titleIds: string[] }[] }

export type RevealErrorKind = 'network' | 'closed' | 'invalid_picks' | 'no_partner' | 'not_found' | 'not_in_picks'

export class RevealError extends Error {
  kind: RevealErrorKind
  constructor(kind: RevealErrorKind) {
    super(kind)
    this.kind = kind
  }
}

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

// Las funciones SQL lanzan excepciones cuyo mensaje es exactamente el código.
const functionErrors: string[] = ['closed', 'invalid_picks', 'no_partner', 'not_found', 'not_in_picks']

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (args ? supabase.rpc(name, args) : supabase.rpc(name))
  if (error) throw new RevealError(functionErrors.includes(error.message) ? (error.message as RevealErrorKind) : 'network')
  return data as T
}

export const startReveal = () => call<string>('start_reveal')

export const submitReveal = (sessionId: string, titleIds: string[]) =>
  call<void>('submit_reveal', { p_session_id: sessionId, p_title_ids: titleIds })

export const finishReveal = (sessionId: string, resultTitleId: string | null) =>
  call<void>('finish_reveal', { p_session_id: sessionId, p_result_title_id: resultTitleId })

// Solo la partida: cuando alguien elige cambia `ready`, y al revelar, `revealed_at`. Las
// elecciones nunca viajan por Realtime; se piden recargando.
export function subscribeReveal(coupleId: string, onChange: () => void): () => void {
  const filter = `couple_id=eq.${coupleId}`
  const channel = supabase
    .channel(`reveal:${coupleId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reveal_sessions', filter }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reveal_sessions', filter }, () => onChange())
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') onChange()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
