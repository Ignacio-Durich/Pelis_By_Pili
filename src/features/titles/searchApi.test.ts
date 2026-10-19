import { beforeEach, expect, test, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { searchDetails, searchTitles } from './searchApi'

beforeEach(() => vi.resetAllMocks())

test('calls tmdb-search and returns the results and the person', async () => {
  const results = [{ tmdbId: 496243, mediaType: 'movie', title: 'Parásitos' }]
  invoke.mockResolvedValue({ data: { results, person: null }, error: null })
  expect(await searchTitles('parásitos')).toEqual({ results, person: null })
  expect(invoke).toHaveBeenCalledWith('tmdb-search', { body: { query: 'parásitos' } })
})

test('the same search again answers from memory, without calling', async () => {
  invoke.mockResolvedValue({ data: { results: [], person: null }, error: null })
  await searchTitles('Algo Nuevo')
  await searchTitles('algo nuevo ')
  expect(invoke).toHaveBeenCalledTimes(1)
})

test('rejects when the function fails, and does not remember the failure', async () => {
  invoke.mockResolvedValue({ data: null, error: new Error('502') })
  await expect(searchTitles('falla')).rejects.toThrow()
  invoke.mockResolvedValue({ data: { results: [], person: null }, error: null })
  await expect(searchTitles('falla')).resolves.toEqual({ results: [], person: null })
})

test('searchDetails asks only for what it does not know yet, 20 at a time', async () => {
  invoke.mockResolvedValue({ data: { details: { 'movie:1': { director: 'A', seasons: null } } }, error: null })
  const one = { mediaType: 'movie' as const, tmdbId: 1 }
  expect(await searchDetails([one])).toEqual({ 'movie:1': { director: 'A', seasons: null } })
  expect(await searchDetails([one])).toEqual({ 'movie:1': { director: 'A', seasons: null } })
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(invoke).toHaveBeenCalledWith('tmdb-search', { body: { details: [one] } })
  invoke.mockResolvedValue({ data: { details: {} }, error: null })
  const many = Array.from({ length: 25 }, (_, i) => ({ mediaType: 'tv' as const, tmdbId: i + 100 }))
  await searchDetails(many)
  expect(invoke.mock.calls[1][1].body.details).toHaveLength(20)
  expect(invoke.mock.calls[2][1].body.details).toHaveLength(5)
})
