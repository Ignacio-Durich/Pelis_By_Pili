// Lógica pura de las recomendaciones (sin APIs de Deno), para poder testearla con Vitest.
import { toSearchResult, type SearchResult } from '../tmdb-search/lib.ts'
import { isAddOnChannel, parseTitleId } from '../title-detail/lib.ts'

export type TmdbItem = {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  genre_ids?: number[]
  vote_count?: number
  popularity?: number
}
type MediaType = 'movie' | 'tv'

export type Recommendation = SearchResult & {
  genres: string[]
  because?: string[]
  platforms?: string[]
  newSeason?: boolean
  watchedTitleId?: string
}
export type Discover = {
  forBoth: Recommendation[]
  forEach: { userId: string; name: string; results: Recommendation[] }[]
  inTheaters: Recommendation[]
  onPlatforms: Recommendation[] | null
  platformNames: string[] // las elegidas, para mostrar bajo el subtítulo
}
export type ProviderOption = { id: number; name: string; logoPath: string | null; known: boolean }
export type RecRequest = { kind: 'discover' } | { kind: 'similar'; titleId: string } | { kind: 'providers' }
export type Seed = { key: string; title: string; weight: number } // key = `${mediaType}:${tmdbId}`

export function parseRequest(body: unknown): RecRequest | null {
  const b = (body ?? {}) as { discover?: unknown; similarTo?: unknown; providers?: unknown }
  if (b.discover === true) return { kind: 'discover' }
  if (b.providers === true) return { kind: 'providers' }
  const titleId = parseTitleId({ titleId: b.similarTo })
  return titleId ? { kind: 'similar', titleId } : null
}

// Un 9 pesa +4, un 6 pesa +1, un 3 pesa −2. Sin puntajes, la semilla no cuenta.
export function seedWeight(scores: number[]): number | null {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length - 5 : null
}

// Las de mayor peso en valor absoluto: lo que más les gustó y lo que más les disgustó.
export function pickSeeds<T extends { weight: number }>(seeds: T[], max = 50): T[] {
  return [...seeds].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, max)
}

// Las semillas de uno: solo entre las ya elegidas para los dos (así TMDB se consulta por 50 títulos
// como mucho en total), con el peso de sus propios puntajes. Sin puntaje suyo, no hay semilla.
export function memberSeeds<T extends Seed>(both: T[], scores: { key: string; score: number }[]): T[] {
  return both.flatMap((seed) => {
    const weight = seedWeight(scores.filter((s) => s.key === seed.key).map((s) => s.score))
    return weight === null ? [] : [{ ...seed, weight }]
  })
}

// IDs de géneros de TMDB (películas y series), en es-MX. No cambian.
const GENRES: Record<number, string> = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental', 18: 'Drama',
  10751: 'Familia', 14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música', 9648: 'Misterio',
  10749: 'Romance', 878: 'Ciencia ficción', 10770: 'Película de TV', 53: 'Suspenso', 10752: 'Bélica', 37: 'Western',
  10759: 'Acción y aventura', 10762: 'Infantil', 10763: 'Noticias', 10764: 'Reality',
  10765: 'Ciencia ficción y fantasía', 10766: 'Telenovela', 10767: 'Entrevistas', 10768: 'Guerra y política',
}

export function genreNames(ids: number[] | undefined): string[] {
  return (ids ?? []).map((id) => GENRES[id]).filter((name): name is string => !!name)
}

export function toRecommendation(item: TmdbItem, mediaType: MediaType): Recommendation {
  return { ...toSearchResult(item, mediaType), genres: genreNames(item.genre_ids) }
}

const keyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`

// Cada aparición suma peso × (1 − posición / 40): lo que TMDB pone más arriba suma más. Un título
// que traen varias favoritas sube; uno que trae algo que no les gustó, baja.
export function rankRecommendations(
  seeds: { seed: Seed; mediaType: MediaType; results: TmdbItem[] }[],
  options: { exclude: Set<string>; minVotes: number; limit: number },
): Recommendation[] {
  type Entry = { item: TmdbItem; mediaType: MediaType; score: number; parts: { title: string; value: number }[] }
  const found = new Map<string, Entry>()
  for (const { seed, mediaType, results } of seeds) {
    results.forEach((item, position) => {
      const key = keyOf(mediaType, item.id)
      const value = seed.weight * (1 - position / 40)
      const entry = found.get(key) ?? { item, mediaType, score: 0, parts: [] }
      entry.score += value
      entry.parts.push({ title: seed.title, value })
      found.set(key, entry)
    })
  }
  return [...found.entries()]
    .filter(([key, e]) => !options.exclude.has(key) && (e.item.vote_count ?? 0) >= options.minVotes && e.score > 0)
    .sort(([, a], [, b]) => b.score - a.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
    .slice(0, options.limit)
    .map(([, e]) => ({
      ...toRecommendation(e.item, e.mediaType),
      because: e.parts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 2).map((p) => p.title),
    }))
}

type Entries = { item: TmdbItem; mediaType: MediaType }[]

// En el orden de TMDB, sin lo que ya está en la lista ni lo descartado (sin mínimo de votos).
// Si dos páginas se superponen, queda la primera aparición de cada título.
export function inOrder(items: Entries, exclude: Set<string>, limit: number): Recommendation[] {
  const seen = new Set<string>()
  return items
    .filter(({ item, mediaType }) => {
      const key = keyOf(mediaType, item.id)
      if (exclude.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
    .map(({ item, mediaType }) => toRecommendation(item, mediaType))
}

export function byPopularity(items: Entries, exclude: Set<string>, limit: number): Recommendation[] {
  return inOrder([...items].sort((a, b) => (b.item.popularity ?? 0) - (a.item.popularity ?? 0)), exclude, limit)
}

// Las más conocidas primero (más votos en TMDB); con empate queda el orden de TMDB (sort es estable).
export function byVotes(items: Entries, exclude: Set<string>, limit: number): Recommendation[] {
  return inOrder([...items].sort((a, b) => (b.item.vote_count ?? 0) - (a.item.vote_count ?? 0)), exclude, limit)
}

export type Person = { id: number; name: string }
export type MoreBy = { kind: 'director' | 'cast'; name: string; results: Recommendation[] }
type Credit = TmdbItem & { media_type: string; job?: string; character?: string; episode_count?: number }

// Quién la hizo: el director (de una serie, quien la creó) y los dos actores principales.
export function pickPeople(
  details: { created_by?: Person[]; credits?: { cast?: (Person & { order?: number })[]; crew?: (Person & { job?: string })[] } },
  mediaType: MediaType,
): { director: Person | null; cast: Person[] } {
  const found = mediaType === 'tv' ? details.created_by?.[0] : details.credits?.crew?.find((c) => c.job === 'Director')
  const director = found ? { id: found.id, name: found.name } : null
  const cast = [...(details.credits?.cast ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((c) => c.id !== director?.id)
    .slice(0, 2)
    .map(({ id, name }) => ({ id, name }))
  return { director, cast }
}

// Lo que dirigió (o creó, si es serie) o en lo que actuó, las más conocidas primero. Sin apariciones
// como sí mismo, programas de todas las semanas ni series donde estuvo en un par de episodios.
export function personTitles(
  credits: { cast?: Credit[]; crew?: Credit[] },
  role: 'director' | 'cast',
  exclude: Set<string>,
  limit: number,
): Recommendation[] {
  const found = role === 'director'
    ? (credits.crew ?? []).filter((c) => (c.media_type === 'movie' && c.job === 'Director') || (c.media_type === 'tv' && c.job === 'Creator'))
    : (credits.cast ?? []).filter((c) =>
      (c.media_type === 'movie' || c.media_type === 'tv') &&
      !/\b(self|himself|herself)\b/i.test(c.character ?? '') &&
      !c.genre_ids?.some((g) => LONG_RUNNING_GENRES.includes(g)) &&
      !(c.media_type === 'tv' && (c.episode_count ?? Infinity) < 3))
  return byVotes(found.map((item) => ({ item, mediaType: item.media_type as MediaType })), exclude, limit)
}

// Una serie que se estrenó antes de la ventana de novedades y sigue emitiendo: temporada nueva.
export function isNewSeasonSeries(item: TmdbItem, since: string): boolean {
  return !!item.first_air_date && item.first_air_date < since
}

// Programas que emiten todas las semanas: no son "novedades".
export const LONG_RUNNING_GENRES = [10767, 10763, 10764, 10766]

// Une lo de cada plataforma por título, nombrando todas las que lo tienen. Las series que ya vieron
// (`watched`: clave → id en la lista) no se sacan aunque estén en `exclude`: quien llama comprueba
// si tienen temporada nueva con `hasNewSeason`.
export function mergePlatformResults(
  byProvider: { name: string; movies: TmdbItem[]; series: TmdbItem[] }[],
  options: { exclude: Set<string>; watched: Map<string, string>; since: string; limit: number },
): Recommendation[] {
  const found = new Map<string, { item: TmdbItem; mediaType: MediaType; platforms: string[] }>()
  for (const { name, movies, series } of byProvider) {
    for (const [mediaType, items] of [['movie', movies], ['tv', series]] as const) {
      for (const item of items) {
        const key = keyOf(mediaType, item.id)
        const entry = found.get(key) ?? { item, mediaType, platforms: [] }
        if (!entry.platforms.includes(name)) entry.platforms.push(name)
        found.set(key, entry)
      }
    }
  }
  // Primero las series que ya vieron, después los estrenos y al final las temporadas nuevas de series
  // viejas (las que emiten todo el año taparían los estrenos); dentro de cada grupo, por popularidad.
  const group = (key: string, { item, mediaType }: { item: TmdbItem; mediaType: MediaType }) =>
    options.watched.has(key) ? 0 : mediaType === 'tv' && isNewSeasonSeries(item, options.since) ? 2 : 1
  return [...found.entries()]
    .filter(([key]) => options.watched.has(key) || !options.exclude.has(key))
    .sort(([ka, a], [kb, b]) => group(ka, a) - group(kb, b) || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
    .slice(0, options.limit)
    .map(([key, { item, mediaType, platforms }]) => {
      const watchedTitleId = options.watched.get(key)
      const newSeason = watchedTitleId !== undefined || (mediaType === 'tv' && isNewSeasonSeries(item, options.since))
      return {
        ...toRecommendation(item, mediaType),
        platforms,
        ...(newSeason && { newSeason }),
        ...(watchedTitleId !== undefined && { watchedTitleId }),
      }
    })
}

// La temporada más reciente ya emitida (sin la 0, los especiales) empezó después de marcarla vista.
export function hasNewSeason(
  details: { seasons?: { season_number: number; air_date: string | null }[] },
  watchedAt: string,
  today: string,
): boolean {
  const aired = (details.seasons ?? [])
    .filter((s) => s.season_number > 0 && s.air_date && s.air_date <= today)
    .map((s) => s.air_date!)
  return aired.length > 0 && aired.sort().at(-1)! > watchedAt.slice(0, 10)
}

type TmdbProvider = { provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number }

// Las conocidas en Argentina, en este orden: la prioridad de TMDB para AR deja HBO Max en el
// puesto 34, detrás de plataformas chicas. (Netflix, Prime Video, Disney Plus, HBO Max, Paramount
// Plus, Apple TV, MUBI, Crunchyroll, Mercado Play, Claro video, Movistar TV, DIRECTV GO, ViX, Pluto TV.)
const KNOWN_PROVIDERS = [8, 119, 337, 1899, 531, 350, 11, 283, 2302, 167, 339, 467, 457, 300]
const rank = (id: number) => (KNOWN_PROVIDERS.includes(id) ? KNOWN_PROVIDERS.indexOf(id) : KNOWN_PROVIDERS.length)

// Plataformas de películas y de series, unidas: primero las conocidas y después el resto por
// prioridad, sin los canales que se contratan dentro de otra ("… Amazon Channel"), hasta 30.
export function toProviderOptions(movie: unknown[], tv: unknown[]): ProviderOption[] {
  const unique = new Map(([...movie, ...tv] as TmdbProvider[]).map((p) => [p.provider_id, p]))
  return [...unique.values()]
    .filter((p) => !isAddOnChannel(p.provider_name))
    .sort((a, b) => rank(a.provider_id) - rank(b.provider_id) || (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .slice(0, 30)
    .map((p) => ({ id: p.provider_id, name: p.provider_name.trim(), logoPath: p.logo_path ?? null, known: KNOWN_PROVIDERS.includes(p.provider_id) }))
}
