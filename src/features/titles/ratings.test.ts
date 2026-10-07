import { expect, test } from 'vitest'
import { imdbScore, metacriticScore, ratingsDate, rtScore, tmdbScore } from './ratings'

test('formats each score', () => {
  expect(imdbScore('8.5/10')).toBe('8.5')
  expect(rtScore('99%')).toBe('99%')
  expect(metacriticScore('97/100')).toBe('97')
  expect(tmdbScore(8.5)).toBe('8.5')
  expect(tmdbScore(8)).toBe('8.0')
})

test('missing or unreadable values are shown as —', () => {
  for (const raw of ['N/A', '', null]) {
    expect(imdbScore(raw)).toBe('—')
    expect(rtScore(raw)).toBe('—')
    expect(metacriticScore(raw)).toBe('—')
  }
  expect(tmdbScore(null)).toBe('—')
})

test('ratingsDate uses the Argentine date', () => {
  expect(ratingsDate('2026-10-07T15:00:00Z')).toBe('7/10/2026')
  expect(ratingsDate('2026-10-08T01:00:00Z')).toBe('7/10/2026')
})
