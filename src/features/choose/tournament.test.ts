import { expect, test } from 'vitest'
import { buildBracket, tournamentState, type Decision } from './tournament'

const keep = () => 0.999
const all = () => true
const win = (a: string, b: string, winner: string): Decision => ({ pair: [a, b], winner })

test('buildBracket: each first-round duel is one of each', () => {
  const slots = buildBracket(['n1', 'n2', 'n3', 'n4'], ['p1', 'p2', 'p3', 'p4'], [])
  expect(slots).toHaveLength(8)
  for (let i = 0; i < 8; i += 2) {
    expect(slots[i]).toMatch(/^n/)
    expect(slots[i + 1]).toMatch(/^p/)
  }
  expect(buildBracket(['n1', 'n2', 'n3', 'n4'], ['p1', 'p2', 'p3', 'p4'], [], keep)).toEqual(['n1', 'p1', 'n2', 'p2', 'n3', 'p3', 'n4', 'p4'])
})

test('buildBracket: fills the gaps from the rest without repeating, then leaves holes', () => {
  expect(buildBracket(['n1', 'n2', 'n3'], ['p1', 'p2'], ['n1', 'x1', 'x2', 'x3', 'x4'], keep)).toEqual(['n1', 'p1', 'n2', 'p2', 'n3', 'x1', 'x2', 'x3'])
  expect(buildBracket(['n1'], ['p1'], [], keep)).toEqual(['n1', 'p1', null, null, null, null, null, null])
})

const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

test('the first duel of the quarter finals, then the semis, then a winner', () => {
  expect(tournamentState(eight, [], all)).toEqual({ kind: 'duel', round: 1, index: 1, total: 4, pair: ['a', 'b'] })
  const quarters = [win('a', 'b', 'a'), win('c', 'd', 'd'), win('e', 'f', 'f'), win('g', 'h', 'g')]
  expect(tournamentState(eight, quarters, all)).toEqual({ kind: 'duel', round: 2, index: 1, total: 2, pair: ['a', 'd'] })
  const semis = [...quarters, win('a', 'd', 'd'), win('f', 'g', 'f')]
  expect(tournamentState(eight, semis, all)).toEqual({ kind: 'duel', round: 3, index: 1, total: 1, pair: ['d', 'f'] })
  expect(tournamentState(eight, [...semis, win('f', 'd', 'f')], all)).toEqual({ kind: 'winner', titleId: 'f' })
})

test('a decision for another duel is ignored', () => {
  expect(tournamentState(eight, [win('a', 'c', 'a')], all)).toMatchObject({ kind: 'duel', round: 1, index: 1, pair: ['a', 'b'] })
})

test('holes pass the other one without a duel', () => {
  const three = ['a', 'b', 'c', null, null, null, null, null]
  expect(tournamentState(three, [], all)).toEqual({ kind: 'duel', round: 1, index: 1, total: 1, pair: ['a', 'b'] })
  expect(tournamentState(three, [win('a', 'b', 'b')], all)).toEqual({ kind: 'duel', round: 2, index: 1, total: 1, pair: ['b', 'c'] })
  expect(tournamentState(['a', null, null, null, null, null, null, null], [], all)).toEqual({ kind: 'winner', titleId: 'a' })
  expect(tournamentState(Array(8).fill(null), [], all)).toEqual({ kind: 'none' })
})

test('a title that is gone becomes a hole, and its old decisions do not get in the way', () => {
  const exists = (id: string) => id !== 'a'
  const decided = [win('a', 'b', 'a'), win('c', 'd', 'c')]
  expect(tournamentState(eight, decided, exists)).toEqual({ kind: 'duel', round: 1, index: 2, total: 3, pair: ['e', 'f'] })
})
