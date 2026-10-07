// Cómo se muestra cada puntaje. OMDb los da como texto ("8.5/10", "99%", "97/100" o "N/A").
const MISSING = '—'

const firstNumber = (raw: string | null) => raw?.match(/^\d+(\.\d+)?/)?.[0] ?? MISSING

export const imdbScore = (raw: string | null) => firstNumber(raw)
export const metacriticScore = (raw: string | null) => firstNumber(raw)
export const rtScore = (raw: string | null) => (raw && /^\d+%$/.test(raw) ? raw : MISSING)
export const tmdbScore = (n: number | null) => (n === null ? MISSING : n.toFixed(1))

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
