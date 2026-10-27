import { shuffled } from './pick'

// Cuántas elige cada uno; la primera es la de siempre. El cuadro tiene el doble de lugares.
export const TOURNAMENT_PICKS = [4, 8, 16] as const

// Por cuántos duelos tiene la ronda.
const ROUND_NAMES: Record<number, string> = { 16: 'Dieciseisavos de final', 8: 'Octavos de final', 4: 'Cuartos de final', 2: 'Semifinal', 1: 'Final' }

export function roundName(places: number, round: number): string {
  return ROUND_NAMES[places >> round]
}

// Un duelo decidido. Se guarda con su par (y no solo el ganador) para que, si un título se borra a
// mitad del torneo, las decisiones de los demás duelos sigan valiendo.
export type Decision = { pair: [string, string]; winner: string }

export type TournamentState =
  | { kind: 'duel'; round: number; index: number; total: number; pair: [string, string] }
  | { kind: 'winner'; titleId: string }
  | { kind: 'none' }

// 2 × `each` lugares; el 2i y el 2i+1 son el duelo i de la primera ronda: una de cada uno. Lo que
// falta se completa con `fill` y, si no alcanza, queda vacío (esa candidata pasa sola de ronda).
export function buildBracket(first: string[], second: string[], fill: string[], each: number = TOURNAMENT_PICKS[0], random: () => number = Math.random): (string | null)[] {
  const a = shuffled(first, random)
  const b = shuffled(second, random)
  const slots: (string | null)[] = Array.from({ length: 2 * each }, (_, i) => (i % 2 === 0 ? a[i / 2] : b[(i - 1) / 2]) ?? null)
  const extra = shuffled(
    fill.filter((id) => !slots.includes(id)),
    random,
  )
  return slots.map((slot) => slot ?? extra.shift() ?? null)
}

// Un título que se borró o se marcó como visto queda como hueco donde está: si su duelo no se jugó,
// pasa el rival; si ya lo había ganado, el hueco sigue en su lugar (la que perdió no revive).
export function tournamentState(slots: (string | null)[], decisions: Decision[], exists: (id: string) => boolean): TournamentState {
  const decided = (a: string, b: string) => decisions.find((d) => d.pair.includes(a) && d.pair.includes(b) && (d.winner === a || d.winner === b))?.winner
  let current = slots

  for (let round = 1; current.length > 1; round++) {
    const pairs = Array.from({ length: current.length / 2 }, (_, i) => [current[2 * i], current[2 * i + 1]] as const)
    const isDuel = ([a, b]: readonly [string | null, string | null]) => !!a && !!b && (!!decided(a, b) || (exists(a) && exists(b)))
    const total = pairs.filter(isDuel).length
    const next: (string | null)[] = []
    let index = 0
    for (const [a, b] of pairs) {
      const winner = a && b ? decided(a, b) : undefined
      if (winner) {
        index++
        next.push(exists(winner) ? winner : null)
        continue
      }
      const left = a && exists(a) ? a : null
      const right = b && exists(b) ? b : null
      if (!left || !right) {
        next.push(left ?? right)
        continue
      }
      index++
      return { kind: 'duel', round, index, total, pair: [left, right] }
    }
    current = next
  }
  return current[0] ? { kind: 'winner', titleId: current[0] } : { kind: 'none' }
}
