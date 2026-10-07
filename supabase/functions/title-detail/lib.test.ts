import { expect, test } from 'vitest'
import { mergeRatings, needsRefresh, parseTitleId, pickImdbId, toProviders, type StoredRatings } from './lib.ts'

const now = new Date('2026-10-07T15:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const empty: StoredRatings = { imdb: null, rottenTomatoes: null, metacritic: null, tmdb: null, updatedAt: null }

test('parseTitleId accepts only UUIDs', () => {
  const id = crypto.randomUUID()
  expect(parseTitleId({ titleId: id })).toBe(id)
  for (const body of [{ titleId: 'abc' }, {}, null, { titleId: 3 }]) expect(parseTitleId(body)).toBeNull()
})

test('needsRefresh after 7 days or when never saved', () => {
  expect(needsRefresh(null, now)).toBe(true)
  expect(needsRefresh(daysAgo(6), now)).toBe(false)
  expect(needsRefresh(daysAgo(7), now)).toBe(true)
})

test('pickImdbId reads movies and series', () => {
  expect(pickImdbId({ imdb_id: 'tt6751668' })).toBe('tt6751668')
  expect(pickImdbId({ external_ids: { imdb_id: 'tt0903747' } })).toBe('tt0903747')
  expect(pickImdbId({})).toBeNull()
})

test('toProviders groups, orders by priority and merges free with ads', () => {
  const pluto = { provider_name: 'Pluto TV', logo_path: '/pl.jpg', display_priority: 5 }
  const providers = toProviders({
    link: 'https://www.themoviedb.org/movie/496243/watch?locale=AR',
    flatrate: [
      { provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 2 },
      { provider_name: 'Prime Video', logo_path: '/p.jpg', display_priority: 1 },
    ],
    rent: [{ provider_name: 'Apple TV', logo_path: null, display_priority: 3 }],
    ads: [pluto],
    free: [pluto],
  })
  expect(providers).toEqual({
    link: 'https://www.themoviedb.org/movie/496243/watch?locale=AR',
    subscription: [
      { name: 'Prime Video', logoPath: '/p.jpg' },
      { name: 'Netflix', logoPath: '/n.jpg' },
    ],
    rent: [{ name: 'Apple TV', logoPath: null }],
    buy: [],
    free: [{ name: 'Pluto TV', logoPath: '/pl.jpg' }],
  })
})

test('toProviders without data for AR is null', () => {
  expect(toProviders(undefined)).toBeNull()
  expect(toProviders({ link: 'x' })).toBeNull()
})

const omdbParasite = {
  Response: 'True',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '8.5/10' },
    { Source: 'Rotten Tomatoes', Value: '99%' },
    { Source: 'Metacritic', Value: '97/100' },
  ],
}

test('mergeRatings takes a fresh OMDb answer', () => {
  expect(mergeRatings(empty, omdbParasite, 8.5, now)).toEqual({
    ratings: { imdb: '8.5/10', rottenTomatoes: '99%', metacritic: '97/100', tmdb: 8.5, updatedAt: now.toISOString() },
    stale: false,
    save: true,
  })
})

test('mergeRatings leaves Metacritic missing for a series', () => {
  const bb = { Response: 'True', Ratings: [{ Source: 'Internet Movie Database', Value: '9.5/10' }, { Source: 'Rotten Tomatoes', Value: '96%' }] }
  expect(mergeRatings(empty, bb, 8.954, now).ratings).toMatchObject({ imdb: '9.5/10', rottenTomatoes: '96%', metacritic: null, tmdb: 9 })
})

test('mergeRatings keeps the saved ratings when the OMDb limit is reached', () => {
  const stored: StoredRatings = { imdb: '8.5/10', rottenTomatoes: '99%', metacritic: null, tmdb: 8.5, updatedAt: '2026-09-01T00:00:00Z' }
  expect(mergeRatings(stored, { Response: 'False', Error: 'Request limit reached!' }, 8.6, now)).toEqual({ ratings: stored, stale: true, save: false })
})

test('mergeRatings without an OMDb call keeps ratings that are still valid', () => {
  const stored: StoredRatings = { imdb: '8.5/10', rottenTomatoes: '99%', metacritic: null, tmdb: 8.5, updatedAt: daysAgo(2) }
  expect(mergeRatings(stored, null, 8.6, now)).toEqual({ ratings: stored, stale: false, save: false })
})

test('mergeRatings without an IMDb id saves only the TMDB score', () => {
  expect(mergeRatings(empty, null, 7.25, now)).toEqual({
    ratings: { imdb: null, rottenTomatoes: null, metacritic: null, tmdb: 7.3, updatedAt: now.toISOString() },
    stale: false,
    save: true,
  })
})
