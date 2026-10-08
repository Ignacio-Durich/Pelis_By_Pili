// Edge Function (Deno): recibe lo que manda el Atajo de iOS y lo guarda en la bandeja de la
// pareja. No hay sesión: la persona se identifica con su clave personal (encabezado
// x-share-key, nunca en la URL, que queda en los registros). Se busca por su SHA-256.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseShare } from './lib.ts'

const MAX_ITEMS = 100

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const key = req.headers.get('x-share-key')?.trim() ?? ''
  if (!key) return json(401, { error: 'unauthorized' })
  const { data: owner } = await admin.from('share_keys').select('user_id, couple_id').eq('key_hash', await sha256(key)).maybeSingle()
  if (!owner) return json(401, { error: 'unauthorized' })
  // Si dejó el espacio, su clave ya no sirve.
  const { count: member } = await admin
    .from('couple_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', owner.user_id)
    .eq('couple_id', owner.couple_id)
  if (!member) return json(401, { error: 'unauthorized' })

  const item = parseShare(await req.json().catch(() => null))
  if (!item) return json(400, { error: 'empty' })

  // Tope: una clave filtrada no puede llenar la bandeja.
  const { count } = await admin.from('shared_items').select('id', { count: 'exact', head: true }).eq('couple_id', owner.couple_id)
  if ((count ?? 0) >= MAX_ITEMS) return json(429, { error: 'inbox_full' })

  const { error } = await admin.from('shared_items').insert({ ...item, couple_id: owner.couple_id, shared_by: owner.user_id })
  if (error) return json(500, { error: 'not_saved' })
  return json(200, { ok: true })
})
