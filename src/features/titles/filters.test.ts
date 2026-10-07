import { expect, test } from 'vitest'
import { makeTitle } from '../../test/titles'
import { activeCount, filterOptions, matchesFilters, NO_FILTERS, type Filters } from './filters'

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

test('max runtime, and a title without runtime does not pass', () => {
  expect(matchesFilters(parasitos, f({ maxRuntime: 120 }))).toBe(false)
  expect(matchesFilters(parasitos, f({ maxRuntime: 150 }))).toBe(true)
  expect(matchesFilters(bare, f({ maxRuntime: 150 }))).toBe(false)
})

test('min IMDb, and a title without IMDb does not pass', () => {
  expect(matchesFilters(parasitos, f({ minImdb: 8 }))).toBe(true)
  expect(matchesFilters(parasitos, f({ minImdb: 9 }))).toBe(false)
  expect(matchesFilters(bare, f({ minImdb: 6 }))).toBe(false)
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
  expect(matchesFilters(dark, f({ type: 'tv', platforms: ['Netflix'], minImdb: 8 }))).toBe(true)
  expect(matchesFilters(dark, f({ type: 'tv', platforms: ['Netflix'], minImdb: 9 }))).toBe(false)
})

test('activeCount counts each active filter once', () => {
  expect(activeCount(NO_FILTERS)).toBe(0)
  expect(activeCount(f({ type: 'tv', genres: ['Drama', 'Comedia'], minImdb: 7 }))).toBe(3)
})

test('filterOptions lists genres and platforms without repeats, alphabetically', () => {
  expect(filterOptions([parasitos, dark, bare])).toEqual({
    genres: ['Ciencia ficción', 'Comedia', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
  })
})
