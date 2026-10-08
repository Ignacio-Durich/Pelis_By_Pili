export const PICKS = 3

export type RevealResult = { matches: string[]; only: [string[], string[]]; winner: string | null; roulette: string[] | null }

// Top 3 secreto: primero lo que eligieron los dos. Una coincidencia gana; varias van a la ruleta
// entre ellas; sin coincidencias, la ruleta entre todas. Lo que ya no está en la lista no cuenta.
export function revealResult(picks: [string[], string[]], exists: (id: string) => boolean): RevealResult {
  const [first, second] = picks.map((list) => [...new Set(list)].filter(exists))
  const matches = first.filter((id) => second.includes(id))
  const only: [string[], string[]] = [first.filter((id) => !matches.includes(id)), second.filter((id) => !matches.includes(id))]
  const everyone = [...new Set([...first, ...second])]
  if (matches.length === 1) return { matches, only, winner: matches[0], roulette: null }
  const roulette = matches.length > 1 ? matches : everyone.length > 0 ? everyone : null
  return { matches, only, winner: null, roulette }
}
