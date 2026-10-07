import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { SearchResult } from '../../supabase/functions/tmdb-search/lib.ts'
import { anonClient, cleanup, createTestUser } from './helpers.ts'

let client: SupabaseClient

async function search(c: SupabaseClient, query: string) {
  const { data, error } = await c.functions.invoke<{ results: SearchResult[] }>('tmdb-search', { body: { query } })
  return { results: data?.results ?? [], status: (error?.context as Response | undefined)?.status }
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
