// Edge Function (Deno): recomendaciones a partir de TMDB sin exponer la clave al navegador.
// { discover } arma las cuatro secciones de Descubrir, { similarTo } las "Parecidas a esta" de un
// título de la lista y { providers } las plataformas de Argentina para elegir. Todo lo del espacio
// se lee con la sesión de quien llama: RLS limita cada lectura a su propio espacio.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import {
  byPopularity,
  hasNewSeason,
  inOrder,
  LONG_RUNNING_GENRES,
  memberSeeds,
  mergePlatformResults,
  parseRequest,
  pickSeeds,
  rankRecommendations,
  seedWeight,
  toProviderOptions,
  type Discover,
  type Seed,
  type TmdbItem,
} from './lib.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(url, anonKey)

type MediaType = 'movie' | 'tv'
type Title = { id: string; tmdb_id: number; media_type: MediaType; title: string; status: string; watched_at: string | null }
type SeedOf = Seed & { mediaType: MediaType; tmdbId: number }

type TmdbData = { results?: unknown[]; seasons?: { season_number: number; air_date: string | null }[] }

class Upstream extends Error {}

// Un pedido a TMDB que, si falla, se anota y devuelve null: así se sigue con el resto y solo se
// responde 502 si fallaron todos los de este pedido.
function tmdbCalls() {
  let total = 0
  let failed = 0
  return {
    async get(path: string, params: string): Promise<TmdbData | null> {
      total++
      try {
        const res = await fetch(`https://api.themoviedb.org/3/${path}?${params}&api_key=${Deno.env.get('TMDB_API_KEY')}`, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) throw new Error(`TMDB ${res.status}`)
        return await res.json()
      } catch {
        failed++
        return null
      }
    },
    check() {
      if (total > 0 && failed === total) throw new Upstream()
    },
  }
}
type Calls = ReturnType<typeof tmdbCalls>

const items = (data: TmdbData | null) => (data?.results ?? []) as TmdbItem[]
const keyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`
const day = (date: Date) => date.toISOString().slice(0, 10)

async function providers(calls: Calls) {
  const [movie, tv] = await Promise.all(['movie', 'tv'].map((t) => calls.get(`watch/providers/${t}`, 'watch_region=AR&language=es-MX')))
  calls.check()
  return { providers: toProviderOptions(items(movie), items(tv)) }
}

async function similar(calls: Calls, title: Title, exclude: Set<string>) {
  const base = `${title.media_type}/${title.tmdb_id}`
  let found = items(await calls.get(`${base}/recommendations`, 'language=es-MX&page=1'))
  if (!found.length) found = items(await calls.get(`${base}/similar`, 'language=es-MX&page=1'))
  calls.check()
  return { results: inOrder(found.map((item) => ({ item, mediaType: title.media_type })), exclude, 20) }
}

async function discover(
  calls: Calls,
  data: { titles: Title[]; scores: { title_id: string; user_id: string; score: number }[]; members: { user_id: string; display_name: string | null }[]; platforms: number[] },
  exclude: Set<string>,
): Promise<Discover> {
  const today = day(new Date())
  const since = day(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))

  // Semillas de los dos: las vistas con puntaje, con el peso del promedio. Las de cada uno salen de
  // estas mismas (con sus propios puntajes), así se piden a TMDB 50 títulos como mucho.
  const keyOfTitle = new Map(data.titles.map((t) => [t.id, keyOf(t.media_type, t.tmdb_id)]))
  const watchedTitles = data.titles.filter((t) => t.status === 'watched')
  const scored = (userIds: string[]) => data.scores.filter((s) => userIds.includes(s.user_id)).map((s) => ({ key: keyOfTitle.get(s.title_id)!, score: Number(s.score) }))
  const everyScore = scored(data.members.map((m) => m.user_id))
  const both = pickSeeds(
    watchedTitles.flatMap((t) => {
      const key = keyOf(t.media_type, t.tmdb_id)
      const weight = seedWeight(everyScore.filter((s) => s.key === key).map((s) => s.score))
      return weight === null ? [] : [{ key, title: t.title, weight, mediaType: t.media_type, tmdbId: t.tmdb_id }]
    }),
  )
  const each = data.members.map((m) => ({ ...m, seeds: memberSeeds(both, scored([m.user_id])) })).filter((m) => m.seeds.length)

  // Cada semilla se pide una sola vez aunque la usen varias secciones, y todas arrancan ya.
  const asked = new Map<string, Promise<TmdbItem[] | null>>()
  const recommendationsOf = (s: SeedOf) => {
    if (!asked.has(s.key)) asked.set(s.key, calls.get(`${s.mediaType}/${s.tmdbId}/recommendations`, 'language=es-MX&page=1').then((d) => (d ? items(d) : null)))
    return asked.get(s.key)!
  }
  ;[...both, ...each.flatMap((m) => m.seeds)].forEach(recommendationsOf)
  const rank = async (seeds: SeedOf[], skip: Set<string>) => {
    const fetched = await Promise.all(seeds.map(async (seed) => ({ seed, mediaType: seed.mediaType, results: await recommendationsOf(seed) })))
    return rankRecommendations(fetched.flatMap((f) => (f.results ? [{ ...f, results: f.results }] : [])), { exclude: skip, minVotes: 50, limit: 30 })
  }

  const inTheaters = (async () => {
    const pages = await Promise.all([1, 2].map((page) => calls.get('movie/now_playing', `language=es-MX&region=AR&page=${page}`)))
    return byPopularity(pages.flatMap((p) => items(p).map((item) => ({ item, mediaType: 'movie' as const }))), exclude, 30)
  })()

  const onPlatforms = (async () => {
    if (!data.platforms.length) return { list: null, names: [] as string[] }
    const where = (id: number) => `language=es-MX&watch_region=AR&with_watch_providers=${id}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&page=1`
    const [movieNames, tvNames, ...found] = await Promise.all([
      calls.get('watch/providers/movie', 'watch_region=AR&language=es-MX'),
      calls.get('watch/providers/tv', 'watch_region=AR&language=es-MX'),
      ...data.platforms.map(async (id) => {
        const [movies, series] = await Promise.all([
          calls.get('discover/movie', `${where(id)}&primary_release_date.gte=${since}&primary_release_date.lte=${today}`),
          calls.get('discover/tv', `${where(id)}&air_date.gte=${since}&air_date.lte=${today}&without_genres=${encodeURIComponent(LONG_RUNNING_GENRES.join('|'))}`),
        ])
        return { id, movies: movies && items(movies), series: series && items(series) }
      }),
    ])
    const nameOf = new Map(([...items(movieNames), ...items(tvNames)] as unknown as { provider_id: number; provider_name: string }[]).map((p) => [p.provider_id, p.provider_name]))
    const named = found.flatMap((f) => (nameOf.has(f.id) && (f.movies || f.series) ? [{ name: nameOf.get(f.id)!, movies: f.movies ?? [], series: f.series ?? [] }] : []))
    const watched = new Map(data.titles.filter((t) => t.media_type === 'tv' && t.status === 'watched').map((t) => [keyOf('tv', t.tmdb_id), t.id]))
    const merged = mergePlatformResults(named, { exclude, watched, since, limit: Infinity })
    // Una serie ya vista solo vuelve si tiene una temporada posterior a cuando la marcaron vista.
    const verified = await Promise.all(
      merged.map(async (r) => {
        if (r.watchedTitleId === undefined) return r
        const watchedAt = data.titles.find((t) => t.id === r.watchedTitleId)?.watched_at
        const details = watchedAt ? await calls.get(`tv/${r.tmdbId}`, 'language=es-MX') : null
        return details && hasNewSeason(details, watchedAt!, today) ? r : null
      }),
    )
    return {
      list: verified.filter((r) => r !== null).slice(0, 30),
      names: data.platforms.flatMap((id) => (nameOf.has(id) ? [nameOf.get(id)!] : [])),
    }
  })()

  const forBoth = await rank(both, exclude)
  const skip = new Set([...exclude, ...forBoth.map((r) => keyOf(r.mediaType, r.tmdbId))])
  const [forEach, theaters, platforms] = await Promise.all([
    Promise.all(each.map(async (m) => ({ userId: m.user_id, name: m.display_name ?? 'alguien', results: await rank(m.seeds, skip) }))),
    inTheaters,
    onPlatforms,
  ])
  calls.check()
  return { forBoth, forEach, inTheaters: theaters, onPlatforms: platforms.list, platformNames: platforms.names }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // La clave pública también es un token válido: solo se acepta una sesión de usuario.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const { data, error } = await supabase.auth.getClaims(token)
  if (error || data?.claims.role !== 'authenticated') return json(401, { error: 'unauthorized' })
  // Con su sesión, RLS deja ver solo los miembros de su espacio.
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: members } = await asUser.from('couple_members').select('user_id, couple_id, display_name').order('joined_at')
  if (!members?.length) return json(403, { error: 'no_couple' })

  const request = parseRequest(await req.json().catch(() => null))
  if (!request) return json(400, { error: 'invalid_request' })

  const calls = tmdbCalls()
  try {
    if (request.kind === 'providers') return json(200, await providers(calls))

    // ponytail: una sola lectura (hasta 1.000 filas por tabla); un espacio con más títulos que eso necesitaría paginar.
    const [titlesRes, scoresRes, dismissedRes, coupleRes] = await Promise.all([
      asUser.from('titles').select('id, tmdb_id, media_type, title, status, watched_at'),
      asUser.from('title_scores').select('title_id, user_id, score'),
      asUser.from('dismissed_titles').select('media_type, tmdb_id'),
      asUser.from('couples').select('platforms').eq('id', members[0].couple_id).maybeSingle(),
    ])
    if (titlesRes.error || scoresRes.error || dismissedRes.error || coupleRes.error) return json(500, { error: 'internal' })
    const titles = (titlesRes.data ?? []) as Title[]
    const exclude = new Set([
      ...titles.map((t) => keyOf(t.media_type, t.tmdb_id)),
      ...(dismissedRes.data ?? []).map((d) => keyOf(d.media_type as MediaType, d.tmdb_id as number)),
    ])

    if (request.kind === 'similar') {
      const title = titles.find((t) => t.id === request.titleId)
      return title ? json(200, await similar(calls, title, exclude)) : json(404, { error: 'not_found' })
    }
    return json(200, await discover(calls, { titles, scores: scoresRes.data ?? [], members, platforms: coupleRes.data?.platforms ?? [] }, exclude))
  } catch (e) {
    return e instanceof Upstream ? json(502, { error: 'upstream' }) : json(500, { error: 'internal' })
  }
})
