// Lógica pura de la búsqueda (sin APIs de Deno), para poder testearla con Vitest.
import { isOmdbLimit, summarizeOmdb } from '../_shared/omdb.ts'
import { pickDirector, pickRuntime, pickSeasons } from '../_shared/people.ts'

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
  vote_count?: number
  episode_count?: number
  known_for_department?: string
  genre_ids?: number[]
  job?: string
  character?: string
}

export function parseQuery(body: unknown): string | null {
  const query = (body as { query?: unknown } | null)?.query
  if (typeof query !== 'string') return null
  const trimmed = query.trim()
  return trimmed.length >= 2 && trimmed.length <= 100 ? trimmed : null
}

// Minúsculas y sin acentos, para comparar "Parásitos" con "parasitos".
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

const ratio = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1)

// Qué tan parecido es lo escrito a un nombre, de 0 a 1: igual es 1; un nombre que empieza con lo
// escrito (se está tipeando) es 0,9; si no, cuenta los errores de tipeo, contra el nombre entero o
// contra su principio.
export function similarity(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (!q || !n) return 0
  if (q === n) return 1
  if (n.startsWith(q)) return 0.9
  return Math.max(ratio(q, n), ratio(q, n.slice(0, q.length)) * 0.9)
}

const namesOf = (i: TmdbItem) => [i.title, i.name, i.original_title, i.original_name].filter((n): n is string => !!n)
const isTitle = (i: TmdbItem) => i.media_type === 'movie' || i.media_type === 'tv'

// Búsquedas de repuesto, por si hay un error de tipeo: TMDB completa solo la última palabra, así
// que se corta la palabra más larga en dos largos (dejando las de antes), y se busca cada otra
// palabra sola. Corren junto con la búsqueda principal, así no suman espera.
export function fallbackQueries(query: string): string[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const longest = words.reduce((best, w, i) => (w.length > words[best].length ? i : best), 0)
  const word = words[longest] ?? ''
  const queries: string[] = []
  if (word.length >= 4) {
    for (const cut of [Math.max(3, Math.floor(word.length * 0.4)), Math.max(3, Math.ceil(word.length * 0.6))]) {
      if (cut < word.length) queries.push([...words.slice(0, longest), word.slice(0, cut)].join(' '))
    }
  }
  for (const [i, w] of words.entries()) if (i !== longest && w.length >= 3) queries.push(w)
  return [...new Set(queries)].slice(0, 4)
}

// Lo que llega solo por las búsquedas de repuesto (`fallback`) entra si se parece a lo escrito.
export function mergeSearches(
  byLanguage: Record<Language, unknown[]>,
  query = '',
  fallback: Partial<Record<Language, unknown[]>> = {},
): SearchResult[] {
  const wanted = normalize(query)
  type Entry = { best: number; main: boolean; byLanguage: Partial<Record<Language, TmdbItem>> }
  const found = new Map<string, Entry>()
  for (const [lists, main] of [[byLanguage, true], [fallback, false]] as const) {
    for (const language of SEARCH_LANGUAGES) {
      const items = ((lists[language] ?? []) as TmdbItem[]).filter(isTitle)
      items.forEach((item, index) => {
        // Lo de repuesto va detrás de todo lo principal y, entre sí, desempata la popularidad.
        const position = main ? index : 1000
        const key = `${item.media_type}:${item.id}`
        const entry = found.get(key) ?? { best: position, main, byLanguage: {} }
        entry.best = Math.min(entry.best, position)
        entry.main ||= main
        entry.byLanguage[language] ??= item
        found.set(key, entry)
      })
    }
  }

  const pick = <T,>(entry: Partial<Record<Language, TmdbItem>>, order: Language[], get: (i: TmdbItem) => T | undefined) =>
    order.map((l) => entry[l] && get(entry[l])).find((v) => v)

  return [...found.values()]
    .map(({ best, main, byLanguage: entry }) => {
      const any = (entry['es-MX'] ?? entry['es-AR'] ?? entry['en-US'])!
      const date = any.release_date ?? any.first_air_date
      const names = Object.values(entry).flatMap(namesOf)
      // Lo que casi nadie votó (suele ser un registro duplicado o desconocido) baja un escalón.
      const known = Math.max(...Object.values(entry).map((i) => i.vote_count ?? 0)) >= 5
      const close = Math.max(0, ...names.map((n) => similarity(query, n))) - (known ? 0 : 0.15)
      return {
        main,
        // Si lo escrito coincide exacto con algún nombre del título, va primero.
        exact: known && wanted !== '' && names.some((n) => normalize(n) === wanted),
        // Después, lo más parecido a lo escrito (de a décimos, para que TMDB desempate).
        close,
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
    .filter((r) => r.main || r.close >= 0.5)
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        Math.floor(b.close * 10) - Math.floor(a.close * 10) ||
        a.best - b.best ||
        b.popularity - a.popularity,
    )
    .slice(0, 20)
    .map((r) => r.result)
}

export type Person = { id: number; name: string; role: 'director' | 'actor' }

// Si lo escrito es el nombre de un director o actor (todas las palabras están en su nombre), el
// más popular. Así "nolan" o "ricardo darin" traen lo suyo.
export function pickPerson(byLanguage: Record<Language, unknown[]>, query: string): Person | null {
  const wanted = normalize(query).split(/\s+/).filter((w) => w.length >= 2)
  if (wanted.length === 0) return null
  const roles: Record<string, Person['role']> = { Directing: 'director', Acting: 'actor' }
  // Con el nombre completo alcanza; con una parte ("nolan"), tiene que ser alguien conocido:
  // "matrix" no trae a un actor desconocido que se llama así.
  const people = SEARCH_LANGUAGES.flatMap((l) => (byLanguage[l] ?? []) as TmdbItem[])
    .filter((i) => i.media_type === 'person' && i.name && roles[i.known_for_department ?? ''])
    .filter((i) => {
      const words = normalize(i.name!).split(/\s+/)
      const full = words.every((w) => wanted.includes(w))
      return wanted.every((w) => words.includes(w)) && (full || (i.popularity ?? 0) >= 2)
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  const top = people[0]
  return top ? { id: top.id, name: top.name!, role: roles[top.known_for_department!] } : null
}

// Programas de entrevistas, noticias y reality: ahí aparecen como invitados, no son "lo suyo".
const NOT_THEIR_WORK = [10767, 10763, 10764]

// Director: las películas que dirigió y las series que creó (no los capítulos sueltos que dirigió).
// Actor: sin las veces que hace de sí mismo y, en series, si estuvo en varios capítulos. Lo más
// votado primero (lo conocido antes que lo que está de moda). Hasta 100: la app muestra de a 20.
export function personTitles(credits: { cast?: unknown[]; crew?: unknown[] }, role: Person['role']): SearchResult[] {
  const items = (
    role === 'director'
      ? ((credits.crew ?? []) as TmdbItem[]).filter(
          (c) => (c.media_type === 'movie' && c.job === 'Director') || (c.media_type === 'tv' && c.job === 'Creator'),
        )
      : ((credits.cast ?? []) as TmdbItem[]).filter(
          (c) => !/\b(self|himself|herself)\b/i.test(c.character ?? '') && (c.media_type !== 'tv' || (c.episode_count ?? 0) >= 4),
        )
  ).filter((i) => isTitle(i) && !(i.genre_ids ?? []).some((g) => NOT_THEIR_WORK.includes(g)))
  const unique = new Map(items.map((i) => [`${i.media_type}:${i.id}`, i]))
  return [...unique.values()]
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0) || (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 100)
    .map((i) => {
      const date = i.release_date ?? i.first_air_date
      return {
        tmdbId: i.id,
        mediaType: i.media_type as 'movie' | 'tv',
        title: i.title ?? i.name ?? '',
        originalTitle: i.original_title ?? i.original_name ?? '',
        year: date ? Number(date.slice(0, 4)) : null,
        posterPath: i.poster_path ?? null,
        overview: i.overview ?? '',
      }
    })
}

export type DetailsRequest = { mediaType: 'movie' | 'tv'; tmdbId: number }[]

// Director y temporadas de los resultados, en un segundo pedido para que la búsqueda no espere.
export function parseDetailsRequest(body: unknown): DetailsRequest | null {
  const list = (body as { details?: unknown } | null)?.details
  if (!Array.isArray(list) || list.length === 0 || list.length > 20) return null
  const valid = list.every(
    (d) => (d?.mediaType === 'movie' || d?.mediaType === 'tv') && Number.isInteger(d?.tmdbId) && d.tmdbId > 0,
  )
  return valid ? list.map((d) => ({ mediaType: d.mediaType, tmdbId: d.tmdbId })) : null
}

export type Extra = { director: string | null; seasons: number | null; runtime: number | null; imdb: string | null }

// Lo que se suma a cada resultado: del detalle de TMDB y, si OMDb respondió, el puntaje de IMDb.
type Details = Parameters<typeof pickDirector>[0] & Parameters<typeof pickSeasons>[0] & Parameters<typeof pickRuntime>[0]
type Omdb = Parameters<typeof summarizeOmdb>[0] & Parameters<typeof isOmdbLimit>[0]

export function searchExtra(details: Details, omdb: Omdb | null): Extra {
  return {
    director: pickDirector(details),
    seasons: pickSeasons(details),
    runtime: pickRuntime(details),
    imdb: omdb && !isOmdbLimit(omdb) ? summarizeOmdb(omdb).imdb : null,
  }
}
