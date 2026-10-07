// Edge Function (Deno): detalle de un título de la lista (sinopsis, puntajes y plataformas en AR).
// Los puntajes se guardan en el título y se renuevan como mucho una vez por semana.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  mergeRatings,
  needsRefresh,
  parseTitleId,
  pickGenres,
  pickImdbId,
  pickOverview,
  pickRuntime,
  streamingNames,
  tmdbScoreOf,
  toProviders,
  type TitleDetail,
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
const auth = createClient(url, anonKey)
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const getJson = async (u: string) => {
  const res = await fetch(u, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // La clave pública también es un token válido: solo se acepta una sesión de usuario.
  const authorization = req.headers.get('Authorization') ?? ''
  const { data: claims, error: authError } = await auth.auth.getClaims(authorization.replace(/^Bearer /, ''))
  if (authError || claims?.claims.role !== 'authenticated') return json(401, { error: 'unauthorized' })

  const titleId = parseTitleId(await req.json().catch(() => null))
  if (!titleId) return json(400, { error: 'invalid_id' })

  // Con la sesión de quien llama: RLS solo deja ver los títulos de su propio espacio.
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: title } = await asUser
    .from('titles')
    .select('id, tmdb_id, media_type, imdb_rating, rotten_tomatoes, metacritic, tmdb_rating, ratings_updated_at')
    .eq('id', titleId)
    .maybeSingle()
  if (!title) return json(404, { error: 'not_found' })

  let details
  try {
    details = await getJson(
      `https://api.themoviedb.org/3/${title.media_type}/${title.tmdb_id}?language=es-AR&append_to_response=external_ids,watch/providers,translations&api_key=${Deno.env.get('TMDB_API_KEY')}`,
    )
  } catch {
    return json(502, { error: 'upstream' })
  }

  const stored = {
    imdb: title.imdb_rating,
    rottenTomatoes: title.rotten_tomatoes,
    metacritic: title.metacritic,
    tmdb: title.tmdb_rating === null ? null : Number(title.tmdb_rating),
    updatedAt: title.ratings_updated_at,
  }
  const now = new Date()
  const imdbId = pickImdbId(details)
  let omdb: unknown = null
  if (imdbId && needsRefresh(stored.updatedAt, now)) {
    // Si OMDb no responde, se lo trata como el límite diario: se muestran los puntajes guardados.
    omdb = await getJson(`https://www.omdbapi.com/?i=${imdbId}&apikey=${Deno.env.get('OMDB_API_KEY')}`).catch(() => ({
      Response: 'False',
      Error: 'limit (sin respuesta)',
    }))
  }
  const { ratings, stale, save } = mergeRatings(stored, omdb, tmdbScoreOf(details), now)
  const providers = toProviders(details['watch/providers']?.results?.AR)
  // Datos para los filtros: se guardan en cada apertura (TMDB ya se consultó).
  await service
    .from('titles')
    .update({
      runtime: pickRuntime(details),
      genres: pickGenres(details),
      streaming: streamingNames(providers),
      details_updated_at: now.toISOString(),
      ...(save && {
        imdb_rating: ratings.imdb,
        rotten_tomatoes: ratings.rottenTomatoes,
        metacritic: ratings.metacritic,
        tmdb_rating: ratings.tmdb,
        ratings_updated_at: ratings.updatedAt,
      }),
    })
    .eq('id', titleId)

  const body: TitleDetail = {
    overview: pickOverview(details),
    ratings,
    ratingsStale: stale,
    providers,
  }
  return json(200, body)
})
