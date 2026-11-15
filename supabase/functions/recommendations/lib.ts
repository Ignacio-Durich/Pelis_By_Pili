// Lógica pura de las recomendaciones (sin APIs de Deno), para poder testearla con Vitest.
import { toSearchResult, type SearchResult } from '../tmdb-search/lib.ts'
import { genreNames, isAddOnChannel, parseTitleId } from '../title-detail/lib.ts'

export { genreNames }

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
  vote_average?: number
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
export type Row = { title: string; results: Recommendation[] }
export type Discover = {
  forBoth: Recommendation[]
  rows?: Row[] // "Para los dos" en filas por motivo; vacío si no hay con qué armarlas
  forEach: { userId: string; name: string; results: Recommendation[] }[]
  inTheaters: Recommendation[]
  onPlatforms: Recommendation[] | null
  platformNames: string[] // las elegidas, para mostrar bajo el subtítulo
}
export type ProviderOption = { id: number; name: string; logoPath: string | null; known: boolean }
export type RecRequest = { kind: 'discover' } | { kind: 'similar'; titleId: string } | { kind: 'providers' } | { kind: 'nowPlaying' }
export type Seed = { key: string; title: string; weight: number } // key = `${mediaType}:${tmdbId}`

export function parseRequest(body: unknown): RecRequest | null {
  const b = (body ?? {}) as { discover?: unknown; similarTo?: unknown; providers?: unknown; nowPlaying?: unknown }
  if (b.discover === true) return { kind: 'discover' }
  if (b.nowPlaying === true) return { kind: 'nowPlaying' }
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

export function toRecommendation(item: TmdbItem, mediaType: MediaType): Recommendation {
  return { ...toSearchResult(item, mediaType), genres: genreNames(item.genre_ids) }
}

const keyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`

type RankOptions = { exclude: Set<string>; minVotes: number; minRating?: number }
type Fetched = { seed: Seed; mediaType: MediaType; results: TmdbItem[] }
type Scored = { key: string; item: TmdbItem; mediaType: MediaType; score: number; rec: Recommendation }

// Cada aparición vale peso × (1 − posición / 40): lo que TMDB pone más arriba vale más. Lo que trae
// algo que no les gustó resta entero. De lo que suma, la mejor aparición cuenta entera y cada una de
// las siguientes la mitad que la anterior: así una saga (cuyas películas recomiendan casi lo mismo)
// no tapa a lo que trae una sola favorita. Queda lo que da positivo, de mayor a menor.
function scorePool(seeds: Fetched[], options: RankOptions): Scored[] {
  const found = new Map<string, { item: TmdbItem; mediaType: MediaType; parts: { title: string; value: number }[] }>()
  for (const { seed, mediaType, results } of seeds) {
    results.forEach((item, position) => {
      const key = keyOf(mediaType, item.id)
      const entry = found.get(key) ?? { item, mediaType, parts: [] }
      entry.parts.push({ title: seed.title, value: seed.weight * (1 - position / 40) })
      found.set(key, entry)
    })
  }
  return [...found.entries()]
    .map(([key, e]) => {
      const good = e.parts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
      const bad = e.parts.filter((p) => p.value <= 0).reduce((sum, p) => sum + p.value, 0)
      const score = good.reduce((sum, p, i) => sum + p.value * 0.5 ** i, 0) + bad
      return { key, item: e.item, mediaType: e.mediaType, score, rec: { ...toRecommendation(e.item, e.mediaType), because: good.slice(0, 2).map((p) => p.title) } }
    })
    .filter(
      (e) =>
        !options.exclude.has(e.key) &&
        (e.item.vote_count ?? 0) >= options.minVotes &&
        (!options.minRating || (e.item.vote_average ?? 0) >= options.minRating) &&
        e.score > 0,
    )
    .sort((a, b) => b.score - a.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
}

export function rankRecommendations(seeds: Fetched[], options: RankOptions & { limit: number }): Recommendation[] {
  return scorePool(seeds, options).slice(0, options.limit).map((e) => e.rec)
}

// Mezcla sin perder el orden: no deja tres seguidas del mismo género (el primero de cada una) ni por
// la misma favorita, mientras quede otra cosa para poner.
export function spread(recs: Recommendation[]): Recommendation[] {
  const left = [...recs]
  const out: Recommendation[] = []
  while (left.length) {
    const last = out.slice(-2)
    const repeats = (r: Recommendation, of: (x: Recommendation) => string | undefined) => last.length === 2 && of(r) !== undefined && last.every((x) => of(x) === of(r))
    const i = left.findIndex((r) => !repeats(r, (x) => x.genres[0]) && !repeats(r, (x) => x.because?.[0]))
    out.push(...left.splice(Math.max(i, 0), 1))
  }
  return out
}

// "Para los dos" en filas: una mezcla, y después se alternan "Porque les encantó <favorita>" (hasta 3,
// de 7 puntos para arriba y sin dos de la misma saga) y "Si tienen ganas de <género>" (los 3 géneros
// que más pesan entre lo que les gustó); al final, joyitas poco conocidas. Ningún título va en dos
// filas, y una fila con menos de 4 no se muestra. Sin mezcla no hay filas.
export function buildRows(seeds: Fetched[], options: RankOptions & { genresOf: (seedKey: string) => string[] }): Row[] {
  const pool = scorePool(seeds, options)
  const inPool = new Map(pool.map((e) => [e.key, e]))
  const used = new Set<string>()
  const rows: Row[] = []
  const add = (title: string, candidates: Scored[], limit: number, map: (r: Recommendation) => Recommendation = (r) => r) => {
    const picked = candidates.filter((e) => !used.has(e.key)).slice(0, limit)
    if (picked.length < 4) return false
    picked.forEach((e) => used.add(e.key))
    rows.push({ title, results: picked.map((e) => map(e.rec)) })
    return true
  }
  const byRec = new Map(pool.map((e) => [e.rec, e]))
  if (!add('Para ustedes', spread(pool.map((e) => e.rec)).map((r) => byRec.get(r)!), 5)) return []

  const favorites = seeds.filter((s) => s.seed.weight >= 2).sort((a, b) => b.seed.weight - a.seed.weight)
  const chosen: Set<string>[] = []
  const nextFavorite = () => {
    while (favorites.length) {
      const f = favorites.shift()!
      const keys = new Set(f.results.map((item) => keyOf(f.mediaType, item.id)))
      // Misma saga: comparte al menos un tercio de lo que trae con una favorita que ya tiene fila.
      if (chosen.some((c) => [...keys].filter((k) => c.has(k)).length * 3 >= Math.min(keys.size, c.size))) continue
      const candidates = [...keys].flatMap((k) => (inPool.has(k) ? [inPool.get(k)!] : []))
      if (add(`Porque les encantó ${f.seed.title}`, candidates, 8, (r) => ({ ...r, because: undefined }))) return void chosen.push(keys)
    }
  }
  const weightOf = new Map<string, number>()
  for (const s of seeds) if (s.seed.weight > 0) for (const g of options.genresOf(s.seed.key)) weightOf.set(g, (weightOf.get(g) ?? 0) + s.seed.weight)
  const genres = [...weightOf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g)
  for (let i = 0; i < 3; i++) {
    nextFavorite()
    if (genres[i]) add(`Si tienen ganas de ${genres[i].toLowerCase()}`, pool.filter((e) => e.rec.genres.includes(genres[i])), 8)
  }
  const gems = pool.filter((e) => (e.item.vote_average ?? 0) >= 7.3 && (e.item.vote_count ?? 0) < 1500)
  add('Joyitas poco conocidas', gems.sort((a, b) => (b.item.vote_average ?? 0) - (a.item.vote_average ?? 0)), 8)
  return rows
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
