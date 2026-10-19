import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User, C: User
let couple: string

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  couple = await createCouple(A, B)
  await createCouple(C)
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
