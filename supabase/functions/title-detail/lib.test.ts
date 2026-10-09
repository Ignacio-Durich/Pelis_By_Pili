import { expect, test } from 'vitest'
import {
  mergeRatings,
  needsRefresh,
  parseTitleId,
  pickGenres,
  pickImdbId,
  pickDirector,
  pickOverview,
  pickRuntime,
  pickSeasons,
  streamingNames,
  tmdbScoreOf,
  toProviders,
  type StoredRatings,
} from './lib.ts'

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

test('a title without votes has no TMDB score', () => {
  expect(tmdbScoreOf({ vote_average: 0, vote_count: 0 })).toBeNull()
  expect(tmdbScoreOf({ vote_average: 8.5, vote_count: 1200 })).toBe(8.5)
  expect(tmdbScoreOf({})).toBeNull()
})

test('pickOverview falls back through es-MX, es-ES and en-US translations', () => {
  const tr = (iso_639_1: string, iso_3166_1: string, overview: string) => ({ iso_639_1, iso_3166_1, data: { overview } })
  expect(pickOverview({ overview: 'Argentina' })).toBe('Argentina')
  expect(
    pickOverview({ overview: '', translations: { translations: [tr('en', 'US', 'English'), tr('es', 'ES', 'España')] } }),
  ).toBe('España')
  expect(pickOverview({ overview: '', translations: { translations: [tr('en', 'US', 'English'), tr('es', 'MX', '')] } })).toBe('English')
  expect(pickOverview({})).toBe('')
})

test('pickRuntime uses the movie runtime or an episode length', () => {
  expect(pickRuntime({ runtime: 132 })).toBe(132)
  expect(pickRuntime({ runtime: 0, episode_run_time: [], last_episode_to_air: { runtime: 56 } })).toBe(56)
  expect(pickRuntime({ episode_run_time: [45, 50] })).toBe(45)
  expect(pickRuntime({})).toBeNull()
})

test('pickGenres returns names without repeats', () => {
  expect(pickGenres({ genres: [{ name: 'Drama' }, { name: 'Crimen' }, { name: 'Drama' }] })).toEqual(['Drama', 'Crimen'])
  expect(pickGenres({})).toEqual([])
})

test('streamingNames keeps subscription and free platforms', () => {
  const p = (name: string) => ({ name, logoPath: null })
  expect(
    streamingNames({ link: null, subscription: [p('Netflix'), p('Prime Video')], rent: [p('Apple TV')], buy: [], free: [p('Pluto TV'), p('Netflix')] }),
  ).toEqual(['Netflix', 'Prime Video', 'Pluto TV'])
  expect(streamingNames(null)).toEqual([])
})

test('pickDirector: the movie directors, or who created the series, at most 3', () => {
  const crew = [
    { job: 'Director', name: 'Bong Joon-ho' },
    { job: 'Writer', name: 'Han Jin-won' },
  ]
  expect(pickDirector({ credits: { crew } })).toBe('Bong Joon-ho')
  const many = ['A', 'B', 'C', 'D', 'A'].map((name) => ({ job: 'Director', name }))
  expect(pickDirector({ credits: { crew: many } })).toBe('A, B, C')
  expect(pickDirector({ created_by: [{ name: 'Vince Gilligan' }, { name: 'Peter Gould' }], credits: { crew } })).toBe('Vince Gilligan, Peter Gould')
  expect(pickDirector({ created_by: [], credits: { crew: [] } })).toBeNull()
  expect(pickDirector({})).toBeNull()
})

test('pickSeasons: only series with seasons', () => {
  expect(pickSeasons({ number_of_seasons: 5 })).toBe(5)
  expect(pickSeasons({ number_of_seasons: 0 })).toBeNull()
  expect(pickSeasons({})).toBeNull()
})
