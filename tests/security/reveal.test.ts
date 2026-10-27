import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User
let coupleA: string
let ids: string[], watched: string, foreign: string

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let nextTmdb = 5000

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

async function closeOpen() {
  await adminClient().from('reveal_sessions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('couple_id', coupleA).eq('status', 'open')
}

async function start(u: User, pickCount?: number) {
  const { data, error } = await u.client.rpc('start_reveal', pickCount ? { p_pick_count: pickCount } : {})
  if (error) throw error
  return data as string
}

const submit = (u: User, session: string, titleIds: string[]) => u.client.rpc('submit_reveal', { p_session_id: session, p_title_ids: titleIds })

async function picksSeenBy(u: User, session: string) {
  const { data } = await u.client.from('reveal_picks').select('user_id, title_ids').eq('session_id', session)
  return Object.fromEntries((data ?? []).map((r) => [r.user_id === A.id ? 'A' : r.user_id === B.id ? 'B' : 'otro', (r.title_ids as string[]).toSorted()]))
}

async function sessionRow(id: string) {
  const { data } = await adminClient().from('reveal_sessions').select('ready, revealed_at, status, result_title_id').eq('id', id).single()
  return data!
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  const coupleC = await createCouple(C)
  ids = await addTitles(coupleA, 11)
  ;[watched] = await addTitles(coupleA, 1, 'watched')
  ;[foreign] = await addTitles(coupleC, 1)
})
afterAll(cleanup)

test('one open game per couple, even when both start at once', async () => {
  await closeOpen()
  const first = await start(A)
  expect(await start(B)).toBe(first)
  await closeOpen()
  const [x, y] = await Promise.all([start(A), start(B)])
  expect(x).toBe(y)
})

test('a couple of one or no couple cannot start', async () => {
  const solo = await createTestUser()
  await createCouple(solo)
  expect((await solo.client.rpc('start_reveal')).error?.message).toBe('no_partner')
  const lonely = await createTestUser()
  expect((await lonely.client.rpc('start_reveal')).error?.message).toBe('no_couple')
})

test('nobody sees the other choice until both chose, then both see both', async () => {
  await closeOpen()
  const id = await start(A)
  expect((await submit(A, id, [ids[0], ids[1], ids[2]])).error).toBeNull()
  expect(await picksSeenBy(B, id)).toEqual({})
  expect(await picksSeenBy(A, id)).toEqual({ A: [ids[0], ids[1], ids[2]].toSorted() })
  expect(await picksSeenBy(C, id)).toEqual({})
  const waiting = await sessionRow(id)
  expect(waiting.ready).toEqual([A.id])
  expect(waiting.revealed_at).toBeNull()

  // Se puede cambiar mientras el otro no eligió.
  expect((await submit(A, id, [ids[0], ids[3], ids[4]])).error).toBeNull()
  expect(await picksSeenBy(A, id)).toEqual({ A: [ids[0], ids[3], ids[4]].toSorted() })
  expect((await sessionRow(id)).ready).toEqual([A.id])

  expect((await submit(B, id, [ids[0], ids[1], ids[5]])).error).toBeNull()
  expect((await sessionRow(id)).revealed_at).not.toBeNull()
  const both = { A: [ids[0], ids[3], ids[4]].toSorted(), B: [ids[0], ids[1], ids[5]].toSorted() }
  expect(await picksSeenBy(A, id)).toEqual(both)
  expect(await picksSeenBy(B, id)).toEqual(both)
  expect(await picksSeenBy(C, id)).toEqual({})

  // Después de revelar ya no se cambia.
  expect((await submit(A, id, [ids[1]])).error?.message).toBe('closed')
  expect(await picksSeenBy(A, id)).toEqual(both)
})

test('both choosing at once reveals once with both choices', async () => {
  await closeOpen()
  const id = await start(A)
  const [x, y] = await Promise.all([submit(A, id, [ids[0]]), submit(B, id, [ids[1]])])
  expect(x.error).toBeNull()
  expect(y.error).toBeNull()
  expect((await sessionRow(id)).revealed_at).not.toBeNull()
  expect(await picksSeenBy(A, id)).toEqual({ A: [ids[0]], B: [ids[1]] })
})

test('the choice must be 1 to 3 titles of the couple still to watch', async () => {
  await closeOpen()
  const id = await start(A)
  for (const bad of [[], ids.slice(0, 4), [ids[0], watched], [ids[0], foreign]]) {
    expect((await submit(A, id, bad)).error?.message).toBe('invalid_picks')
  }
  expect((await submit(A, id, [ids[0], ids[0]])).error).toBeNull()
  expect(await picksSeenBy(A, id)).toEqual({ A: [ids[0]] })
  expect((await submit(C, id, [ids[0]])).error?.message).toBe('not_found')
})

test('a game can be of 5 or 10 picks, set by who starts it, and nothing else', async () => {
  await closeOpen()
  const id = await start(A, 5)
  expect(await start(B, 10)).toBe(id)
  const { data } = await adminClient().from('reveal_sessions').select('pick_count').eq('id', id).single()
  expect(data!.pick_count).toBe(5)
  expect((await submit(A, id, ids.slice(0, 6))).error?.message).toBe('invalid_picks')
  expect((await submit(A, id, ids.slice(0, 5))).error).toBeNull()
  await closeOpen()
  const ten = await start(A, 10)
  expect((await submit(A, ten, ids.slice(0, 11))).error?.message).toBe('invalid_picks')
  expect((await submit(A, ten, ids.slice(0, 10))).error).toBeNull()
  await closeOpen()
  for (const bad of [4, 0, 11]) {
    expect((await A.client.rpc('start_reveal', { p_pick_count: bad })).error?.message).toBe('invalid_picks')
  }
})

test('finishing saves a chosen title once and lets them start again', async () => {
  await closeOpen()
  const id = await start(A)
  await submit(A, id, [ids[0], ids[1]])
  await submit(B, id, [ids[1], ids[2]])
  expect((await A.client.rpc('finish_reveal', { p_session_id: id, p_result_title_id: ids[5] })).error?.message).toBe('not_in_picks')
  expect((await A.client.rpc('finish_reveal', { p_session_id: id, p_result_title_id: ids[1] })).error).toBeNull()
  expect((await B.client.rpc('finish_reveal', { p_session_id: id, p_result_title_id: null })).error).toBeNull()
  const row = await sessionRow(id)
  expect([row.status, row.result_title_id]).toEqual(['done', ids[1]])
  expect(await start(B)).not.toBe(id)
})

test('nobody writes the tables directly', async () => {
  await closeOpen()
  const id = await start(A)
  expect((await A.client.from('reveal_sessions').update({ revealed_at: new Date().toISOString() }).eq('id', id).select()).error).not.toBeNull()
  expect((await A.client.from('reveal_picks').insert({ session_id: id, couple_id: coupleA, user_id: A.id, title_ids: [ids[0]] })).error).not.toBeNull()
  expect((await sessionRow(id)).revealed_at).toBeNull()
})

function listen(u: User, name: string, table: string) {
  const events: RealtimePostgresChangesPayload<Row>[] = []
  const channel = u.client.channel(name)
  for (const event of ['INSERT', 'UPDATE'] as const) {
    channel.on('postgres_changes', { event, schema: 'public', table, filter: `couple_id=eq.${coupleA}` }, (p) => events.push(p))
  }
  const ready = new Promise<void>((resolve, reject) => {
    channel.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') resolve()
    })
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
    })
  })
  return { events, ready, stop: () => u.client.removeChannel(channel) }
}

test('the partner hears that someone chose, never what', async () => {
  await closeOpen()
  const id = await start(A)
  const sessions = listen(B, 'reveal-sessions-b', 'reveal_sessions')
  const picks = listen(B, 'reveal-picks-b', 'reveal_picks')
  const outsider = listen(C, 'reveal-sessions-c', 'reveal_sessions')
  // reveal_picks no está en Realtime (a propósito): el servidor nunca confirma esa escucha, así
  // que no se la espera; si alguien la sumara a Realtime, acá llegarían eventos.
  picks.ready.catch(() => {})
  await Promise.all([sessions.ready, outsider.ready])
  await submit(A, id, [ids[2]])
  const got = () => sessions.events.some((e) => (e.new as Row).id === id && ((e.new as Row).ready as string[]).includes(A.id))
  const end = Date.now() + 10_000
  while (!got() && Date.now() < end) await sleep(100)
  expect(got()).toBe(true)
  await sleep(3000)
  expect(picks.events).toEqual([])
  expect(outsider.events).toEqual([])
  await Promise.all([sessions.stop(), picks.stop(), outsider.stop()])
}, 30_000)

test('before the reveal nobody can end the game with a winner (it would tell what the other chose)', async () => {
  await closeOpen()
  const id = await start(A)
  await submit(A, id, [ids[1]])
  for (const guess of [ids[0], ids[1]]) {
    expect((await B.client.rpc('finish_reveal', { p_session_id: id, p_result_title_id: guess })).error?.message).toBe('not_revealed')
  }
  expect((await sessionRow(id)).status).toBe('open')
  expect((await B.client.rpc('finish_reveal', { p_session_id: id, p_result_title_id: null })).error).toBeNull()
  expect((await sessionRow(id)).status).toBe('cancelled')
})
