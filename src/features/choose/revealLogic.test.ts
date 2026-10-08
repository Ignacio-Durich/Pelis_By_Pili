import { expect, test } from 'vitest'
import { revealResult } from './revealLogic'

const all = () => true

test('one match wins, the rest is each one alone', () => {
  expect(revealResult([['a', 'b', 'c'], ['d', 'b', 'e']], all)).toEqual({
    matches: ['b'],
    only: [['a', 'c'], ['d', 'e']],
    winner: 'b',
    roulette: null,
  })
})

test('two or three matches go to the roulette among them', () => {
  expect(revealResult([['a', 'b', 'c'], ['c', 'a', 'e']], all)).toMatchObject({ matches: ['a', 'c'], winner: null, roulette: ['a', 'c'] })
  expect(revealResult([['a', 'b', 'c'], ['c', 'b', 'a']], all)).toMatchObject({ matches: ['a', 'b', 'c'], only: [[], []], roulette: ['a', 'b', 'c'] })
})

test('no match: the roulette among all six', () => {
  expect(revealResult([['a', 'b', 'c'], ['d', 'e', 'f']], all)).toEqual({
    matches: [],
    only: [['a', 'b', 'c'], ['d', 'e', 'f']],
    winner: null,
    roulette: ['a', 'b', 'c', 'd', 'e', 'f'],
  })
})

test('titles no longer in the list are left out', () => {
  const exists = (id: string) => id !== 'b'
  expect(revealResult([['a', 'b'], ['b', 'c']], exists)).toEqual({ matches: [], only: [['a'], ['c']], winner: null, roulette: ['a', 'c'] })
  expect(revealResult([['b'], ['b']], exists)).toEqual({ matches: [], only: [[], []], winner: null, roulette: null })
})
