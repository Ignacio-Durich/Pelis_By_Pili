import { expect, test } from 'vitest'
import {
  byPopularity,
  byVotes,
  genreNames,
  hasNewSeason,
  inOrder,
  isNewSeasonSeries,
  memberSeeds,
  mergePlatformResults,
  parseRequest,
  pickSeeds,
  rankRecommendations,
  seedWeight,
  toProviderOptions,
  toRecommendation,
} from './lib.ts'

test('parseRequest: the three modes and nothing else', () => {
  expect(parseRequest({ discover: true })).toEqual({ kind: 'discover' })
  expect(parseRequest({ similarTo: '6f1c2a4e-3b7d-4c1e-9a2b-1d2e3f4a5b6c' })).toEqual({ kind: 'similar', titleId: '6f1c2a4e-3b7d-4c1e-9a2b-1d2e3f4a5b6c' })
  expect(parseRequest({ providers: true })).toEqual({ kind: 'providers' })
  for (const body of [null, {}, { similarTo: 'x' }, { discover: 'yes' }]) expect(parseRequest(body)).toBeNull()
})
test('seedWeight: average minus 5, one score alone, none is null', () => {
  expect(seedWeight([9, 8])).toBe(3.5)
  expect(seedWeight([3])).toBe(-2)
  expect(seedWeight([])).toBeNull()
})
test('pickSeeds keeps the 50 with the largest weight, good or bad', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => ({ weight: i % 2 ? i / 10 : -i / 10 }))
  const picked = pickSeeds(seeds)
  expect(picked).toHaveLength(50)
  expect(picked.map((s) => Math.abs(s.weight))).not.toContain(0)
})
test('memberSeeds never goes beyond the seeds picked for both, even with more than 50 scored titles', () => {
  const all = Array.from({ length: 120 }, (_, i) => ({ key: `movie:${i}`, title: `T${i}`, weight: i % 2 ? i / 10 : -i / 10 }))
  const both = pickSeeds(all)
  // Tomás puntuó los 120; Juli solo los pares.
  const tomas = memberSeeds(both, all.map((s) => ({ key: s.key, score: 9 })))
  const juli = memberSeeds(both, all.filter((_, i) => i % 2 === 0).map((s) => ({ key: s.key, score: 2 })))
  const picked = new Set(both.map((s) => s.key))
  for (const seeds of [tomas, juli]) expect(seeds.every((s) => picked.has(s.key))).toBe(true)
  expect(tomas).toHaveLength(50)
  expect(juli.length).toBeLessThan(50)
  expect(tomas[0].weight).toBe(4)
  expect(juli[0].weight).toBe(-3)
})
test('rankRecommendations: several favorites push a title up, a bad one pushes it down, with why', () => {
  const a = { id: 1, title: 'Uno', vote_count: 500 }, b = { id: 2, title: 'Dos', vote_count: 500 }, c = { id: 3, title: 'Tres', vote_count: 500 }
  const seeds = [
    { seed: { key: 'movie:10', title: 'El origen', weight: 4 }, mediaType: 'movie' as const, results: [a, b] },
    { seed: { key: 'movie:11', title: 'Interestelar', weight: 3 }, mediaType: 'movie' as const, results: [b, c] },
    { seed: { key: 'movie:12', title: 'Mala', weight: -3 }, mediaType: 'movie' as const, results: [c] },
  ]
  const ranked = rankRecommendations(seeds, { exclude: new Set(), minVotes: 50, limit: 30 })
  expect(ranked.map((r) => r.tmdbId)).toEqual([2, 1])
  expect(ranked[0].because).toEqual(['El origen', 'Interestelar'])
})
test('rankRecommendations drops the list, the dismissed, the few-voted and caps at the limit', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `T${i}`, vote_count: i === 5 ? 10 : 500 }))
  const ranked = rankRecommendations([{ seed: { key: 'movie:99', title: 'X', weight: 4 }, mediaType: 'movie', results: items }],
    { exclude: new Set(['movie:1', 'movie:2']), minVotes: 50, limit: 30 })
  expect(ranked).toHaveLength(30)
  expect(ranked.map((r) => r.tmdbId)).not.toContain(1)
  expect(ranked.map((r) => r.tmdbId)).not.toContain(6)
})
test('genreNames maps TMDB ids to Spanish names and skips unknown ones', () => {
  expect(genreNames([18, 36, 12, 999999])).toEqual(['Drama', 'Historia', 'Aventura'])
  expect(genreNames(undefined)).toEqual([])
})
test('toRecommendation adds the genre names to the search result', () => {
  expect(toRecommendation({ id: 3, title: 'Tres', release_date: '2020-05-01', genre_ids: [35, 18] }, 'movie')).toEqual({
    tmdbId: 3, mediaType: 'movie', title: 'Tres', originalTitle: '', year: 2020, posterPath: null, overview: '', genres: ['Comedia', 'Drama'],
  })
})
test('inOrder keeps the order and byPopularity sorts, both without the excluded and up to the limit', () => {
  const items = [{ id: 1, popularity: 5 }, { id: 2, popularity: 9 }, { id: 3, popularity: 7 }].map((item) => ({ item, mediaType: 'movie' as const }))
  expect(inOrder(items, new Set(['movie:2']), 5).map((r) => r.tmdbId)).toEqual([1, 3])
  expect(byPopularity(items, new Set(['movie:1']), 1).map((r) => r.tmdbId)).toEqual([2])
})
test('inOrder and byPopularity keep one entry per title when pages overlap', () => {
  const items = [{ id: 1, popularity: 5 }, { id: 2, popularity: 9 }, { id: 1, popularity: 5 }].map((item) => ({ item, mediaType: 'movie' as const }))
  expect(inOrder(items, new Set(), 5).map((r) => r.tmdbId)).toEqual([1, 2])
  expect(byPopularity(items, new Set(), 5).map((r) => r.tmdbId)).toEqual([2, 1])
})
test('isNewSeasonSeries: a series that premiered before the window', () => {
  expect(isNewSeasonSeries({ id: 1, first_air_date: '2019-01-01' }, '2026-07-21')).toBe(true)
  expect(isNewSeasonSeries({ id: 1, first_air_date: '2026-09-01' }, '2026-07-21')).toBe(false)
})
test('mergePlatformResults names every platform, marks new seasons, keeps watched series for checking and puts watched series first, then premieres, then old series, each by popularity', () => {
  const nueva = { id: 5, name: 'Nueva', first_air_date: '2026-09-01', popularity: 10 }
  const vieja = { id: 6, name: 'Vieja', first_air_date: '2019-01-01', popularity: 30 }
  const vista = { id: 7, name: 'Vista', first_air_date: '2018-01-01', popularity: 20 }
  const peli = { id: 8, title: 'Peli', release_date: '2026-09-10', popularity: 25 }
  const merged = mergePlatformResults(
    [{ name: 'Netflix', movies: [peli], series: [nueva, vieja, vista] }, { name: 'Max', movies: [], series: [vieja] }],
    { exclude: new Set(['tv:7']), watched: new Map([['tv:7', 'title-7']]), since: '2026-07-21', limit: 30 },
  )
  expect(merged.map((r) => [r.tmdbId, r.platforms, r.newSeason ?? false, r.watchedTitleId])).toEqual([
    [7, ['Netflix'], true, 'title-7'],
    [8, ['Netflix'], false, undefined],
    [5, ['Netflix'], false, undefined],
    [6, ['Netflix', 'Max'], true, undefined],
  ])
})
test('hasNewSeason: the latest season already aired started after it was marked watched', () => {
  const seasons = [{ season_number: 0, air_date: '2026-10-01' }, { season_number: 1, air_date: '2020-01-01' }, { season_number: 2, air_date: '2026-09-01' }, { season_number: 3, air_date: '2027-03-01' }]
  expect(hasNewSeason({ seasons }, '2026-01-10T00:00:00Z', '2026-10-19')).toBe(true)
  expect(hasNewSeason({ seasons }, '2026-09-15T00:00:00Z', '2026-10-19')).toBe(false)
  expect(hasNewSeason({}, '2026-01-10T00:00:00Z', '2026-10-19')).toBe(false)
})
test('toProviderOptions joins movie and tv providers by display priority, up to 30', () => {
  const movie = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', display_priority: 2 }]
  const tv = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', display_priority: 2 }, { provider_id: 337, provider_name: 'Disney Plus', logo_path: null, display_priority: 1 }]
  expect(toProviderOptions(movie, tv)).toEqual([{ id: 337, name: 'Disney Plus', logoPath: null }, { id: 8, name: 'Netflix', logoPath: '/n.png' }])
})

test('byVotes puts the best-known first (most votes), keeping TMDB order on ties, without the excluded and up to the limit', () => {
  const items = [
    { item: { id: 1, title: 'El pago', vote_count: 2147 }, mediaType: 'movie' as const },
    { item: { id: 2, title: 'Tenet', vote_count: 11653 }, mediaType: 'movie' as const },
    { item: { id: 3, title: 'Sin votos' }, mediaType: 'movie' as const },
    { item: { id: 4, title: 'Oblivion', vote_count: 11930 }, mediaType: 'movie' as const },
    { item: { id: 5, title: 'Empate', vote_count: 2147 }, mediaType: 'movie' as const },
  ]
  expect(byVotes(items, new Set(['movie:4']), 3).map((r) => r.tmdbId)).toEqual([2, 1, 5])
})
