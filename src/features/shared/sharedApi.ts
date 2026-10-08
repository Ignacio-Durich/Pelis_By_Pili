import { supabase } from '../../lib/supabase'
import { callRpc } from '../../lib/rpc'
import { subscribeCouple } from '../../lib/realtime'

// Lo que llegó del menú Compartir de otra app (por el Atajo), esperando en la bandeja.
export type SharedItem = {
  id: string
  url: string | null
  body: string | null
  query: string | null
  source: string | null
  sharedBy: string | null
  createdAt: string
}

// A donde el Atajo manda lo compartido (la guía de Ajustes la muestra para copiarla).
export const SHARE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share`

type Row = { id: string; url: string | null; body: string | null; query: string | null; source: string | null; shared_by: string | null; created_at: string }

export async function listShared(coupleId: string): Promise<SharedItem[]> {
  const { data, error } = await supabase
    .from('shared_items')
    .select('id, url, body, query, source, shared_by, created_at')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('network')
  return (data as Row[]).map((r) => ({
    id: r.id,
    url: r.url,
    body: r.body,
    query: r.query,
    source: r.source,
    sharedBy: r.shared_by,
    createdAt: r.created_at,
  }))
}

export async function dismissShared(id: string): Promise<void> {
  const { error } = await supabase.from('shared_items').delete().eq('id', id)
  if (error) throw new Error('network')
}

const toError = (kind: string) => new Error(kind)

export const createShareKey = () => callRpc<string, never>('create_share_key', undefined, [], toError)
export const shareKeyCreatedAt = () => callRpc<string | null, never>('share_key_created_at', undefined, [], toError)

// Ante cualquier cambio se recarga la bandeja.
export function subscribeShared(coupleId: string, onChange: () => void): () => void {
  return subscribeCouple('shared', coupleId, [['INSERT', 'shared_items'], ['DELETE', 'shared_items']], onChange)
}

const KINDS: Record<string, string> = { Instagram: 'Reel', TikTok: 'Video', YouTube: 'Video' }

// "Reel de Instagram", "Video de TikTok", "Post de letterboxd.com"; sin link, null.
export function sourceLabel(item: SharedItem): string | null {
  if (!item.url || !item.source) return null
  return `${KINDS[item.source] ?? 'Post'} de ${item.source}`
}

const NOTE_MAX = 200

// Lo que se carga en "¿De dónde vino?" al buscar desde la bandeja.
export function originNote(item: SharedItem): string {
  const label = sourceLabel(item)
  if (!label) return (item.body ?? '').slice(0, NOTE_MAX)
  const full = `${label} · ${item.url}`
  return full.length <= NOTE_MAX ? full : label
}

// "Agregar después" sin internet: al volver la conexión va a la bandeja con la sesión.
export const addSharedItem = (query: string, body: string) =>
  callRpc<void, string>('add_shared_item', { p_query: query, p_body: body }, ['invalid_item', 'inbox_full', 'no_couple'], toError)
