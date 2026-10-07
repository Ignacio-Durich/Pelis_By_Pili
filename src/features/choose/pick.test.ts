import { expect, test } from 'vitest'
import { pick } from './pick'

test('pick takes one at random, or null when there is nothing', () => {
  expect(pick(['a', 'b', 'c'], () => 0.5)).toBe('b')
  expect(pick(['a', 'b', 'c'], () => 0.999)).toBe('c')
  expect(pick(['a'], () => 0)).toBe('a')
  expect(pick([], () => 0.5)).toBeNull()
})
