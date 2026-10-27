import { expect, test } from 'vitest'
import { formatScore, imdbScore, metacriticScore, parseScore, ratingsDate, rtScore, scoreLine, tmdbScore } from './ratings'

test('formats each score', () => {
  expect(imdbScore('8.5/10')).toBe('8.5')
  expect(rtScore('99%')).toBe('99%')
  expect(metacriticScore('97/100')).toBe('97')
  expect(tmdbScore(8.5)).toBe('8.5')
  expect(tmdbScore(8)).toBe('8.0')
})

test('missing or unreadable values are null, so they are not shown', () => {
  for (const raw of ['N/A', '', null]) {
    expect(imdbScore(raw)).toBeNull()
    expect(rtScore(raw)).toBeNull()
    expect(metacriticScore(raw)).toBeNull()
  }
  expect(tmdbScore(null)).toBeNull()
})

test('scoreLine joins only the scores there are, or is null without any', () => {
  expect(scoreLine([['IMDb', '8.5'], ['RT', '92%']])).toBe('IMDb 8.5 · RT 92%')
  expect(scoreLine([['IMDb', '9.0'], ['RT', null]])).toBe('IMDb 9.0')
  expect(scoreLine([['IMDb', null], ['RT', null]])).toBeNull()
})

test('ratingsDate uses the Argentine date', () => {
  expect(ratingsDate('2026-10-07T15:00:00Z')).toBe('7/10/2026')
  expect(ratingsDate('2026-10-08T01:00:00Z')).toBe('7/10/2026')
})

test('formatScore uses a comma and no extra zeros', () => {
  expect(formatScore(8)).toBe('8')
  expect(formatScore(8.5)).toBe('8,5')
  expect(formatScore(8.75)).toBe('8,75')
  expect(formatScore(10)).toBe('10')
})

test('parseScore accepts 1 to 10 with up to 2 decimals, with comma or dot', () => {
  expect(parseScore('8,75')).toBe(8.75)
  expect(parseScore('8.75')).toBe(8.75)
  expect(parseScore(' 9 ')).toBe(9)
  expect(parseScore('10')).toBe(10)
  expect(parseScore('1')).toBe(1)
  for (const text of ['0,5', '10,5', '8,755', 'abc', '', '8,', ',5']) expect(parseScore(text)).toBeNull()
})
