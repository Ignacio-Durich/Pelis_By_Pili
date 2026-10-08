import { supabase } from './supabase'

export type Change = ['INSERT' | 'UPDATE' | 'DELETE', string]

// Escucha cambios de la pareja en las tablas dadas y avisa con `onChange` (cada pantalla recarga
// todo: con dos personas es poca data). INSERT y UPDATE van filtrados por pareja; los DELETE van sin
// filtro porque Realtime no los filtra (con RLS solo traen el id). También avisa cuando el servidor
// ya escucha la base ("Subscribed to PostgreSQL"), que llega un poco después de SUBSCRIBED: un
// cambio en ese hueco se perdería si se recargara antes.
export function subscribeCouple(name: string, coupleId: string, changes: Change[], onChange: () => void): () => void {
  const filter = `couple_id=eq.${coupleId}`
  let channel = supabase.channel(`${name}:${coupleId}:${crypto.randomUUID()}`)
  for (const [event, table] of changes) {
    channel = channel.on('postgres_changes', event === 'DELETE' ? { event, schema: 'public', table } : { event, schema: 'public', table, filter }, () => onChange())
  }
  channel
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') onChange()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
