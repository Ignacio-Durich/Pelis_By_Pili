import { supabase } from '../../lib/supabase'

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

async function call<T>(name: string): Promise<T> {
  const { data, error } = await supabase.rpc(name)
  if (error) throw new Error('network')
  return data as T
}

export const createShareKey = () => call<string>('create_share_key')
export const shareKeyCreatedAt = () => call<string | null>('share_key_created_at')

// Igual que subscribeTitles: ante cualquier cambio se recarga la bandeja. Los DELETE van sin
// filtro porque Realtime no los filtra; con RLS solo traen el id.
export function subscribeShared(coupleId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`shared:${coupleId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_items', filter: `couple_id=eq.${coupleId}` }, () => onChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shared_items' }, () => onChange())
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') onChange()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
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
export async function addSharedItem(query: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_shared_item', { p_query: query, p_body: body })
  if (error) throw new Error(['invalid_item', 'inbox_full', 'no_couple'].includes(error.message) ? error.message : 'network')
}
