import { expect, test } from 'vitest'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS } from '../titles/filters'
import { bumbleState, buildDeck, lastUndoable, seededIndex, type Vote } from './bumbleLogic'

const players: [string, string] = ['n', 'p']
const v = (userId: string, titleId: string, liked: boolean, round = 1): Vote => ({ userId, round, titleId, liked })
// Los dos votan todas las cartas: `likes[i]` son las que le gustan al jugador i.
const both = (cards: string[], likes: [string[], string[]], round = 1) =>
  players.flatMap((p, i) => cards.map((c) => v(p, c, likes[i].includes(c), round)))

test('buildDeck: only titles to watch that match the filters, at most 30, no repeats', () => {
  const titles = Array.from({ length: 35 }, (_, i) => makeTitle({ id: `t${i}`, tmdbId: i, genres: [i % 2 ? 'Drama' : 'Comedia'] }))
  const watched = makeTitle({ id: 'w', tmdbId: 99, status: 'watched', watchedAt: '2026-10-07T00:00:00Z' })
  const deck = buildDeck([...titles, watched], NO_FILTERS)
  expect(deck).toHaveLength(30)
  expect(new Set(deck).size).toBe(30)
  expect(deck).not.toContain('w')
  const dramas = buildDeck(titles, { ...NO_FILTERS, genres: ['Drama'] })
  expect(dramas.every((id) => Number(id.slice(1)) % 2 === 1)).toBe(true)
  expect(dramas).toHaveLength(17)
})

test('buildDeck: shuffles with the given random', () => {
  const titles = ['a', 'b', 'c', 'd'].map((id, i) => makeTitle({ id, tmdbId: i }))
  expect(buildDeck(titles, NO_FILTERS, () => 0.999)).toEqual(['a', 'b', 'c', 'd'])
  expect(buildDeck(titles, NO_FILTERS, () => 0)).not.toEqual(['a', 'b', 'c', 'd'])
})

test('without votes: round 1 with the first card for both', () => {
  expect(bumbleState(['a', 'b', 'c'], [], players)).toEqual({
    kind: 'round',
    round: 1,
    cards: ['a', 'b', 'c'],
    matches: [],
    next: ['a', 'a'],
    done: [0, 0],
  })
})

test('a match is a yes from both; next and done follow each player', () => {
  const s = bumbleState(['a', 'b', 'c'], [v('n', 'a', true), v('p', 'a', true), v('n', 'b', true), v('p', 'b', false), v('p', 'c', true)], players)
  expect(s).toMatchObject({ kind: 'round', round: 1, matches: ['a'], next: ['c', null], done: [2, 3] })
})

test('when both finish: one match wins, none is no match', () => {
  expect(bumbleState(['a', 'b'], both(['a', 'b'], [['b'], ['a', 'b']]), players)).toEqual({ kind: 'winner', titleId: 'b' })
  expect(bumbleState(['a', 'b'], both(['a', 'b'], [['a'], ['b']]), players)).toEqual({ kind: 'none' })
})

test('several matches go to a second round with only them, in deck order', () => {
  const deck = ['a', 'b', 'c', 'd']
  const s = bumbleState(deck, both(deck, [['d', 'a', 'c'], ['a', 'c', 'd']]), players)
  expect(s).toMatchObject({ kind: 'round', round: 2, cards: ['a', 'c', 'd'], matches: [], next: ['a', 'a'], done: [0, 0] })
})

test('round 2: one match wins, none goes to the roulette with that round cards', () => {
  const deck = ['a', 'b', 'c']
  const r1 = both(deck, [deck, deck])
  expect(bumbleState(deck, [...r1, ...both(deck, [['b'], ['b', 'c']], 2)], players)).toEqual({ kind: 'winner', titleId: 'b' })
  expect(bumbleState(deck, [...r1, ...both(deck, [['a'], ['b']], 2)], players)).toEqual({ kind: 'roulette', round: 2, candidates: deck })
})

test('after the third round still tied, the roulette decides among the matches', () => {
  const deck = ['a', 'b', 'c']
  const votes = [...both(deck, [deck, deck]), ...both(deck, [deck, deck], 2), ...both(deck, [['a', 'c'], ['a', 'c']], 3)]
  expect(bumbleState(deck, votes, players)).toEqual({ kind: 'roulette', round: 3, candidates: ['a', 'c'] })
})

test('votes for titles no longer in the deck do not count', () => {
  const s = bumbleState(['a', 'b'], [v('n', 'gone', true), v('p', 'gone', true), ...both(['a', 'b'], [['a'], ['a']])], players)
  expect(s).toEqual({ kind: 'winner', titleId: 'a' })
  expect(bumbleState(['a'], [v('n', 'gone', true)], players)).toMatchObject({ kind: 'round', done: [0, 0] })
})

test('lastUndoable: the player last vote in the round in progress', () => {
  const deck = ['a', 'b', 'c']
  expect(lastUndoable(deck, [], players, 'n')).toBeNull()
  const votes = [v('n', 'a', true), v('p', 'a', true), v('n', 'b', false)]
  expect(lastUndoable(deck, votes, players, 'n')).toEqual(v('n', 'b', false))
  expect(lastUndoable(deck, votes, players, 'p')).toEqual(v('p', 'a', true))
  // Terminada la vuelta 1 para los dos, sus votos ya no se deshacen.
  const r1 = both(deck, [['a', 'b'], ['a', 'b']])
  expect(lastUndoable(deck, r1, players, 'n')).toBeNull()
  expect(lastUndoable(deck, [...r1, v('n', 'a', true, 2)], players, 'n')).toEqual(v('n', 'a', true, 2))
  expect(lastUndoable(deck, both(deck, [['a'], ['a']]), players, 'n')).toBeNull()
})

test('seededIndex: same seed same index, always in range, and it varies', () => {
  expect(seededIndex('s1:2', 5)).toBe(seededIndex('s1:2', 5))
  const seen = new Set(Array.from({ length: 20 }, (_, i) => seededIndex(`session-${i}:1`, 5)))
  for (const i of seen) expect(i).toBeGreaterThanOrEqual(0)
  for (const i of seen) expect(i).toBeLessThan(5)
  expect(seen.size).toBeGreaterThan(1)
})
