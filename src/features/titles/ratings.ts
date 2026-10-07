// Cómo se muestra cada puntaje. OMDb los da como texto ("8.5/10", "99%", "97/100" o "N/A").
const MISSING = '—'

const firstNumber = (raw: string | null) => raw?.match(/^\d+(\.\d+)?/)?.[0] ?? MISSING

export const imdbScore = (raw: string | null) => firstNumber(raw)
export const metacriticScore = (raw: string | null) => firstNumber(raw)
export const rtScore = (raw: string | null) => (raw && /^\d+%$/.test(raw) ? raw : MISSING)
export const tmdbScore = (n: number | null) => (n === null ? MISSING : n.toFixed(1))

export const ratingsDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
