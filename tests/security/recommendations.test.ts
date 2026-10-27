import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { Discover, ProviderOption, Recommendation } from '../../supabase/functions/recommendations/lib.ts'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User, C: User
let couple: string, otherCouple: string, originId: string

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  couple = await createCouple(A, B)
  otherCouple = await createCouple(C)
  // El origen (vista, 9 de A) e Interestelar (por ver) en el espacio de A y B.
  const admin = adminClient()
  const { data: origin } = await admin.from('titles').insert({ couple_id: couple, tmdb_id: 27205, media_type: 'movie', title: 'El origen', added_by: A.id, status: 'watched', watched_at: new Date().toISOString() }).select('id').single()
  originId = origin!.id
  await admin.from('title_scores').insert({ title_id: originId, couple_id: couple, user_id: A.id, score: 9 })
  await admin.from('titles').insert({ couple_id: couple, tmdb_id: 157336, media_type: 'movie', title: 'Interestelar', added_by: A.id })
})
afterAll(cleanup)

test('a member sets the platforms and both read them, without repeats', async () => {
  expect((await A.client.rpc('set_platforms', { p_ids: [8, 337, 8] })).error).toBeNull()
  const { data } = await B.client.from('couples').select('platforms').eq('id', couple).single()
  expect(data?.platforms).toEqual([8, 337])
})

test('invalid platform lists are rejected', async () => {
  for (const p_ids of [[0], [-3], Array.from({ length: 31 }, (_, i) => i + 1)])
    expect((await A.client.rpc('set_platforms', { p_ids })).error?.message).toBe('invalid_platforms')
})

test('a member dismisses a title, both see it, and undismiss brings it back', async () => {
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  const { data } = await B.client.from('dismissed_titles').select('media_type, tmdb_id, dismissed_by')
  expect(data).toEqual([{ media_type: 'movie', tmdb_id: 27205, dismissed_by: A.id }])
  expect((await B.client.rpc('undismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  expect((await A.client.from('dismissed_titles').select('*')).data).toEqual([])
})

test('another couple does not see the dismissed titles and nobody inserts directly', async () => {
  await A.client.rpc('dismiss_title', { p_media_type: 'tv', p_tmdb_id: 1396 })
  expect((await C.client.from('dismissed_titles').select('*')).data ?? []).toEqual([])
  const { error } = await A.client.from('dismissed_titles').insert({ couple_id: couple, media_type: 'tv', tmdb_id: 1 })
  expect(error?.code).toBe('42501')
})

test('bad titles, no couple and anonymous callers are rejected', async () => {
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'book', p_tmdb_id: 1 })).error?.message).toBe('invalid_title')
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 0 })).error?.message).toBe('invalid_title')
  const D = await createTestUser()
  expect((await D.client.rpc('set_platforms', { p_ids: [8] })).error?.message).toBe('no_couple')
  expect((await anonClient().rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 1 })).error).not.toBeNull()
})

test('service_role reads the dismissed titles', async () => {
  expect((await adminClient().from('dismissed_titles').select('*').eq('couple_id', couple)).error).toBeNull()
})

async function recs<T>(client: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke<T>('recommendations', { body })
  return { data: data as T, status: (error?.context as Response | undefined)?.status }
}

test('anonymous callers get 401', async () => {
  expect((await recs(anonClient(), { discover: true })).status).toBe(401)
})

test('a user without a couple gets 403', async () => {
  expect((await recs(await createTestUser().then((u) => u.client), { discover: true })).status).toBe(403)
})

test('a bad body gets 400', async () => {
  expect((await recs(A.client, { nothing: true })).status).toBe(400)
})

test('similarTo a title of another couple is 404', async () => {
  const { data } = await adminClient().from('titles').insert({ couple_id: otherCouple, tmdb_id: 27205, media_type: 'movie', title: 'El origen', added_by: C.id }).select('id').single()
  expect((await recs(A.client, { similarTo: data!.id })).status).toBe(404)
})

test('similarTo a watched title returns TMDB recommendations and the parts by person, without what is already in the list', async () => {
  const { data } = await recs<{ results: Recommendation[]; more: { kind: string; name: string; results: Recommendation[] }[] }>(A.client, { similarTo: originId })
  expect(data.results.length).toBeGreaterThan(0)
  expect(data.results.find((r) => r.tmdbId === 157336)).toBeUndefined()
  expect(data.more.map((p) => p.kind)).toContain('director')
  expect(data.more.flatMap((p) => p.results).find((r) => r.tmdbId === 157336 || r.tmdbId === 27205)).toBeUndefined()
})

test('discover returns the four sections; no platforms means onPlatforms null', async () => {
  await A.client.rpc('set_platforms', { p_ids: [] })
  const { data } = await recs<Discover>(A.client, { discover: true })
  expect(Object.keys(data).sort()).toEqual(['forBoth', 'forEach', 'inTheaters', 'onPlatforms', 'platformNames'])
  expect(data.onPlatforms).toBeNull()
  expect(data.platformNames).toEqual([])
  expect(data.forBoth.find((r) => r.tmdbId === 157336)).toBeUndefined()
  expect(data.forEach.map((e) => e.userId)).toEqual([A.id])
})

test('discover with a chosen platform lists its name and a platforms section', async () => {
  await A.client.rpc('set_platforms', { p_ids: [8] })
  const { data } = await recs<Discover>(A.client, { discover: true })
  expect(data.platformNames).toEqual(['Netflix'])
  expect(Array.isArray(data.onPlatforms)).toBe(true)
  expect(data.onPlatforms!.length).toBeLessThanOrEqual(30)
})

test('providers lists Argentine platforms with Netflix among them', async () => {
  const { data } = await recs<{ providers: ProviderOption[] }>(A.client, { providers: true })
  expect(data.providers.find((p) => p.id === 8)?.name).toBe('Netflix')
})
