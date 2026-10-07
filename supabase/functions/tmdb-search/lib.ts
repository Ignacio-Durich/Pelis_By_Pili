// Lógica pura de la búsqueda (sin APIs de Deno), para poder testearla con Vitest.

// El idioma cambia con qué nombres compara TMDB: buscar en los tres encuentra el título
// por su nombre latino, el de España o el inglés.
export const SEARCH_LANGUAGES = ['es-MX', 'es-AR', 'en-US'] as const
type Language = (typeof SEARCH_LANGUAGES)[number]

export type SearchResult = {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  originalTitle: string
  year: number | null
  posterPath: string | null
  overview: string
}

type TmdbItem = {
  media_type?: string
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  popularity?: number
}

export function parseQuery(body: unknown): string | null {
  const query = (body as { query?: unknown } | null)?.query
  if (typeof query !== 'string') return null
  const trimmed = query.trim()
  return trimmed.length >= 2 && trimmed.length <= 100 ? trimmed : null
}

export function mergeSearches(byLanguage: Record<Language, unknown[]>): SearchResult[] {
  const found = new Map<string, { best: number; byLanguage: Partial<Record<Language, TmdbItem>> }>()
  for (const language of SEARCH_LANGUAGES) {
    const items = (byLanguage[language] as TmdbItem[]).filter((i) => i.media_type === 'movie' || i.media_type === 'tv')
    items.forEach((item, position) => {
      const key = `${item.media_type}:${item.id}`
      const entry = found.get(key) ?? { best: position, byLanguage: {} }
      entry.best = Math.min(entry.best, position)
      entry.byLanguage[language] = item
      found.set(key, entry)
    })
  }

  const pick = <T,>(entry: Partial<Record<Language, TmdbItem>>, order: Language[], get: (i: TmdbItem) => T | undefined) =>
    order.map((l) => entry[l] && get(entry[l])).find((v) => v)

  return [...found.values()]
    .map(({ best, byLanguage: entry }) => {
      const any = (entry['es-MX'] ?? entry['es-AR'] ?? entry['en-US'])!
      const date = any.release_date ?? any.first_air_date
      return {
        best,
        popularity: any.popularity ?? 0,
        result: {
          tmdbId: any.id,
          mediaType: any.media_type as 'movie' | 'tv',
          title: pick(entry, ['es-MX', 'es-AR', 'en-US'], (i) => i.title ?? i.name) ?? '',
          originalTitle: any.original_title ?? any.original_name ?? '',
          year: date ? Number(date.slice(0, 4)) : null,
          posterPath: any.poster_path ?? null,
          overview: pick(entry, ['es-AR', 'es-MX', 'en-US'], (i) => i.overview) ?? '',
        },
      }
    })
    .sort((a, b) => a.best - b.best || b.popularity - a.popularity)
    .slice(0, 20)
    .map((r) => r.result)
}
