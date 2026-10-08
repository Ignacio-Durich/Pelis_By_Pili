import { matchesFilters, type Filters } from '../titles/filters'
import type { Title } from '../titles/titlesApi'

export const DECK_SIZE = 30
export const MAX_ROUNDS = 3

export type Vote = { userId: string; round: number; titleId: string; liked: boolean }

export type BumbleState =
  | { kind: 'round'; round: number; cards: string[]; matches: string[]; next: [string | null, string | null]; done: [number, number] }
  | { kind: 'winner'; titleId: string }
  | { kind: 'roulette'; round: number; candidates: string[] }
  | { kind: 'none' }

export function buildDeck(titles: Title[], filters: Filters, random: () => number = Math.random): string[] {
  const ids = titles.filter((t) => t.status === 'to_watch' && matchesFilters(t, filters)).map((t) => t.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, DECK_SIZE)
}

// Los dos celulares (o el único) llegan al mismo estado con los mismos votos: vuelta 1 = el mazo;
// cada vuelta siguiente, los matches de la anterior en el mismo orden.
export function bumbleState(deck: string[], votes: Vote[], players: [string, string]): BumbleState {
  let cards = deck
  for (let round = 1; ; round++) {
    const inRound = votes.filter((v) => v.round === round && cards.includes(v.titleId))
    const vote = (player: string, card: string) => inRound.find((v) => v.userId === player && v.titleId === card)
    const matches = cards.filter((c) => players.every((p) => vote(p, c)?.liked))
    const done = players.map((p) => cards.filter((c) => vote(p, c)).length) as [number, number]

    if (done.some((d) => d < cards.length)) {
      const next = players.map((p) => cards.find((c) => !vote(p, c)) ?? null) as [string | null, string | null]
      return { kind: 'round', round, cards, matches, next, done }
    }
    if (matches.length === 1) return { kind: 'winner', titleId: matches[0] }
    if (matches.length === 0) return round === 1 ? { kind: 'none' } : { kind: 'roulette', round, candidates: cards }
    if (round === MAX_ROUNDS) return { kind: 'roulette', round, candidates: matches }
    cards = matches
  }
}

// El voto que deshace "Deshacer": el último del jugador en la vuelta en curso. Una vuelta que
// terminó para los dos ya se usó, así que sus votos no se deshacen.
export function lastUndoable(deck: string[], votes: Vote[], players: [string, string], player: string): Vote | null {
  const state = bumbleState(deck, votes, players)
  if (state.kind !== 'round') return null
  return votes.findLast((v) => v.userId === player && v.round === state.round && state.cards.includes(v.titleId)) ?? null
}

// FNV-1a: el mismo índice para la misma semilla en los dos celulares.
export function seededIndex(seed: string, count: number): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % count
}
