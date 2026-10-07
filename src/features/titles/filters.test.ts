import { expect, test } from 'vitest'
import { makeTitle } from '../../test/titles'
import { activeCount, filterOptions, imdbText, matchesFilters, NO_FILTERS, runtimeText, type Filters } from './filters'

const parasitos = makeTitle({ runtime: 132, imdbRating: '8.5/10', genres: ['Comedia', 'Drama'], streaming: ['Netflix', 'Prime Video'] })
const dark = makeTitle({ mediaType: 'tv', runtime: 60, imdbRating: '8.7/10', genres: ['Ciencia ficción', 'Drama'], streaming: ['Netflix'] })
const bare = makeTitle()
const f = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over })

test('with no filters every title passes, even without data', () => {
  for (const t of [parasitos, dark, bare]) expect(matchesFilters(t, NO_FILTERS)).toBe(true)
})

test('type filter', () => {
  expect(matchesFilters(parasitos, f({ type: 'movie' }))).toBe(true)
  expect(matchesFilters(dark, f({ type: 'movie' }))).toBe(false)
  expect(matchesFilters(dark, f({ type: 'tv' }))).toBe(true)
})

test('runtime range, ends included, and a title without runtime does not pass', () => {
  expect(matchesFilters(parasitos, f({ runtime: [0, 120] }))).toBe(false)
  expect(matchesFilters(parasitos, f({ runtime: [0, 150] }))).toBe(true)
  expect(matchesFilters(parasitos, f({ runtime: [150, 240] }))).toBe(false)
  expect(matchesFilters(dark, f({ runtime: [60, 90] }))).toBe(true)
  expect(matchesFilters(bare, f({ runtime: [0, 150] }))).toBe(false)
})

test('the top of the runtime range has no ceiling', () => {
  const long = makeTitle({ runtime: 300 })
  expect(matchesFilters(long, f({ runtime: [120, 240] }))).toBe(true)
})

test('IMDb range, ends included, and a title without IMDb does not pass', () => {
  expect(matchesFilters(parasitos, f({ imdb: [8, 10] }))).toBe(true)
  expect(matchesFilters(parasitos, f({ imdb: [9, 10] }))).toBe(false)
  expect(matchesFilters(parasitos, f({ imdb: [1, 8] }))).toBe(false)
  expect(matchesFilters(dark, f({ imdb: [8, 9] }))).toBe(true)
  expect(matchesFilters(bare, f({ imdb: [6, 10] }))).toBe(false)
})

test('genres: any of the chosen ones', () => {
  expect(matchesFilters(parasitos, f({ genres: ['Comedia'] }))).toBe(true)
  expect(matchesFilters(dark, f({ genres: ['Comedia'] }))).toBe(false)
  expect(matchesFilters(dark, f({ genres: ['Comedia', 'Ciencia ficción'] }))).toBe(true)
})

test('platforms: only titles on a chosen platform, never ones without platforms', () => {
  const onlyPrime = makeTitle({ streaming: ['Prime Video'] })
  expect(matchesFilters(dark, f({ platforms: ['Netflix'] }))).toBe(true)
  expect(matchesFilters(onlyPrime, f({ platforms: ['Netflix'] }))).toBe(false)
  expect(matchesFilters(bare, f({ platforms: ['Netflix'] }))).toBe(false)
  expect(matchesFilters(onlyPrime, f({ platforms: ['Netflix', 'Prime Video'] }))).toBe(true)
})

test('all active filters must hold', () => {
  expect(matchesFilters(dark, f({ type: 'tv', platforms: ['Netflix'], imdb: [8, 10] }))).toBe(true)
  expect(matchesFilters(dark, f({ type: 'tv', platforms: ['Netflix'], imdb: [9, 10] }))).toBe(false)
})

test('activeCount counts each active filter once', () => {
  expect(activeCount(NO_FILTERS)).toBe(0)
  expect(activeCount(f({ type: 'tv', genres: ['Drama', 'Comedia'], imdb: [7, 10] }))).toBe(3)
  expect(activeCount(f({ runtime: [30, 240], imdb: [1, 9] }))).toBe(2)
})

test('filterOptions lists genres and platforms without repeats, alphabetically', () => {
  expect(filterOptions([parasitos, dark, bare])).toEqual({
    genres: ['Ciencia ficción', 'Comedia', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
  })
})

test('range texts', () => {
  expect(runtimeText([0, 240])).toBe('Cualquier duración')
  expect(runtimeText([0, 120])).toBe('Hasta 2 h')
  expect(runtimeText([90, 240])).toBe('Desde 1 h 30')
  expect(runtimeText([60, 150])).toBe('Entre 1 h y 2 h 30')
  expect(runtimeText([0, 30])).toBe('Hasta 30 min')
  expect(imdbText([1, 10])).toBe('Cualquier puntaje')
  expect(imdbText([6, 10])).toBe('6 o más')
  expect(imdbText([1, 8])).toBe('Hasta 8')
  expect(imdbText([6, 8])).toBe('Entre 6 y 8')
})
