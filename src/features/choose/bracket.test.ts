import { expect, test } from 'vitest'
import { buildBracket, roundName, tournamentState, type Decision } from './bracket'

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
  expect(buildBracket(['n1', 'n2', 'n3', 'n4'], ['p1', 'p2', 'p3', 'p4'], [], 4, keep)).toEqual(['n1', 'p1', 'n2', 'p2', 'n3', 'p3', 'n4', 'p4'])
})

test('buildBracket: fills the gaps from the rest without repeating, then leaves holes', () => {
  expect(buildBracket(['n1', 'n2', 'n3'], ['p1', 'p2'], ['n1', 'x1', 'x2', 'x3', 'x4'], 4, keep)).toEqual(['n1', 'p1', 'n2', 'p2', 'n3', 'x1', 'x2', 'x3'])
  expect(buildBracket(['n1'], ['p1'], [], 4, keep)).toEqual(['n1', 'p1', null, null, null, null, null, null])
})

test('buildBracket: with 8 or 16 each, 16 or 32 places, still one of each per duel', () => {
  const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`)
  for (const each of [8, 16]) {
    const slots = buildBracket(ids('n', each), ids('p', each), [], each)
    expect(slots).toHaveLength(2 * each)
    for (let i = 0; i < slots.length; i += 2) {
      expect(slots[i]).toMatch(/^n/)
      expect(slots[i + 1]).toMatch(/^p/)
    }
  }
})

test('roundName: from the round of 32 to the final', () => {
  expect([1, 2, 3, 4, 5].map((r) => roundName(32, r))).toEqual(['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'])
  expect([1, 2, 3].map((r) => roundName(8, r))).toEqual(['Cuartos de final', 'Semifinal', 'Final'])
})

test('a bracket of 16 plays four rounds', () => {
  const slots = Array.from({ length: 16 }, (_, i) => `t${i}`)
  const first = Array.from({ length: 8 }, (_, i) => win(`t${2 * i}`, `t${2 * i + 1}`, `t${2 * i}`))
  expect(tournamentState(slots, first, all)).toEqual({ kind: 'duel', round: 2, index: 1, total: 4, pair: ['t0', 't2'] })
  const second = [win('t0', 't2', 't0'), win('t4', 't6', 't4'), win('t8', 't10', 't8'), win('t12', 't14', 't12')]
  const third = [win('t0', 't4', 't0'), win('t8', 't12', 't8')]
  expect(tournamentState(slots, [...first, ...second, ...third], all)).toEqual({ kind: 'duel', round: 4, index: 1, total: 1, pair: ['t0', 't8'] })
  expect(tournamentState(slots, [...first, ...second, ...third, win('t0', 't8', 't8')], all)).toEqual({ kind: 'winner', titleId: 't8' })
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

test('a title that is gone becomes a hole where it stands, and the losers stay out', () => {
  const exists = (id: string) => id !== 'a'
  // A todavía no jugó: B pasa sola.
  expect(tournamentState(eight, [win('c', 'd', 'c')], exists)).toEqual({ kind: 'duel', round: 1, index: 2, total: 3, pair: ['e', 'f'] })
  // A ya le había ganado a B: B no revive, el hueco queda donde estaba A.
  const quarters = [win('a', 'b', 'a'), win('c', 'd', 'c'), win('e', 'f', 'e'), win('g', 'h', 'g')]
  expect(tournamentState(eight, quarters, exists)).toEqual({ kind: 'duel', round: 2, index: 1, total: 1, pair: ['e', 'g'] })
})
