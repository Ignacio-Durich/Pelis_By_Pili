import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User
let coupleA: string
let titleId: string

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  await createCouple(C)
  const { data, error } = await A.client
    .from('titles')
    .insert({ couple_id: coupleA, tmdb_id: 496243, media_type: 'movie', title: 'Parásitos' })
    .select('id')
    .single()
  if (error) throw error
  titleId = data.id
})
afterAll(cleanup)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('members cannot write ratings', async () => {
  const { error } = await A.client.from('titles').update({ imdb_rating: '10/10' }).eq('id', titleId)
  expect(error).not.toBeNull()
  const { data } = await adminClient().from('titles').select('imdb_rating').eq('id', titleId).single()
  expect(data?.imdb_rating).toBeNull()
})

function listenUpdates(user: User, name: string) {
  const updates: RealtimePostgresChangesPayload<Row>[] = []
  const channel = user.client
    .channel(name)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'titles', filter: `couple_id=eq.${coupleA}` }, (p) =>
      updates.push(p),
    )
  const ready = new Promise<void>((resolve, reject) => {
    channel.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') resolve()
    })
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
    })
  })
  return { updates, ready, stop: () => user.client.removeChannel(channel) }
}

test('the partner receives rating updates in realtime and an outsider does not', async () => {
  const partner = listenUpdates(B, 'ratings-b')
  const outsider = listenUpdates(C, 'ratings-c')
  await Promise.all([partner.ready, outsider.ready])

  const { error } = await adminClient()
    .from('titles')
    .update({ imdb_rating: '8.5/10', ratings_updated_at: new Date().toISOString() })
    .eq('id', titleId)
  expect(error).toBeNull()

  const end = Date.now() + 10_000
  while (!partner.updates.length && Date.now() < end) await sleep(100)
  expect((partner.updates[0]?.new as Row | undefined)?.imdb_rating).toBe('8.5/10')
  await sleep(3000)
  expect(outsider.updates).toEqual([])
  await Promise.all([partner.stop(), outsider.stop()])
}, 30_000)

test('rating values are validated', async () => {
  const long = await adminClient().from('titles').update({ imdb_rating: 'x'.repeat(11) }).eq('id', titleId)
  expect(long.error?.code).toBe('23514')
  const tooHigh = await adminClient().from('titles').update({ tmdb_rating: 11 }).eq('id', titleId)
  expect(tooHigh.error?.code).toBe('23514')
})
