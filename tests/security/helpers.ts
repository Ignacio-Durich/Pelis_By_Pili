import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '../../scripts/lib/env.ts'

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

function env() {
  return requireEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
}

export function adminClient(): SupabaseClient {
  const e = env()
  return createClient(e.VITE_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, noSession)
}

export function anonClient(): SupabaseClient {
  const e = env()
  return createClient(e.VITE_SUPABASE_URL, e.VITE_SUPABASE_ANON_KEY, noSession)
}

const createdUserIds: string[] = []

export async function createTestUser(): Promise<{ id: string; client: SupabaseClient }> {
  const email = `test-${crypto.randomUUID()}@pelis.test`
  const password = crypto.randomUUID()
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  createdUserIds.push(data.user.id)

  const client = anonClient()
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, client }
}

export async function cleanup(): Promise<void> {
  const admin = adminClient()
  const { data: members } = await admin.from('couple_members').select('couple_id').in('user_id', createdUserIds)
  const coupleIds = [...new Set((members ?? []).map((m) => m.couple_id as string))]
  // Borrar el espacio arrastra (cascade) sus miembros e invitaciones.
  if (coupleIds.length > 0) await admin.from('couples').delete().in('id', coupleIds)
  for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id)
}
