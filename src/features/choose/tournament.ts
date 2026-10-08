export const TOURNAMENT_PICKS = 4
export const BRACKET = 8

export type Round = 1 | 2 | 3

export const ROUND_NAMES: Record<Round, string> = { 1: 'Cuartos de final', 2: 'Semifinal', 3: 'Final' }

// Un duelo decidido. Se guarda con su par (y no solo el ganador) para que, si un título se borra a
// mitad del torneo, las decisiones de los demás duelos sigan valiendo.
export type Decision = { pair: [string, string]; winner: string }

export type TournamentState =
  | { kind: 'duel'; round: Round; index: number; total: number; pair: [string, string] }
  | { kind: 'winner'; titleId: string }
  | { kind: 'none' }

function shuffled<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// 8 lugares; el 2i y el 2i+1 son el duelo i de cuartos: una de cada uno. Lo que falta se completa
// con `fill` y, si no alcanza, queda vacío (esa candidata pasa sola de ronda).
export function buildBracket(first: string[], second: string[], fill: string[], random: () => number = Math.random): (string | null)[] {
  const a = shuffled(first, random)
  const b = shuffled(second, random)
  const slots: (string | null)[] = Array.from({ length: BRACKET }, (_, i) => (i % 2 === 0 ? a[i / 2] : b[(i - 1) / 2]) ?? null)
  const extra = shuffled(
    fill.filter((id) => !slots.includes(id)),
    random,
  )
  return slots.map((slot) => slot ?? extra.shift() ?? null)
}

export function tournamentState(slots: (string | null)[], decisions: Decision[], exists: (id: string) => boolean): TournamentState {
  const decided = (a: string, b: string) => decisions.find((d) => d.pair.includes(a) && d.pair.includes(b) && (d.winner === a || d.winner === b))?.winner
  let current = slots.map((slot) => (slot && exists(slot) ? slot : null))

  for (const round of [1, 2, 3] as Round[]) {
    const pairs = Array.from({ length: current.length / 2 }, (_, i) => [current[2 * i], current[2 * i + 1]] as const)
    const total = pairs.filter(([a, b]) => a && b).length
    const next: (string | null)[] = []
    let index = 0
    for (const [a, b] of pairs) {
      if (!a || !b) {
        next.push(a ?? b)
        continue
      }
      index++
      const winner = decided(a, b)
      if (!winner) return { kind: 'duel', round, index, total, pair: [a, b] }
      next.push(winner)
    }
    current = next
  }
  return current[0] ? { kind: 'winner', titleId: current[0] } : { kind: 'none' }
}
