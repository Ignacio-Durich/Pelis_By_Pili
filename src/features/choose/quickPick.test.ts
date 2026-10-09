import { expect, test } from 'vitest'
import { makeTitle } from '../../test/titles'
import { NO_ANSWERS, quickPick, type Answers } from './quickPick'

const a = (over: Partial<Answers>): Answers => ({ ...NO_ANSWERS, ...over })
const ids = (r: ReturnType<typeof quickPick>) => r.picks.map((t) => t.id)
let n = 0
const t = (over: Parameters<typeof makeTitle>[0]) => makeTitle({ id: `t${++n}`, tmdbId: n, ...over })

test('time: only titles that fit, and without runtime they do not', () => {
  const fits = t({ id: 'fits', runtime: 119 })
  const long = t({ id: 'long', runtime: 132 })
  const unknown = t({ id: 'unknown', runtime: null })
  expect(ids(quickPick([fits, long, unknown], a({ maxMinutes: 120 })))).toEqual(['fits'])
  expect(quickPick([fits, long, unknown], NO_ANSWERS).picks).toHaveLength(3)
})

test('platforms: only titles on any of the chosen ones', () => {
  const netflix = t({ id: 'nf', streaming: ['Netflix'] })
  const prime = t({ id: 'pv', streaming: ['Prime Video'] })
  const hbo = t({ id: 'hbo', streaming: ['HBO Max'] })
  expect(ids(quickPick([netflix, prime, hbo], a({ platforms: ['Netflix'] })))).toEqual(['nf'])
  expect(ids(quickPick([netflix, prime, hbo], a({ platforms: ['Netflix', 'HBO Max'] }))).sort()).toEqual(['hbo', 'nf'])
})

test('a genre match beats a better score', () => {
  const horror = t({ id: 'horror', genres: ['Terror'], imdbRating: '6.0/10' })
  const comedy = t({ id: 'comedy', genres: ['Comedia'], imdbRating: '9.0/10' })
  expect(ids(quickPick([comedy, horror], a({ genres: ['Terror'] })))[0]).toBe('horror')
})

test('matching more of the chosen genres goes first', () => {
  const both = t({ id: 'both', genres: ['Comedia', 'Terror'], imdbRating: '6.0/10' })
  const one = t({ id: 'one', genres: ['Comedia'], imdbRating: '9.0/10' })
  expect(ids(quickPick([one, both], a({ genres: ['Comedia', 'Terror'] })))).toEqual(['both', 'one'])
})

test('ties: IMDb, then TMDB, then no score last, then the newest', () => {
  const imdb8 = t({ id: 'imdb8', imdbRating: '8.5/10' })
  const tmdb9 = t({ id: 'tmdb9', tmdbRating: 9 })
  const none = t({ id: 'none' })
  const older = t({ id: 'older', imdbRating: '7.0/10', createdAt: '2026-10-01T00:00:00Z' })
  const newer = t({ id: 'newer', imdbRating: '7.0/10', createdAt: '2026-10-05T00:00:00Z' })
  expect(ids(quickPick([none, older, imdb8, newer, tmdb9], NO_ANSWERS))).toEqual(['tmdb9', 'imdb8', 'newer', 'older', 'none'])
  expect(ids(quickPick([none, older, newer], NO_ANSWERS))).toEqual(['newer', 'older', 'none'])
})

test('with fewer than 5 genre matches it fills with the rest and says so', () => {
  const match = t({ id: 'match', genres: ['Terror'] })
  const others = ['5.0/10', '9.0/10', '7.0/10', '8.0/10', '6.0/10'].map((imdbRating) => t({ imdbRating }))
  const r = quickPick([...others, t({}), match], a({ genres: ['Terror'] }))
  expect(r.picks).toHaveLength(5)
  expect(r.picks[0].id).toBe('match')
  expect(r.picks.slice(1).map((p) => p.imdbRating)).toEqual(['9.0/10', '8.0/10', '7.0/10', '6.0/10'])
  expect(r.filled).toBe(true)
})

test('with 5 or more genre matches nothing is filled', () => {
  const scary = [1, 2, 3, 4, 5].map(() => t({ genres: ['Terror'] }))
  expect(quickPick([...scary, t({})], a({ genres: ['Terror'] })).filled).toBe(false)
})

test('without genres the best 5 by score, not filled', () => {
  const titles = ['5.0/10', '9.0/10', '7.0/10', '8.0/10', '4.0/10', '6.0/10'].map((imdbRating) => t({ imdbRating }))
  const r = quickPick(titles, NO_ANSWERS)
  expect(r.picks.map((p) => p.imdbRating)).toEqual(['9.0/10', '8.0/10', '7.0/10', '6.0/10', '5.0/10'])
  expect(r.filled).toBe(false)
})

test('watched titles are never suggested', () => {
  const watched = t({ id: 'w', status: 'watched', watchedAt: '2026-10-07T00:00:00Z', imdbRating: '9.9/10' })
  expect(ids(quickPick([watched, t({ id: 'p' })], NO_ANSWERS))).toEqual(['p'])
})

test('nothing that fits gives no picks', () => {
  expect(quickPick([], NO_ANSWERS)).toEqual({ picks: [], filled: false })
  expect(quickPick([t({ runtime: 200 })], a({ maxMinutes: 90, genres: ['Comedia'] }))).toEqual({ picks: [], filled: false })
})
