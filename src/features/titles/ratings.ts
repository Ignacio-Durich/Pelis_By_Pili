// Cómo se muestra cada puntaje. OMDb los da como texto ("8.5/10", "99%", "97/100" o "N/A").
// Sin dato, null: lo que falta no se muestra (antes salía "—").
const firstNumber = (raw: string | null) => raw?.match(/^\d+(\.\d+)?/)?.[0] ?? null

export const imdbScore = (raw: string | null) => firstNumber(raw)
export const metacriticScore = (raw: string | null) => firstNumber(raw)
export const rtScore = (raw: string | null) => (raw && /^\d+%$/.test(raw) ? raw : null)
export const tmdbScore = (n: number | null) => (n === null ? null : n.toFixed(1))

// Los puntajes que hay, en una línea ("IMDb 8.5 · RT 92%"); sin ninguno, null.
export function scoreLine(scores: [label: string, value: string | null][]): string | null {
  const shown = scores.flatMap(([label, value]) => (value === null ? [] : [`${label} ${value}`]))
  return shown.length ? shown.join(' · ') : null
}

export const ratingsDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

// Puntaje propio: del 1 al 10 con hasta 2 decimales, escrito con coma o punto.
export const formatScore = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

export function parseScore(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean)) return null
  const n = Number(clean)
  return n >= 1 && n <= 10 ? n : null
}
