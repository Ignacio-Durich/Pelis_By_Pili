import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User, D: User
let coupleA: string, coupleC: string
// Títulos de A en "Por ver" (ids), uno visto y uno de C.
let deck: string[], watched: string, foreign: string

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let nextTmdb = 1000

async function addTitles(coupleId: string, count: number, status: 'to_watch' | 'watched' = 'to_watch') {
  const rows = Array.from({ length: count }, () => ({
    couple_id: coupleId,
    tmdb_id: nextTmdb++,
    media_type: 'movie',
    title: `Peli ${nextTmdb}`,
    status,
    watched_at: status === 'watched' ? new Date().toISOString() : null,
  }))
  const { data, error } = await adminClient().from('titles').insert(rows).select('id')
  if (error) throw error
  return data.map((r) => r.id as string)
}

async function session(id: string) {
  const { data } = await adminClient().from('bumble_sessions').select('status, result_title_id').eq('id', id).single()
  return data
}

async function votesOf(sessionId: string) {
  const { data } = await adminClient().from('bumble_votes').select('user_id, title_id, round, liked').eq('session_id', sessionId)
  return data ?? []
}

// Cierra la partida abierta de A (si hay) para que cada test arranque limpio.
async function closeOpen() {
  await adminClient().from('bumble_sessions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('couple_id', coupleA).eq('status', 'open')
}

async function start(user: User, ids: string[]) {
  const { data, error } = await user.client.rpc('start_bumble', { p_title_ids: ids })
  if (error) throw error
  return data as string
}

beforeAll(async () => {
  ;[A, B, C, D] = await Promise.all([createTestUser(), createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  coupleC = await createCouple(C, D)
  deck = await addTitles(coupleA, 31)
  ;[watched] = await addTitles(coupleA, 1, 'watched')
  ;[foreign] = await addTitles(coupleC, 1)
})
afterAll(cleanup)

test('starting gives one open game per couple, even when both start at once', async () => {
  await closeOpen()
  const first = await start(A, deck.slice(0, 3))
  expect(await start(B, deck.slice(3, 6))).toBe(first)
  await closeOpen()
  const [x, y] = await Promise.all([start(A, deck.slice(0, 3)), start(B, deck.slice(0, 4))])
  expect(x).toBe(y)
  const { data } = await adminClient().from('bumble_sessions').select('deck').eq('id', x).single()
  expect([3, 4]).toContain((data?.deck as string[]).length)
})

test('the deck must have 2 to 30 of the couple titles still to watch', async () => {
  await closeOpen()
  for (const ids of [deck.slice(0, 1), deck.slice(0, 31), [deck[0], watched], [deck[0], foreign], [deck[0], deck[0]]]) {
    const { error } = await A.client.rpc('start_bumble', { p_title_ids: ids })
    expect(error?.message).toBe('invalid_deck')
  }
  const id = await start(A, deck.slice(0, 30))
  const { data } = await adminClient().from('bumble_sessions').select('deck').eq('id', id).single()
  expect(data?.deck).toEqual(deck.slice(0, 30))
})

test('repeated titles are dropped keeping the order', async () => {
  await closeOpen()
  const id = await start(A, [deck[2], deck[0], deck[2], deck[1]])
  const { data } = await adminClient().from('bumble_sessions').select('deck').eq('id', id).single()
  expect(data?.deck).toEqual([deck[2], deck[0], deck[1]])
})

test('a couple of one cannot start a game for two phones', async () => {
  const solo = await createTestUser()
  await createCouple(solo)
  const { error } = await solo.client.rpc('start_bumble', { p_title_ids: deck.slice(0, 2) })
  expect(error?.message).toBe('no_partner')
  const lonely = await createTestUser()
  expect((await lonely.client.rpc('start_bumble', { p_title_ids: deck.slice(0, 2) })).error?.message).toBe('no_couple')
})

test('voting saves once, checks round, deck and couple, and closes with the game', async () => {
  await closeOpen()
  const id = await start(A, deck.slice(0, 3))
  const vote = (u: User, title: string, round = 1, liked = true) =>
    u.client.rpc('bumble_vote', { p_session_id: id, p_round: round, p_title_id: title, p_liked: liked })
  expect((await vote(A, deck[0])).error).toBeNull()
  expect((await vote(A, deck[0])).error).toBeNull()
  expect(await votesOf(id)).toEqual([{ user_id: A.id, title_id: deck[0], round: 1, liked: true }])
  expect((await vote(A, deck[1], 4)).error?.message).toBe('not_in_deck')
  expect((await vote(A, deck[1], 0)).error?.message).toBe('not_in_deck')
  expect((await vote(A, deck[5])).error?.message).toBe('not_in_deck')
  expect((await vote(C, deck[0])).error?.message).toBe('not_found')
  expect((await A.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: null })).error).toBeNull()
  expect((await vote(B, deck[1])).error?.message).toBe('closed')
})

test('undo removes only the caller last votes', async () => {
  await closeOpen()
  const id = await start(A, deck.slice(0, 3))
  const vote = (u: User, title: string, liked = true) =>
    u.client.rpc('bumble_vote', { p_session_id: id, p_round: 1, p_title_id: title, p_liked: liked })
  const undo = (u: User) => u.client.rpc('bumble_undo', { p_session_id: id })
  expect((await undo(A)).error).toBeNull()
  await vote(A, deck[0])
  await vote(A, deck[1], false)
  await vote(B, deck[0])
  await vote(A, deck[2])
  expect((await undo(A)).error).toBeNull()
  expect((await undo(A)).error).toBeNull()
  const left = (await votesOf(id)).map((v) => `${v.user_id === A.id ? 'A' : 'B'}:${v.title_id}`).sort()
  expect(left).toEqual([`A:${deck[0]}`, `B:${deck[0]}`].sort())
  expect((await undo(C)).error?.message).toBe('not_found')
  await A.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: null })
  expect((await undo(A)).error?.message).toBe('closed')
})

test('finishing saves the result once and lets them start again', async () => {
  await closeOpen()
  const id = await start(A, deck.slice(0, 3))
  expect((await A.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: deck[5] })).error?.message).toBe('not_in_deck')
  expect((await C.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: null })).error?.message).toBe('not_found')
  expect((await A.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: deck[1] })).error).toBeNull()
  expect((await B.client.rpc('finish_bumble', { p_session_id: id, p_result_title_id: deck[2] })).error).toBeNull()
  expect(await session(id)).toEqual({ status: 'done', result_title_id: deck[1] })
  const next = await start(B, deck.slice(0, 2))
  expect(next).not.toBe(id)
  await B.client.rpc('finish_bumble', { p_session_id: next, p_result_title_id: null })
  expect(await session(next)).toEqual({ status: 'cancelled', result_title_id: null })
})

test('outsiders read nothing and nobody writes the tables directly', async () => {
  await closeOpen()
  const id = await start(A, deck.slice(0, 2))
  await A.client.rpc('bumble_vote', { p_session_id: id, p_round: 1, p_title_id: deck[0], p_liked: true })
  expect((await C.client.from('bumble_sessions').select('id').eq('couple_id', coupleA)).data).toEqual([])
  expect((await C.client.from('bumble_votes').select('id').eq('session_id', id)).data).toEqual([])
  expect((await B.client.from('bumble_votes').select('id').eq('session_id', id)).data).toHaveLength(1)

  const sessionRow = { couple_id: coupleA, deck: deck.slice(0, 2) }
  expect((await A.client.from('bumble_sessions').insert(sessionRow)).error).not.toBeNull()
  expect((await A.client.from('bumble_sessions').update({ status: 'done' }).eq('id', id).select()).error).not.toBeNull()
  expect((await A.client.from('bumble_sessions').delete().eq('id', id).select()).error).not.toBeNull()
  const voteRow = { session_id: id, couple_id: coupleA, user_id: A.id, round: 1, title_id: deck[1], liked: true }
  expect((await A.client.from('bumble_votes').insert(voteRow)).error).not.toBeNull()
  expect((await A.client.from('bumble_votes').delete().eq('session_id', id).select()).error).not.toBeNull()
  expect(await votesOf(id)).toHaveLength(1)
  expect((await C.client.from('bumble_sessions').select('id').eq('couple_id', coupleC)).data).toEqual([])
})

test('anonymous clients cannot call the functions', async () => {
  const anon = anonClient()
  expect((await anon.rpc('start_bumble', { p_title_ids: deck.slice(0, 2) })).error).not.toBeNull()
  expect((await anon.rpc('bumble_undo', { p_session_id: deck[0] })).error).not.toBeNull()
})

function listen(user: User, name: string, filtered: boolean) {
  const events: RealtimePostgresChangesPayload<Row>[] = []
  const filter = `couple_id=eq.${coupleA}`
  const channel = user.client
    .channel(name)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bumble_votes', ...(filtered ? { filter } : {}) }, (p) => events.push(p))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bumble_votes' }, (p) => events.push(p))
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

test('the partner sees votes and undos in realtime and an outsider learns nothing', async () => {
  await closeOpen()
  const id = await start(A, deck.slice(0, 2))
  const partner = listen(B, 'bumble-b', true)
  const outsider = listen(C, 'bumble-c', true)
  await Promise.all([partner.ready, outsider.ready])
  const got = (type: string) => partner.events.some((e) => e.eventType === type)
  const waitFor = async (type: string) => {
    const end = Date.now() + 10_000
    while (!got(type) && Date.now() < end) await sleep(100)
    expect(got(type)).toBe(true)
  }
  await A.client.rpc('bumble_vote', { p_session_id: id, p_round: 1, p_title_id: deck[1], p_liked: true })
  // Realtime revisa los permisos contra la fila: si se deshace antes de que lo procese, el INSERT no viaja.
  await waitFor('INSERT')
  await A.client.rpc('bumble_undo', { p_session_id: id })
  await waitFor('DELETE')
  await sleep(3000)
  expect(outsider.events.filter((e) => e.eventType === 'INSERT')).toEqual([])
  for (const e of outsider.events) {
    const old = e.old as Row
    expect(old.user_id).toBeUndefined()
    expect(old.couple_id).toBeUndefined()
    expect(old.title_id).toBeUndefined()
  }
  await Promise.all([partner.stop(), outsider.stop()])
}, 30_000)
