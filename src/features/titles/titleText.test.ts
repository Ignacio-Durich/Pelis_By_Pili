import { expect, test } from 'vitest'
import { kindLine, posterLine } from './titleText'

test('kindLine says the runtime of a series is per episode', () => {
  expect(kindLine(2010, 'movie', null, 148)).toBe('2010 · Película · 2 h 28')
  expect(kindLine(2015, 'tv', 6, 70)).toBe('2015 · Serie · 6 temporadas · 1 h 10 por episodio')
  expect(kindLine(null, 'tv', 1)).toBe('Serie · 1 temporada')
})

test('the poster line adds how long a movie lasts, but not a series episode', () => {
  expect(posterLine(2010, 'movie', 148)).toBe('2010 · Película · 2 h 28')
  expect(posterLine(2008, 'tv', 47)).toBe('2008 · Serie')
  expect(posterLine(null, 'movie', null)).toBe('Película')
})
