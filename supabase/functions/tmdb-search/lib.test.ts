import { expect, test } from 'vitest'
import { mergeSearches, parseQuery } from './lib.ts'

const homeAlone = { media_type: 'movie', id: 771, original_title: 'Home Alone', release_date: '1990-11-16', poster_path: '/h.jpg', popularity: 50 }
const none = { 'es-MX': [], 'es-AR': [], 'en-US': [] }

test('takes the Latin American title, the es-AR overview and the original title', () => {
  const [result] = mergeSearches({
    'es-MX': [{ ...homeAlone, title: 'Mi pobre angelito', overview: 'corta' }],
    'es-AR': [{ ...homeAlone, title: 'Solo en casa', overview: 'Sinopsis completa' }],
    'en-US': [{ ...homeAlone, title: 'Home Alone', overview: 'English' }],
  })
  expect(result).toEqual({
    tmdbId: 771,
    mediaType: 'movie',
    title: 'Mi pobre angelito',
    originalTitle: 'Home Alone',
    year: 1990,
    posterPath: '/h.jpg',
    overview: 'Sinopsis completa',
  })
})

test('a title found only in English keeps its English name', () => {
  const parasite = { media_type: 'movie', id: 496243, title: 'Parasite', original_title: '기생충', release_date: '2019-05-30', popularity: 30 }
  expect(mergeSearches({ ...none, 'en-US': [parasite] })[0]).toMatchObject({ tmdbId: 496243, title: 'Parasite', originalTitle: '기생충' })
})

test('ranks by best position in any language', () => {
  const x = { media_type: 'movie', id: 1, title: 'X', popularity: 1 }
  const y = { media_type: 'movie', id: 2, title: 'Y', popularity: 99 }
  const z = { media_type: 'movie', id: 3, title: 'Z', popularity: 50 }
  const ids = mergeSearches({ 'es-MX': [z, y], 'es-AR': [], 'en-US': [x] }).map((r) => r.tmdbId)
  expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2))
})

test('ties are broken by popularity', () => {
  const low = { media_type: 'movie', id: 1, title: 'Low', popularity: 1 }
  const high = { media_type: 'tv', id: 2, name: 'High', popularity: 9 }
  expect(mergeSearches({ 'es-MX': [low], 'es-AR': [], 'en-US': [high] }).map((r) => r.tmdbId)).toEqual([2, 1])
})

test('maps a series', () => {
  const bb = { media_type: 'tv', id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', first_air_date: '2008-01-20', poster_path: null }
  expect(mergeSearches({ ...none, 'es-AR': [bb] })[0]).toMatchObject({ mediaType: 'tv', title: 'Breaking Bad', year: 2008, posterPath: null })
})

test('drops people', () => {
  const person = { media_type: 'person', id: 5, name: 'Alguien' }
  const movie = { media_type: 'movie', id: 6, title: 'Peli' }
  expect(mergeSearches({ ...none, 'es-AR': [person, movie] }).map((r) => r.tmdbId)).toEqual([6])
})

test('missing or empty dates give a null year and missing overview gives empty text', () => {
  const results = mergeSearches({
    ...none,
    'es-AR': [
      { media_type: 'movie', id: 7, title: 'Sin fecha', release_date: '' },
      { media_type: 'tv', id: 8, name: 'Tampoco' },
    ],
  })
  expect(results.map((r) => [r.year, r.overview])).toEqual([
    [null, ''],
    [null, ''],
  ])
})

test('returns at most 20', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ media_type: 'movie', id: i + 1, title: `P${i}` }))
  expect(mergeSearches({ ...none, 'es-AR': many })).toHaveLength(20)
})

test('parseQuery trims and validates', () => {
  expect(parseQuery({ query: '  parásitos ' })).toBe('parásitos')
  for (const body of [{ query: 'a' }, { query: '   ' }, { query: 'x'.repeat(101) }, {}, null, { query: 3 }]) {
    expect(parseQuery(body)).toBeNull()
  }
  expect(parseQuery({ query: 'x'.repeat(100) })).toBe('x'.repeat(100))
})

test('an exact name match in any language goes first, ignoring case and accents', () => {
  const sequel = { media_type: 'movie', id: 772, title: 'Mi pobre angelito 2', original_title: 'Home Alone 2', popularity: 99 }
  const original = { media_type: 'movie', id: 771, title: 'Mi pobre angelito', original_title: 'Home Alone', popularity: 50 }
  const parasite = { media_type: 'movie', id: 496243, title: 'Parásitos', original_title: '기생충', popularity: 10 }
  const ranked = (query: string) => mergeSearches({ 'es-MX': [sequel, original, parasite], 'es-AR': [], 'en-US': [] }, query).map((r) => r.tmdbId)
  expect(ranked('Mi pobre angelito')[0]).toBe(771)
  expect(ranked('home alone')[0]).toBe(771)
  expect(ranked('PARASITOS')[0]).toBe(496243)
  expect(ranked('mi pobre')[0]).toBe(772)
})
