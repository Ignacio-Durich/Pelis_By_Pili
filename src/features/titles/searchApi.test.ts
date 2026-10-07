import { beforeEach, expect, test, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { searchTitles } from './searchApi'

beforeEach(() => vi.resetAllMocks())

test('calls tmdb-search and returns the results', async () => {
  const results = [{ tmdbId: 496243, mediaType: 'movie', title: 'Parásitos' }]
  invoke.mockResolvedValue({ data: { results }, error: null })
  expect(await searchTitles('parásitos')).toEqual(results)
  expect(invoke).toHaveBeenCalledWith('tmdb-search', { body: { query: 'parásitos' } })
})

test('rejects when the function fails', async () => {
  invoke.mockResolvedValue({ data: null, error: new Error('502') })
  await expect(searchTitles('parásitos')).rejects.toThrow()
})
