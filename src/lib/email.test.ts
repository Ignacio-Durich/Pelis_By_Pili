import { expect, test } from 'vitest'
import { isPlausibleEmail, normalizeEmail } from './email'

test('normalizeEmail trims and lowercases', () => {
  expect(normalizeEmail('  Nacho@Gmail.COM ')).toBe('nacho@gmail.com')
})

test('isPlausibleEmail rejects obviously wrong values', () => {
  expect(isPlausibleEmail('nacho')).toBe(false)
  expect(isPlausibleEmail('a@b')).toBe(false)
  expect(isPlausibleEmail('')).toBe(false)
})

test('isPlausibleEmail accepts a normal address', () => {
  expect(isPlausibleEmail('nacho@gmail.com')).toBe(true)
})
