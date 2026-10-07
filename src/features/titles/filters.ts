import type { Title } from './titlesApi'

export type Filters = {
  type: 'all' | 'movie' | 'tv'
  maxRuntime: number | null
  minImdb: number | null
  genres: string[]
  platforms: string[]
}

export const NO_FILTERS: Filters = { type: 'all', maxRuntime: null, minImdb: null, genres: [], platforms: [] }

export function activeCount(f: Filters): number {
  return [f.type !== 'all', f.maxRuntime !== null, f.minImdb !== null, f.genres.length > 0, f.platforms.length > 0].filter(Boolean)
    .length
}

// Con un filtro activo, un título sin ese dato no pasa (con "Netflix" elegido, solo lo que está en Netflix).
export function matchesFilters(t: Title, f: Filters): boolean {
  if (f.type !== 'all' && t.mediaType !== f.type) return false
  if (f.maxRuntime !== null && (t.runtime === null || t.runtime > f.maxRuntime)) return false
  if (f.minImdb !== null) {
    const imdb = t.imdbRating ? parseFloat(t.imdbRating) : NaN
    if (!(imdb >= f.minImdb)) return false
  }
  if (f.genres.length > 0 && !f.genres.some((g) => t.genres.includes(g))) return false
  if (f.platforms.length > 0 && !f.platforms.some((p) => t.streaming.includes(p))) return false
  return true
}

const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'))

export function filterOptions(titles: Title[]): { genres: string[]; platforms: string[] } {
  return { genres: sorted(titles.flatMap((t) => t.genres)), platforms: sorted(titles.flatMap((t) => t.streaming)) }
}
