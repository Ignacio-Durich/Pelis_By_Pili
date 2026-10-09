import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { requireEnv } from '../../scripts/lib/env.ts'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
type Row = Record<string, unknown>
let A: User, B: User, C: User
let coupleA: string, coupleC: string

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

async function addItem(coupleId: string, sharedBy: string, query = 'Dark') {
  const { data, error } = await adminClient()
    .from('shared_items')
    .insert({ couple_id: coupleId, shared_by: sharedBy, url: 'https://www.instagram.com/reel/abc/', source: 'Instagram', query })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function keyRow(userId: string) {
  const { data } = await adminClient().from('share_keys').select('key_hash, couple_id').eq('user_id', userId).maybeSingle()
  return data
}

async function exists(id: string) {
  const { data } = await adminClient().from('shared_items').select('id').eq('id', id)
  return (data ?? []).length === 1
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  coupleA = await createCouple(A, B)
  coupleC = await createCouple(C)
})
afterAll(cleanup)

test('a share key is shown once and only its hash is stored; a new one replaces it', async () => {
  expect((await A.client.rpc('share_key_created_at')).data).toBeNull()
  const first = (await A.client.rpc('create_share_key')).data as string
  expect(first).toMatch(/^[0-9a-f]{48}$/)
  expect(await keyRow(A.id)).toEqual({ key_hash: sha256(first), couple_id: coupleA })
  expect((await A.client.rpc('share_key_created_at')).data).not.toBeNull()
  const second = (await A.client.rpc('create_share_key')).data as string
  expect(second).not.toBe(first)
  expect((await keyRow(A.id))?.key_hash).toBe(sha256(second))
})

test('without a couple there is no key', async () => {
  const lonely = await createTestUser()
  expect((await lonely.client.rpc('create_share_key')).error?.message).toBe('no_couple')
})

test('nobody reads or writes share keys from the app', async () => {
  await B.client.rpc('create_share_key')
  expect((await B.client.from('share_keys').select('key_hash')).error).not.toBeNull()
  const row = { user_id: B.id, couple_id: coupleA, key_hash: 'x' }
  expect((await B.client.from('share_keys').insert(row)).error).not.toBeNull()
  expect((await B.client.from('share_keys').delete().eq('user_id', B.id).select()).error).not.toBeNull()
  expect(await keyRow(B.id)).not.toBeNull()
})

test('the couple reads and dismisses its inbox; outsiders cannot', async () => {
  const mine = await addItem(coupleA, A.id)
  const theirs = await addItem(coupleC, C.id)
  const seen = (await B.client.from('shared_items').select('id')).data?.map((r) => r.id)
  expect(seen).toContain(mine)
  expect(seen).not.toContain(theirs)
  expect((await C.client.from('shared_items').select('id').eq('id', mine)).data).toEqual([])

  await C.client.from('shared_items').delete().eq('id', mine)
  expect(await exists(mine)).toBe(true)
  expect((await B.client.from('shared_items').delete().eq('id', mine)).error).toBeNull()
  expect(await exists(mine)).toBe(false)
  expect((await A.client.from('shared_items').delete().eq('id', mine)).error).toBeNull()
})

test('nobody inserts or updates inbox items directly', async () => {
  const id = await addItem(coupleA, A.id)
  const row = { couple_id: coupleA, shared_by: A.id, query: 'Dark' }
  expect((await A.client.from('shared_items').insert(row)).error).not.toBeNull()
  expect((await A.client.from('shared_items').update({ query: 'Otra' }).eq('id', id).select()).error).not.toBeNull()
  expect((await anonClient().rpc('create_share_key')).error).not.toBeNull()
})

function listen(user: User, name: string) {
  const events: RealtimePostgresChangesPayload<Row>[] = []
  const channel = user.client
    .channel(name)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_items', filter: `couple_id=eq.${coupleA}` }, (p) => events.push(p))
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

test('a new item reaches the partner in realtime and not an outsider', async () => {
  const partner = listen(B, 'shared-b')
  const outsider = listen(C, 'shared-c')
  await Promise.all([partner.ready, outsider.ready])
  await addItem(coupleA, A.id, 'Parásitos')
  const got = () => partner.events.some((e) => (e.new as Row).query === 'Parásitos')
  const end = Date.now() + 10_000
  while (!got() && Date.now() < end) await sleep(100)
  expect(got()).toBe(true)
  await sleep(3000)
  expect(outsider.events).toEqual([])
  await Promise.all([partner.stop(), outsider.stop()])
}, 30_000)

const share = (key: string | null, body: unknown) =>
  fetch(`${requireEnv(['VITE_SUPABASE_URL']).VITE_SUPABASE_URL}/functions/v1/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-share-key': key } : {}) },
    body: JSON.stringify(body),
  })

test('the share function saves what was shared with the right key', async () => {
  const key = (await A.client.rpc('create_share_key')).data as string
  const res = await share(key, { shared: 'https://www.instagram.com/reel/Zz9/?igsh=abc', name: 'Relatos salvajes' })
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('Guardado en Pelis By Pili')
  const { data } = await adminClient().from('shared_items').select('couple_id, shared_by, url, query, source').eq('query', 'Relatos salvajes').single()
  expect(data).toEqual({ couple_id: coupleA, shared_by: A.id, url: 'https://www.instagram.com/reel/Zz9/', query: 'Relatos salvajes', source: 'Instagram' })
})

test('old, made-up or missing keys are rejected and empty shares too', async () => {
  const old = (await B.client.rpc('create_share_key')).data as string
  const current = (await B.client.rpc('create_share_key')).data as string
  const rejected = await share(old, { shared: 'https://x.com/a' })
  expect(rejected.status).toBe(401)
  expect(await rejected.text()).toBe('No se guardó: la clave no sirve. Creá una nueva en Ajustes y ponela en el Atajo.')
  expect((await share('f'.repeat(48), { shared: 'https://x.com/a' })).status).toBe(401)
  expect((await share(null, { shared: 'https://x.com/a' })).status).toBe(401)
  expect((await share(current, { shared: ' ', name: '' })).status).toBe(400)
})

test('a key of someone who left the space stops working', async () => {
  const [D, E] = await Promise.all([createTestUser(), createTestUser()])
  await createCouple(D, E)
  const key = (await E.client.rpc('create_share_key')).data as string
  await adminClient().from('couple_members').delete().eq('user_id', E.id)
  expect((await share(key, { name: 'Dark' })).status).toBe(401)
})

test('the inbox holds at most 100 items', async () => {
  const key = (await C.client.rpc('create_share_key')).data as string
  // La base no deja pasar de 100 ni al admin: se completa lo que falta.
  const { count } = await adminClient().from('shared_items').select('id', { count: 'exact', head: true }).eq('couple_id', coupleC)
  const rows = Array.from({ length: 100 - (count ?? 0) }, (_, i) => ({ couple_id: coupleC, shared_by: C.id, query: `Peli ${i}` }))
  expect((await adminClient().from('shared_items').insert(rows)).error).toBeNull()
  const full = await share(key, { name: 'Una más' })
  expect(full.status).toBe(429)
  expect(await full.text()).toBe('No se guardó: la bandeja de Compartidos está llena. Descartá algunos en la app.')
})

test('a member adds to the inbox with their session, and the partner sees it', async () => {
  const { data: id, error } = await B.client.rpc('add_shared_item', { p_query: '  Dark  ', p_body: 'la dijo Juan' })
  expect(error).toBeNull()
  const { data } = await A.client.from('shared_items').select('query, body, url, source, shared_by').eq('id', id).single()
  expect(data).toEqual({ query: 'Dark', body: 'la dijo Juan', url: null, source: null, shared_by: B.id })
})

test('adding with a session checks the texts, the couple and the cap', async () => {
  expect((await A.client.rpc('add_shared_item', { p_query: '  ', p_body: '' })).error?.message).toBe('invalid_item')
  expect((await A.client.rpc('add_shared_item', { p_query: 'x'.repeat(101), p_body: null })).error?.message).toBe('invalid_item')
  expect((await A.client.rpc('add_shared_item', { p_query: null, p_body: 'y'.repeat(501) })).error?.message).toBe('invalid_item')
  const lonely = await createTestUser()
  expect((await lonely.client.rpc('add_shared_item', { p_query: 'Dark', p_body: null })).error?.message).toBe('no_couple')
  expect((await anonClient().rpc('add_shared_item', { p_query: 'Dark', p_body: null })).error).not.toBeNull()
  // La bandeja de C ya tiene 100 (test del tope de la función share).
  expect((await C.client.rpc('add_shared_item', { p_query: 'Otra', p_body: null })).error?.message).toBe('inbox_full')
})

test('two adds at once with 99 in the inbox leave exactly 100', async () => {
  const [D, E] = await Promise.all([createTestUser(), createTestUser()])
  const couple = await createCouple(D, E)
  const rows = Array.from({ length: 99 }, (_, i) => ({ couple_id: couple, shared_by: D.id, query: `Peli ${i}` }))
  expect((await adminClient().from('shared_items').insert(rows)).error).toBeNull()
  const results = await Promise.all([
    D.client.rpc('add_shared_item', { p_query: 'Una', p_body: null }),
    E.client.rpc('add_shared_item', { p_query: 'Otra', p_body: null }),
  ])
  expect(results.map((r) => r.error?.message ?? 'ok').sort()).toEqual(['inbox_full', 'ok'])
  const { count } = await adminClient().from('shared_items').select('id', { count: 'exact', head: true }).eq('couple_id', couple)
  expect(count).toBe(100)
})

test('two shares at once with 99 in the inbox: one is saved and the other is refused as full', async () => {
  const [D, E] = await Promise.all([createTestUser(), createTestUser()])
  const couple = await createCouple(D, E)
  const rows = Array.from({ length: 99 }, (_, i) => ({ couple_id: couple, shared_by: D.id, query: `Peli ${i}` }))
  expect((await adminClient().from('shared_items').insert(rows)).error).toBeNull()
  const key = (await D.client.rpc('create_share_key')).data as string
  const results = await Promise.all([share(key, { name: 'Una' }), share(key, { name: 'Otra' })])
  expect(results.map((r) => r.status).sort()).toEqual([200, 429])
  const { count } = await adminClient().from('shared_items').select('id', { count: 'exact', head: true }).eq('couple_id', couple)
  expect(count).toBe(100)
})
