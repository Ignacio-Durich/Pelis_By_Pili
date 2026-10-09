// Edge Function (Deno): recibe lo que manda el Atajo de iOS y lo guarda en la bandeja de la
// pareja. No hay sesión: la persona se identifica con su clave personal (encabezado
// x-share-key, nunca en la URL, que queda en los registros). Se busca por su SHA-256.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { parseShare } from './lib.ts'


// Respuestas en texto: el Atajo muestra la respuesta tal cual en la notificación, así un error
// (clave vieja, bandeja llena) no pasa por "Guardado".
const reply = (status: number, message: string) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

const BAD_KEY = 'No se guardó: la clave no sirve. Creá una nueva en Ajustes y ponela en el Atajo.'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Solo POST')

  const key = req.headers.get('x-share-key')?.trim() ?? ''
  if (!key) return reply(401, BAD_KEY)
  const { data: owner } = await admin.from('share_keys').select('user_id, couple_id').eq('key_hash', await sha256(key)).maybeSingle()
  if (!owner) return reply(401, BAD_KEY)
  // Si dejó el espacio, su clave ya no sirve.
  const { count: member } = await admin
    .from('couple_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', owner.user_id)
    .eq('couple_id', owner.couple_id)
  if (!member) return reply(401, BAD_KEY)

  const item = parseShare(await req.json().catch(() => null))
  if (!item) return reply(400, 'No se guardó: no llegó ningún link ni texto.')

  // Tope de 100 (una clave filtrada no puede llenar la bandeja): lo controla un trigger de la base.
  const { error } = await admin.from('shared_items').insert({ ...item, couple_id: owner.couple_id, shared_by: owner.user_id })
  if (error?.message === 'inbox_full') return reply(429, 'No se guardó: la bandeja de Compartidos está llena. Descartá algunos en la app.')
  if (error) return reply(500, 'No se guardó. Probá de nuevo.')
  return reply(200, 'Guardado en Pelis By Pili')
})
