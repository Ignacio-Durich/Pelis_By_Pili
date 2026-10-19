import type { Extra, Person, SearchResult } from '../../../supabase/functions/tmdb-search/lib.ts'
import { supabase } from '../../lib/supabase'

export type { Extra, SearchResult }
// Si lo escrito es un director o actor: lo suyo, aparte de los títulos.
export type SearchResponse = { results: SearchResult[]; person: (Omit<Person, 'id'> & { results: SearchResult[] }) | null }

type Item = { mediaType: 'movie' | 'tv'; tmdbId: number }
const keyOf = (i: Item) => `${i.mediaType}:${i.tmdbId}`

// Lo ya buscado o pedido queda en memoria mientras la app está abierta: volver atrás es inmediato.
const searches = new Map<string, SearchResponse>()
const extras = new Map<string, Extra>()

export async function searchTitles(query: string): Promise<SearchResponse> {
  const key = query.trim().toLowerCase()
  const saved = searches.get(key)
  if (saved) return saved
  const { data, error } = await supabase.functions.invoke<SearchResponse>('tmdb-search', { body: { query } })
  if (error || !data) throw new Error('search_failed')
  searches.set(key, data)
  return data
}

// Director, temporadas, duración e IMDb de los resultados: se piden aparte para no demorar la búsqueda,
// de a 20 (lo que acepta la función) y en paralelo.
export async function searchDetails(items: Item[]): Promise<Record<string, Extra>> {
  const missing = items.filter((i) => !extras.has(keyOf(i)))
  const chunks = Array.from({ length: Math.ceil(missing.length / 20) }, (_, i) => missing.slice(i * 20, i * 20 + 20))
  await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.functions.invoke<{ details: Record<string, Extra> }>('tmdb-search', {
        body: { details: chunk },
      })
      if (error || !data) throw new Error('details_failed')
      for (const [key, extra] of Object.entries(data.details)) extras.set(key, extra)
    }),
  )
  return Object.fromEntries(items.flatMap((i) => (extras.has(keyOf(i)) ? [[keyOf(i), extras.get(keyOf(i))!]] : [])))
}
