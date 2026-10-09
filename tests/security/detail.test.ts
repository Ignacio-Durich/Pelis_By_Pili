import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { TitleDetail } from '../../supabase/functions/title-detail/lib.ts'
import { anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User, C: User
let parasite: string, dark: string, aew: string

async function detail(client: SupabaseClient, titleId: unknown) {
  const { data, error } = await client.functions.invoke<TitleDetail>('title-detail', { body: { titleId } })
  return { data, status: (error?.context as Response | undefined)?.status }
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  const couple = await createCouple(A, B)
  await createCouple(C)
  const add = async (tmdb_id: number, media_type: string, title: string) => {
    const { data, error } = await A.client.from('titles').insert({ couple_id: couple, tmdb_id, media_type, title }).select('id').single()
    if (error) throw error
    return data.id as string
  }
  parasite = await add(496243, 'movie', 'Parásitos')
  dark = await add(70523, 'tv', 'Dark')
  // Sin sinopsis en es-AR (verificado el 2026-10-07): sale de las traducciones.
  aew = await add(108847, 'tv', 'AEW Dark')
})
afterAll(cleanup)

test('a member gets the detail of a movie', async () => {
  const { data } = await detail(B.client, parasite)
  expect(data?.overview).not.toBe('')
  expect(data?.ratings.imdb).toMatch(/^\d\.\d\/10$/)
  expect(data?.ratings.rottenTomatoes).toMatch(/%$/)
  expect(typeof data?.ratings.tmdb).toBe('number')
  expect(data?.ratingsStale).toBe(false)
  expect(data?.providers?.subscription[0]?.name).toBeTruthy()
})

test('the ratings are saved on the title with their date', async () => {
  const { data } = await B.client.from('titles').select('imdb_rating, ratings_updated_at').eq('id', parasite).single()
  expect(data?.imdb_rating).not.toBeNull()
  expect(data?.ratings_updated_at).not.toBeNull()
})

test('a series without Rotten Tomatoes or Metacritic shows them as missing', async () => {
  const { data } = await detail(A.client, dark)
  expect(data?.ratings.imdb).toBeTruthy()
  expect(data?.ratings.metacritic).toBeNull()
})

test('a second call within 7 days does not change the saved date', async () => {
  const first = await detail(A.client, parasite)
  const second = await detail(A.client, parasite)
  expect(second.data?.ratings.updatedAt).toBe(first.data?.ratings.updatedAt)
})

test('outsiders get 404', async () => {
  const { data, status } = await detail(C.client, parasite)
  expect(status).toBe(404)
  expect(data).toBeNull()
})

test('an invalid id gets 400 and anonymous callers get 401', async () => {
  expect((await detail(A.client, 'abc')).status).toBe(400)
  expect((await detail(anonClient(), parasite)).status).toBe(401)
})

test('a title without an es-AR synopsis gets one from another language', async () => {
  const { data } = await detail(A.client, aew)
  expect(data?.overview).not.toBe('')
})

test('the detail saves runtime, genres and streaming on the title', async () => {
  await detail(B.client, parasite)
  const { data } = await B.client.from('titles').select('runtime, genres, streaming, details_updated_at').eq('id', parasite).single()
  expect(data?.runtime).toBe(132)
  expect(data?.genres).toContain('Drama')
  expect(data?.streaming.length).toBeGreaterThan(0)
  expect(data?.details_updated_at).not.toBeNull()
})

test('the detail saves who directed it, and for a series its seasons', async () => {
  await detail(B.client, parasite)
  await detail(A.client, aew)
  const { data } = await A.client.from('titles').select('id, director, seasons').in('id', [parasite, aew])
  const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r]))
  expect(byId[parasite]).toMatchObject({ director: 'Bong Joon-ho', seasons: null })
  expect(byId[aew].seasons).toBeGreaterThan(0)
})

test('members cannot write the director or the seasons', async () => {
  const { error } = await A.client.from('titles').update({ director: 'x', seasons: 1 }).eq('id', parasite)
  expect(error).not.toBeNull()
})

test('members cannot write the filter data', async () => {
  const { error } = await A.client.from('titles').update({ runtime: 1 }).eq('id', parasite)
  expect(error).not.toBeNull()
})
