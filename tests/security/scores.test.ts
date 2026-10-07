import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User
let coupleA: string
let T: string

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function addTitle(tmdb_id: number) {
  const { data, error } = await A.client
    .from('titles')
    .insert({ couple_id: coupleA, tmdb_id, media_type: 'movie', title: `Peli ${tmdb_id}` })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function titleRow(id: string) {
  const { data } = await adminClient().from('titles').select('status, watched_at').eq('id', id).maybeSingle()
  return data
}

async function scoresOf(user: User, titleId: string) {
  const { data } = await user.client.from('title_scores').select('user_id, score, note').eq('title_id', titleId)
  return data ?? []
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  await createCouple(C)
  T = await addTitle(496243)
})
afterAll(cleanup)

test('marking as watched is shared and can be undone', async () => {
  expect((await A.client.rpc('set_watched', { p_title_id: T, p_watched: true })).error).toBeNull()
  const { data } = await B.client.from('titles').select('status, watched_at').eq('id', T).single()
  expect(data?.status).toBe('watched')
  expect(data?.watched_at).not.toBeNull()

  await A.client.rpc('set_watched', { p_title_id: T, p_watched: true })
  expect((await titleRow(T))?.watched_at).toBe(data?.watched_at)

  await B.client.rpc('set_watched', { p_title_id: T, p_watched: false })
  expect(await titleRow(T)).toEqual({ status: 'to_watch', watched_at: null })
})

test('outsiders cannot mark or read', async () => {
  const { error } = await C.client.rpc('set_watched', { p_title_id: T, p_watched: true })
  expect(error?.message).toBe('not_found')
  expect((await titleRow(T))?.status).toBe('to_watch')
})

test('scoring needs the title to be watched', async () => {
  const { error } = await A.client.rpc('set_my_score', { p_title_id: T, p_score: 8, p_note: null })
  expect(error?.message).toBe('not_watched')
})

test('each one scores separately and sees the other', async () => {
  await A.client.rpc('set_watched', { p_title_id: T, p_watched: true })
  expect((await A.client.rpc('set_my_score', { p_title_id: T, p_score: 8.75, p_note: '  Buenísima ' })).error).toBeNull()
  expect((await B.client.rpc('set_my_score', { p_title_id: T, p_score: 6, p_note: '' })).error).toBeNull()
  for (const reader of [A, B]) {
    const rows = await scoresOf(reader, T)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.user_id === A.id)).toMatchObject({ note: 'Buenísima' })
    expect(Number(rows.find((r) => r.user_id === A.id)?.score)).toBe(8.75)
    expect(rows.find((r) => r.user_id === B.id)?.note).toBeNull()
  }
  await A.client.rpc('set_my_score', { p_title_id: T, p_score: 9, p_note: null })
  const rows = await scoresOf(B, T)
  expect(rows.filter((r) => r.user_id === A.id).map((r) => Number(r.score))).toEqual([9])
  expect(Number(rows.find((r) => r.user_id === B.id)?.score)).toBe(6)
})

test('outsiders cannot read or write scores', async () => {
  expect(await scoresOf(C, T)).toEqual([])
  const { error } = await C.client.rpc('set_my_score', { p_title_id: T, p_score: 5, p_note: null })
  expect(error?.message).toBe('not_found')
})

test('no direct writes', async () => {
  expect((await A.client.from('titles').update({ status: 'to_watch' }).eq('id', T)).error).not.toBeNull()
  const insert = await A.client.from('title_scores').insert({ title_id: T, couple_id: coupleA, user_id: A.id, score: 5 })
  expect(insert.error).not.toBeNull()
  expect((await A.client.from('title_scores').update({ score: 1 }).eq('title_id', T)).error).not.toBeNull()
  expect((await A.client.from('title_scores').delete().eq('title_id', T)).error).not.toBeNull()
  expect(await scoresOf(A, T)).toHaveLength(2)
})

test('invalid scores and notes are rejected', async () => {
  for (const p_score of [0.99, 10.01, 8.755]) {
    const { error } = await A.client.rpc('set_my_score', { p_title_id: T, p_score, p_note: null })
    expect(error?.message).toBe('invalid_score')
  }
  for (const p_score of [1, 10]) {
    expect((await A.client.rpc('set_my_score', { p_title_id: T, p_score, p_note: null })).error).toBeNull()
  }
  const { error } = await A.client.rpc('set_my_score', { p_title_id: T, p_score: 7, p_note: 'x'.repeat(201) })
  expect(error?.message).toBe('invalid_note')
})

test('scores survive undoing watched and disappear with the title', async () => {
  await A.client.rpc('set_watched', { p_title_id: T, p_watched: false })
  expect(await scoresOf(A, T)).toHaveLength(2)
  await A.client.rpc('set_watched', { p_title_id: T, p_watched: true })

  const other = await addTitle(70523)
  await A.client.rpc('set_watched', { p_title_id: other, p_watched: true })
  await A.client.rpc('set_my_score', { p_title_id: other, p_score: 7, p_note: null })
  await A.client.from('titles').delete().eq('id', other)
  const { data } = await adminClient().from('title_scores').select('title_id').eq('title_id', other)
  expect(data).toEqual([])
})

function listenScores(user: User, name: string) {
  const events: RealtimePostgresChangesPayload<Row>[] = []
  const channel = user.client.channel(name)
  for (const event of ['INSERT', 'UPDATE'] as const) {
    channel.on('postgres_changes', { event, schema: 'public', table: 'title_scores', filter: `couple_id=eq.${coupleA}` }, (p) => events.push(p))
  }
  const ready = new Promise<void>((resolve, reject) => {
    channel.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') resolve()
    })
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
    })
  })
  return { events, ready, stop: () => user.client.removeChannel(channel) }
}

test('the partner receives score changes in realtime and an outsider does not', async () => {
  const partner = listenScores(B, 'scores-b')
  const outsider = listenScores(C, 'scores-c')
  await Promise.all([partner.ready, outsider.ready])
  await A.client.rpc('set_my_score', { p_title_id: T, p_score: 4.5, p_note: null })
  const end = Date.now() + 10_000
  while (!partner.events.length && Date.now() < end) await sleep(100)
  expect(Number((partner.events[0]?.new as Row | undefined)?.score)).toBe(4.5)
  await sleep(3000)
  expect(outsider.events).toEqual([])
  await Promise.all([partner.stop(), outsider.stop()])
}, 30_000)

test('a title removed while scoring gives not_found', async () => {
  const gone = await addTitle(2316)
  await A.client.rpc('set_watched', { p_title_id: gone, p_watched: true })
  await A.client.from('titles').delete().eq('id', gone)
  const { error } = await B.client.rpc('set_my_score', { p_title_id: gone, p_score: 7, p_note: null })
  expect(error?.message).toBe('not_found')
})

test('anonymous clients cannot call the functions', async () => {
  const anon = anonClient()
  expect((await anon.rpc('set_watched', { p_title_id: T, p_watched: true })).error).not.toBeNull()
  expect((await anon.rpc('set_my_score', { p_title_id: T, p_score: 5, p_note: null })).error).not.toBeNull()
})
