import { expect, test } from 'vitest'
import { isOmdbLimit, summarizeOmdb } from './omdb.ts'

const imdb = { Source: 'Internet Movie Database', Value: '8.5/10' }
const rt = { Source: 'Rotten Tomatoes', Value: '99%' }
const meta = { Source: 'Metacritic', Value: '96/100' }

test('maps the three sources', () => {
  expect(summarizeOmdb({ Ratings: [imdb, rt, meta] })).toEqual({
    imdb: '8.5/10',
    rottenTomatoes: '99%',
    metacritic: '96/100',
  })
})

test('returns null for a missing source', () => {
  expect(summarizeOmdb({ Ratings: [imdb] })).toEqual({
    imdb: '8.5/10',
    rottenTomatoes: null,
    metacritic: null,
  })
})

test('handles a missing Ratings field', () => {
  expect(summarizeOmdb({})).toEqual({ imdb: null, rottenTomatoes: null, metacritic: null })
})

test('N/A counts as missing', () => {
  expect(summarizeOmdb({ Ratings: [{ Source: 'Metacritic', Value: 'N/A' }] }).metacritic).toBeNull()
})

test('isOmdbLimit recognizes only the daily limit', () => {
  expect(isOmdbLimit({ Response: 'False', Error: 'Request limit reached!' })).toBe(true)
  expect(isOmdbLimit({ Response: 'False', Error: 'Error getting data.' })).toBe(false)
  expect(isOmdbLimit({ Response: 'True' })).toBe(false)
})
