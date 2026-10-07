import type { Title } from './titlesApi'

export type Filters = {
  type: 'all' | 'movie' | 'tv'
  // Rangos [mínimo, máximo]: el rango completo es "cualquiera".
  runtime: [number, number]
  imdb: [number, number]
  genres: string[]
  platforms: string[]
}

// Duración en minutos, de a media hora; el tope (4 h) significa "o más". IMDb de a un punto.
export const RUNTIME_RANGE = { min: 0, max: 240, step: 30 }
export const IMDB_RANGE = { min: 1, max: 10, step: 1 }

export const NO_FILTERS: Filters = {
  type: 'all',
  runtime: [RUNTIME_RANGE.min, RUNTIME_RANGE.max],
  imdb: [IMDB_RANGE.min, IMDB_RANGE.max],
  genres: [],
  platforms: [],
}

const isFull = ([low, high]: [number, number], range: { min: number; max: number }) => low === range.min && high === range.max

export function activeCount(f: Filters): number {
  return [
    f.type !== 'all',
    !isFull(f.runtime, RUNTIME_RANGE),
    !isFull(f.imdb, IMDB_RANGE),
    f.genres.length > 0,
    f.platforms.length > 0,
  ].filter(Boolean).length
}

// Con un filtro activo, un título sin ese dato no pasa (con "Netflix" elegido, solo lo que está en Netflix).
export function matchesFilters(t: Title, f: Filters): boolean {
  if (f.type !== 'all' && t.mediaType !== f.type) return false
  if (!isFull(f.runtime, RUNTIME_RANGE)) {
    const [low, high] = f.runtime
    // El tope de la barra no pone techo: "4 h o más".
    if (t.runtime === null || t.runtime < low || (high < RUNTIME_RANGE.max && t.runtime > high)) return false
  }
  if (!isFull(f.imdb, IMDB_RANGE)) {
    const imdb = t.imdbRating ? parseFloat(t.imdbRating) : NaN
    if (!(imdb >= f.imdb[0] && imdb <= f.imdb[1])) return false
  }
  if (f.genres.length > 0 && !f.genres.some((g) => t.genres.includes(g))) return false
  if (f.platforms.length > 0 && !f.platforms.some((p) => t.streaming.includes(p))) return false
  return true
}

const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'))

export function filterOptions(titles: Title[]): { genres: string[]; platforms: string[] } {
  return { genres: sorted(titles.flatMap((t) => t.genres)), platforms: sorted(titles.flatMap((t) => t.streaming)) }
}

// "30 min", "1 h", "1 h 30"
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60}` : `${h} h`
}

export function runtimeText([low, high]: [number, number]): string {
  if (isFull([low, high], RUNTIME_RANGE)) return 'Cualquier duración'
  if (low === RUNTIME_RANGE.min) return `Hasta ${formatMinutes(high)}`
  if (high === RUNTIME_RANGE.max) return `Desde ${formatMinutes(low)}`
  return `Entre ${formatMinutes(low)} y ${formatMinutes(high)}`
}

export function imdbText([low, high]: [number, number]): string {
  if (isFull([low, high], IMDB_RANGE)) return 'Cualquier puntaje'
  if (low === IMDB_RANGE.min) return `Hasta ${high}`
  if (high === IMDB_RANGE.max) return `${low} o más`
  return `Entre ${low} y ${high}`
}
