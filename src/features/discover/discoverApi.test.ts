import { beforeEach, expect, test, vi } from 'vitest'
import { makeTitle } from '../../test/titles'

const { invoke, rpc, single } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), single: vi.fn() }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  },
}))

import {
  discoverKey,
  dismissTitle,
  fetchDiscover,
  fetchPlatforms,
  fetchProviders,
  fetchSimilar,
  forgetDiscover,
  setPlatforms,
  undismissTitle,
  type Discover,
  type Recommendation,
} from './discoverApi'

const empty: Discover = { forBoth: [], forEach: [], inTheaters: [], onPlatforms: null, platformNames: [] }
const rec: Recommendation = {
  tmdbId: 27205,
  mediaType: 'movie',
  title: 'El origen',
  originalTitle: 'Inception',
  year: 2010,
  posterPath: null,
  overview: '',
  genres: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  forgetDiscover()
})

test('discoverKey changes with what was watched and the scores, not with the order or the to-watch ones', () => {
  const vista = makeTitle({ id: 'a', status: 'watched', watchedAt: '2026-10-01T00:00:00Z', scores: [{ userId: 'u1', score: 8, note: null, updatedAt: '' }] })
  const otra = makeTitle({ id: 'b', status: 'watched', watchedAt: '2026-10-02T00:00:00Z', scores: [] })
  const porVer = makeTitle({ id: 'c' })
  expect(discoverKey([vista, otra, porVer])).toBe(discoverKey([otra, vista]))
  expect(discoverKey([{ ...vista, scores: [{ ...vista.scores[0], score: 9 }] }, otra])).not.toBe(discoverKey([vista, otra]))
})

test('fetchDiscover calls once per key and again when the key changes', async () => {
  invoke.mockResolvedValue({ data: empty, error: null })
  await fetchDiscover('k1')
  await fetchDiscover('k1')
  await fetchDiscover('k2')
  expect(invoke).toHaveBeenCalledTimes(2)
  expect(invoke).toHaveBeenCalledWith('recommendations', { body: { discover: true } })
})

test('a failed discover is not remembered', async () => {
  invoke.mockResolvedValueOnce({ data: null, error: new Error('502') })
  await expect(fetchDiscover('k3')).rejects.toThrow()
  invoke.mockResolvedValueOnce({ data: empty, error: null })
  await expect(fetchDiscover('k3')).resolves.toEqual(empty)
})

test('fetchSimilar and fetchProviders unwrap their lists', async () => {
  invoke.mockResolvedValueOnce({ data: { results: [rec] }, error: null })
  expect(await fetchSimilar('t1')).toEqual([rec])
  expect(invoke).toHaveBeenLastCalledWith('recommendations', { body: { similarTo: 't1' } })
  invoke.mockResolvedValueOnce({ data: { providers: [{ id: 8, name: 'Netflix', logoPath: null }] }, error: null })
  expect(await fetchProviders()).toEqual([{ id: 8, name: 'Netflix', logoPath: null }])
})

test('dismiss, undismiss and setPlatforms call their SQL functions', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  await dismissTitle('movie', 27205)
  await undismissTitle('movie', 27205)
  await setPlatforms([8, 337])
  expect(rpc.mock.calls).toEqual([
    ['dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 }],
    ['undismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 }],
    ['set_platforms', { p_ids: [8, 337] }],
  ])
})

test('a SQL error code comes out as a DiscoverError with that kind', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'invalid_platforms' } })
  await expect(setPlatforms([1])).rejects.toMatchObject({ kind: 'invalid_platforms' })
  rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
  await expect(dismissTitle('tv', 1)).rejects.toMatchObject({ kind: 'network' })
})

test('fetchPlatforms reads the couple platforms', async () => {
  single.mockResolvedValue({ data: { platforms: [8, 337] }, error: null })
  expect(await fetchPlatforms('c1')).toEqual([8, 337])
  single.mockResolvedValue({ data: null, error: { message: 'x' } })
  await expect(fetchPlatforms('c1')).rejects.toMatchObject({ kind: 'network' })
})

test('dismissing or recovering a title forgets the saved Descubrir', async () => {
  invoke.mockResolvedValue({ data: empty, error: null })
  rpc.mockResolvedValue({ data: null, error: null })
  await fetchDiscover('k1')
  await dismissTitle('movie', 27205)
  await fetchDiscover('k1')
  await undismissTitle('movie', 27205)
  await fetchDiscover('k1')
  expect(invoke).toHaveBeenCalledTimes(3)
})
