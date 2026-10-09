import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { SearchResult } from '../../supabase/functions/tmdb-search/lib.ts'
import { anonClient, cleanup, createTestUser } from './helpers.ts'

let client: SupabaseClient

type Found = { results: SearchResult[]; person: { name: string; role: string; results: SearchResult[] } | null }

async function search(c: SupabaseClient, query: string) {
  const { data, error } = await c.functions.invoke<Found>('tmdb-search', { body: { query } })
  return { results: data?.results ?? [], person: data?.person ?? null, status: (error?.context as Response | undefined)?.status }
}

beforeAll(async () => {
  ;({ client } = await createTestUser())
})
afterAll(cleanup)

test('finds a movie by its English name', async () => {
  const { results } = await search(client, 'parasite')
  const index = results.findIndex((r) => r.tmdbId === 496243 && r.mediaType === 'movie')
  expect(index).toBeGreaterThanOrEqual(0)
  expect(index).toBeLessThan(5)
})

test('finds a movie by its Spain and Latin American names and shows the Latin one', async () => {
  for (const query of ['solo en casa', 'mi pobre angelito']) {
    const { results } = await search(client, query)
    expect(results.find((r) => r.tmdbId === 771 && r.mediaType === 'movie')).toMatchObject({
      title: 'Mi pobre angelito',
      originalTitle: 'Home Alone',
    })
  }
})

test('a one-letter query is rejected', async () => {
  expect((await search(client, 'a')).status).toBe(400)
})

test('anonymous callers get 401', async () => {
  expect((await search(anonClient(), 'parasite')).status).toBe(401)
})

test('an exact name goes first', async () => {
  const { results } = await search(client, 'mi pobre angelito')
  expect(results[0]).toMatchObject({ tmdbId: 771, mediaType: 'movie' })
})

test('a typo still finds it near the top', async () => {
  for (const [query, id] of [['breking bad', 1396], ['el padirno', 238], ['interstelar', 157336]] as const) {
    const { results } = await search(client, query)
    const index = results.findIndex((r) => r.tmdbId === id)
    expect(index, query).toBeGreaterThanOrEqual(0)
    expect(index, query).toBeLessThan(3)
  }
})

test('a director or actor name brings what they made', async () => {
  const nolan = await search(client, 'nolan')
  expect(nolan.person).toMatchObject({ name: 'Christopher Nolan', role: 'director' })
  expect(nolan.person?.results.some((r) => r.tmdbId === 157336)).toBe(true)
  const darin = await search(client, 'ricardo darin')
  expect(darin.person).toMatchObject({ name: 'Ricardo Darín', role: 'actor' })
  expect(darin.person?.results.some((r) => r.tmdbId === 25376)).toBe(true)
})

test('details gives who directed or created each result and the seasons of a series', async () => {
  const { data } = await client.functions.invoke('tmdb-search', {
    body: { details: [{ mediaType: 'movie', tmdbId: 157336 }, { mediaType: 'tv', tmdbId: 1396 }] },
  })
  expect(data.details['movie:157336']).toEqual({ director: 'Christopher Nolan', seasons: null })
  expect(data.details['tv:1396']).toEqual({ director: 'Vince Gilligan', seasons: 5 })
})

test('anonymous callers cannot ask for details', async () => {
  const { error } = await anonClient().functions.invoke('tmdb-search', { body: { details: [{ mediaType: 'tv', tmdbId: 1396 }] } })
  expect((error?.context as Response | undefined)?.status).toBe(401)
})
