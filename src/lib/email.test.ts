import { expect, test } from 'vitest'
import { isPlausibleEmail, normalizeEmail } from './email'

test('normalizeEmail trims and lowercases', () => {
  expect(normalizeEmail('  Tomas@Gmail.COM ')).toBe('tomas@gmail.com')
})

test('isPlausibleEmail rejects obviously wrong values', () => {
  expect(isPlausibleEmail('tomas')).toBe(false)
  expect(isPlausibleEmail('a@b')).toBe(false)
  expect(isPlausibleEmail('')).toBe(false)
})

test('isPlausibleEmail accepts a normal address', () => {
  expect(isPlausibleEmail('tomas@gmail.com')).toBe(true)
})
