// Edge Function (Deno): busca en TMDB en tres idiomas sin exponer la clave al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { mergeSearches, parseQuery, SEARCH_LANGUAGES } from './lib.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // La clave pública también es un token válido: solo se acepta una sesión de usuario.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const { data, error } = await supabase.auth.getClaims(token)
  if (error || data?.claims.role !== 'authenticated') return json(401, { error: 'unauthorized' })

  const query = parseQuery(await req.json().catch(() => null))
  if (!query) return json(400, { error: 'invalid_query' })

  const key = Deno.env.get('TMDB_API_KEY')
  try {
    const pages = await Promise.all(
      SEARCH_LANGUAGES.map(async (language) => {
        const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=${language}&include_adult=false&page=1&api_key=${key}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`TMDB ${res.status}`)
        return [language, (await res.json()).results ?? []] as const
      }),
    )
    return json(200, { results: mergeSearches(Object.fromEntries(pages) as Parameters<typeof mergeSearches>[0]) })
  } catch {
    return json(502, { error: 'upstream' })
  }
})
