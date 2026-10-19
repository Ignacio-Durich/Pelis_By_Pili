// Edge Function (Deno): busca en TMDB en tres idiomas sin exponer la clave al navegador.
// Con { query } busca títulos (y, si lo escrito es un director o actor, lo suyo); con { details }
// devuelve director, temporadas, duración y puntaje de IMDb de los resultados, en un segundo pedido
// para no demorar la búsqueda.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { pickImdbId } from '../_shared/people.ts'
import {
  fallbackQueries,
  mergeSearches,
  parseDetailsRequest,
  parseQuery,
  personTitles,
  pickPerson,
  SEARCH_LANGUAGES,
  searchExtra,
  type DetailsRequest,
} from './lib.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
const key = () => Deno.env.get('TMDB_API_KEY')

async function tmdb(path: string, params: string) {
  const res = await fetch(`https://api.themoviedb.org/3/${path}?${params}&api_key=${key()}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

type ByLanguage = Parameters<typeof mergeSearches>[0]

async function searchIn(query: string, languages: readonly string[]): Promise<ByLanguage> {
  const pages = await Promise.all(
    languages.map(async (language) => {
      const data = await tmdb('search/multi', `query=${encodeURIComponent(query)}&language=${language}&include_adult=false&page=1`)
      return [language, data.results ?? []] as const
    }),
  )
  return Object.fromEntries(pages) as ByLanguage
}

async function search(query: string) {
  // Las de repuesto (por si hay un error de tipeo) van junto con la principal: no suman espera.
  const [found, ...extra] = await Promise.all([
    searchIn(query, SEARCH_LANGUAGES),
    ...fallbackQueries(query).map((q) => searchIn(q, ['es-MX', 'en-US']).catch(() => ({}) as ByLanguage)),
  ])
  const fallback = Object.fromEntries(SEARCH_LANGUAGES.map((l) => [l, extra.flatMap((e) => e[l] ?? [])]))
  const results = mergeSearches(found, query, fallback)
  const person = pickPerson(found, query)
  if (!person) return { results, person: null }
  const credits = await tmdb(`person/${person.id}/combined_credits`, 'language=es-MX').catch(() => ({}))
  const theirs = personTitles(credits, person.role)
  return { results, person: theirs.length ? { ...person, results: theirs } : null }
}

async function details(list: DetailsRequest) {
  const entries = await Promise.all(
    list.map(async ({ mediaType, tmdbId }) => {
      const data = await tmdb(`${mediaType}/${tmdbId}`, `append_to_response=${mediaType === 'movie' ? 'credits' : 'external_ids'}`).catch(() => null)
      if (!data) return [`${mediaType}:${tmdbId}`, null] as const
      // ponytail: una consulta a OMDb por resultado (límite 1000 por día, compartido con title-detail);
      // si se agota, los resultados salen sin IMDb. Guardar los puntajes en una tabla si alguna vez pasa.
      const imdbId = pickImdbId(data)
      const omdb = imdbId
        ? await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${Deno.env.get('OMDB_API_KEY')}`, { signal: AbortSignal.timeout(8000) })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : null
      return [`${mediaType}:${tmdbId}`, searchExtra(data, omdb)] as const
    }),
  )
  return { details: Object.fromEntries(entries.filter(([, d]) => d)) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // La clave pública también es un token válido: solo se acepta una sesión de usuario.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const { data, error } = await supabase.auth.getClaims(token)
  if (error || data?.claims.role !== 'authenticated') return json(401, { error: 'unauthorized' })
  // Solo quien está en un espacio: con su sesión, RLS deja ver su propia fila de miembro.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { count } = await asUser.from('couple_members').select('user_id', { count: 'exact', head: true }).eq('user_id', data.claims.sub)
  if (!count) return json(403, { error: 'no_couple' })

  const body = await req.json().catch(() => null)
  const wanted = parseDetailsRequest(body)
  const query = wanted ? null : parseQuery(body)
  if (!wanted && !query) return json(400, { error: 'invalid_query' })

  try {
    return json(200, wanted ? await details(wanted) : await search(query!))
  } catch {
    return json(502, { error: 'upstream' })
  }
})
