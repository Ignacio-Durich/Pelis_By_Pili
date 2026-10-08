import { expect, test } from 'vitest'
import { makeTitle } from '../../test/titles'
import { MOODS, NO_ANSWERS, quickPick, type Answers } from './quickPick'

const a = (over: Partial<Answers>): Answers => ({ ...NO_ANSWERS, ...over })
const ids = (r: ReturnType<typeof quickPick>) => r.picks.map((t) => t.id)
let n = 0
const t = (over: Parameters<typeof makeTitle>[0]) => makeTitle({ id: `t${++n}`, tmdbId: n, ...over })

test('MOODS has the nine moods with their exact genres', () => {
  expect(MOODS.map((m) => m.id)).toEqual(['laugh', 'romantic', 'moved', 'adrenaline', 'intrigue', 'mindbending', 'scary', 'learn', 'relax'])
  expect(MOODS.find((m) => m.id === 'relax')).toEqual({
    id: 'relax',
    label: '😌 Relax',
    genres: ['Animación', 'Comedia', 'Familia', 'Documental', 'Música', 'Kids', 'Reality'],
  })
  expect(MOODS.find((m) => m.id === 'adrenaline')?.genres).toEqual([
    'Acción',
    'Aventura',
    'Action & Adventure',
    'Bélica',
    'War & Politics',
    'Western',
  ])
})

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

test('a mood match beats a better score', () => {
  const horror = t({ id: 'horror', genres: ['Terror'], imdbRating: '6.0/10' })
  const comedy = t({ id: 'comedy', genres: ['Comedia'], imdbRating: '9.0/10' })
  expect(ids(quickPick([comedy, horror], a({ moods: ['scary'] })))[0]).toBe('horror')
})

test('matching more of the chosen moods goes first', () => {
  // "Reírnos" y "Miedo" no comparten géneros: "both" coincide con los dos, "one" con uno.
  const both = t({ id: 'both', genres: ['Comedia', 'Terror'], imdbRating: '6.0/10' })
  const one = t({ id: 'one', genres: ['Comedia'], imdbRating: '9.0/10' })
  expect(ids(quickPick([one, both], a({ moods: ['laugh', 'scary'] })))).toEqual(['both', 'one'])
})

test('ties: IMDb, then TMDB, then no score last, then the newest', () => {
  const imdb8 = t({ id: 'imdb8', imdbRating: '8.5/10' })
  const tmdb9 = t({ id: 'tmdb9', tmdbRating: 9 })
  const none = t({ id: 'none' })
  const older = t({ id: 'older', imdbRating: '7.0/10', createdAt: '2026-10-01T00:00:00Z' })
  const newer = t({ id: 'newer', imdbRating: '7.0/10', createdAt: '2026-10-05T00:00:00Z' })
  expect(ids(quickPick([none, older, imdb8, newer, tmdb9], NO_ANSWERS))).toEqual(['tmdb9', 'imdb8', 'newer'])
  expect(ids(quickPick([none, older, newer], NO_ANSWERS))).toEqual(['newer', 'older', 'none'])
})

test('with fewer than 3 mood matches it fills with the rest and says so', () => {
  const match = t({ id: 'match', genres: ['Terror'] })
  const others = [t({ imdbRating: '5.0/10' }), t({ imdbRating: '9.0/10' }), t({ imdbRating: '7.0/10' }), t({})]
  const r = quickPick([...others, match], a({ moods: ['scary'] }))
  expect(r.picks).toHaveLength(3)
  expect(r.picks[0].id).toBe('match')
  expect(r.picks.slice(1).map((p) => p.imdbRating)).toEqual(['9.0/10', '7.0/10'])
  expect(r.filled).toBe(true)
})

test('with 3 or more mood matches nothing is filled', () => {
  const scary = [1, 2, 3].map(() => t({ genres: ['Terror'] }))
  expect(quickPick([...scary, t({})], a({ moods: ['scary'] })).filled).toBe(false)
})

test('without moods the best 3 by score, not filled', () => {
  const titles = [t({ imdbRating: '5.0/10' }), t({ imdbRating: '9.0/10' }), t({ imdbRating: '7.0/10' }), t({ imdbRating: '8.0/10' })]
  const r = quickPick(titles, NO_ANSWERS)
  expect(r.picks.map((p) => p.imdbRating)).toEqual(['9.0/10', '8.0/10', '7.0/10'])
  expect(r.filled).toBe(false)
})

test('watched titles are never suggested', () => {
  const watched = t({ id: 'w', status: 'watched', watchedAt: '2026-10-07T00:00:00Z', imdbRating: '9.9/10' })
  expect(ids(quickPick([watched, t({ id: 'p' })], NO_ANSWERS))).toEqual(['p'])
})

test('nothing that fits gives no picks', () => {
  expect(quickPick([], NO_ANSWERS)).toEqual({ picks: [], filled: false })
  expect(quickPick([t({ runtime: 200 })], a({ maxMinutes: 90, moods: ['laugh'] }))).toEqual({ picks: [], filled: false })
})
