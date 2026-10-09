import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User
let coupleA: string

const parasite = { tmdb_id: 496243, media_type: 'movie', title: 'Parásitos', original_title: '기생충', year: 2019, poster_path: '/abc.jpg' }

async function insertTitle(user: User, values: Row) {
  return user.client.from('titles').insert({ couple_id: coupleA, ...values })
}

async function rowById(id: string) {
  const { data } = await adminClient().from('titles').select('*').eq('id', id).maybeSingle()
  return data
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  await createCouple(C)
})
afterAll(cleanup)

test('a member adds a title and the partner reads it', async () => {
  const { error } = await insertTitle(A, parasite)
  expect(error).toBeNull()
  const { data } = await B.client.from('titles').select('*')
  expect(data).toHaveLength(1)
  expect(data?.[0]).toMatchObject({ ...parasite, couple_id: coupleA, added_by: A.id, origin_note: null })
})

test('the same title twice fails with 23505', async () => {
  const { error } = await insertTitle(B, parasite)
  expect(error?.code).toBe('23505')
  const { data } = await adminClient().from('titles').select('id').eq('couple_id', coupleA).eq('tmdb_id', 496243)
  expect(data).toHaveLength(1)
})

test('added_by cannot be forged', async () => {
  const { error } = await insertTitle(B, { tmdb_id: 1396, media_type: 'tv', title: 'Breaking Bad', added_by: A.id })
  expect(error).not.toBeNull()
})

test('outsiders cannot read, add or remove', async () => {
  const { data: seen } = await C.client.from('titles').select('*')
  expect(seen?.filter((r) => r.couple_id === coupleA)).toEqual([])

  const insert = await C.client.from('titles').insert({ couple_id: coupleA, tmdb_id: 1, media_type: 'movie', title: 'X' })
  expect(insert.error).not.toBeNull()

  const { data: target } = await adminClient().from('titles').select('id').eq('couple_id', coupleA).single()
  await C.client.from('titles').delete().eq('id', target!.id)
  expect(await rowById(target!.id)).not.toBeNull()
})

test('either member removes a title of the couple', async () => {
  const { data: added } = await A.client.from('titles').insert({ couple_id: coupleA, tmdb_id: 2316, media_type: 'tv', title: 'The Office' }).select('id').single()
  const { error } = await B.client.from('titles').delete().eq('id', added!.id)
  expect(error).toBeNull()
  expect(await rowById(added!.id)).toBeNull()
})

test('no updates', async () => {
  const { data: target } = await adminClient().from('titles').select('id, title').eq('couple_id', coupleA).eq('tmdb_id', 496243).single()
  const { error } = await A.client.from('titles').update({ title: 'Cambiado' }).eq('id', target!.id)
  expect(error).not.toBeNull()
  expect((await rowById(target!.id))?.title).toBe('Parásitos')
})

test('invalid values are rejected', async () => {
  const badPoster = await insertTitle(A, { tmdb_id: 10, media_type: 'movie', title: 'X', poster_path: 'https://malo.example/x.jpg' })
  expect(badPoster.error?.code).toBe('23514')
  const longNote = await insertTitle(A, { tmdb_id: 11, media_type: 'movie', title: 'X', origin_note: 'x'.repeat(201) })
  expect(longNote.error?.code).toBe('23514')
})

function listen(user: User, name: string) {
  const inserts: RealtimePostgresChangesPayload<Row>[] = []
  const deletes: RealtimePostgresChangesPayload<Row>[] = []
  const channel = user.client
    .channel(name)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'titles', filter: `couple_id=eq.${coupleA}` }, (p) => inserts.push(p))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'titles' }, (p) => deletes.push(p))
  // Listo cuando el servidor ya escucha la base, igual que la app (subscribeTitles), no al unirse al canal.
  const ready = new Promise<void>((resolve, reject) => {
    channel.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') resolve()
    })
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
    })
  })
  return { inserts, deletes, ready, stop: () => user.client.removeChannel(channel) }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitUntil(check: () => boolean, ms: number) {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await sleep(100)
  return check()
}

test('the partner receives changes in realtime and an outsider gets no data', async () => {
  const partner = listen(B, 'titles-b')
  const outsider = listen(C, 'titles-c')
  await Promise.all([partner.ready, outsider.ready])

  const { data: added } = await A.client.from('titles').insert({ couple_id: coupleA, tmdb_id: 70523, media_type: 'tv', title: 'Dark' }).select('id').single()
  expect(await waitUntil(() => partner.inserts.some((p) => (p.new as Row).tmdb_id === 70523), 10_000)).toBe(true)
  await sleep(3000)
  expect(outsider.inserts).toEqual([])

  await A.client.from('titles').delete().eq('id', added!.id)
  expect(await waitUntil(() => partner.deletes.some((p) => (p.old as Row).id === added!.id), 10_000)).toBe(true)
  for (const p of outsider.deletes) expect(Object.keys(p.old as Row)).toEqual(['id'])

  await Promise.all([partner.stop(), outsider.stop()])
}, 30_000)

test('anonymous clients cannot read titles', async () => {
  const { data } = await anonClient().from('titles').select('*')
  expect(data ?? []).toEqual([])
})

test('a member cannot insert a title already watched, with a date or made-up ratings', async () => {
  for (const extra of [{ status: 'watched' }, { watched_at: '2020-01-01T00:00:00Z' }, { imdb_rating: '9.9/10' }]) {
    const { error } = await insertTitle(A, { ...parasite, tmdb_id: 900001, ...extra })
    expect(error?.code, JSON.stringify(extra)).toBe('42501')
  }
  const { error } = await insertTitle(A, { ...parasite, tmdb_id: 900002, origin_note: 'un reel' })
  expect(error).toBeNull()
})
