import type { Discover, ProviderOption, Recommendation } from '../../../supabase/functions/recommendations/lib.ts'
import { supabase } from '../../lib/supabase'
import { callRpc, CodedError } from '../../lib/rpc'
import type { Title } from '../titles/titlesApi'

export type { Discover, ProviderOption, Recommendation }

type DiscoverErrorKind = 'network' | 'no_couple' | 'invalid_platforms' | 'invalid_title'
export class DiscoverError extends CodedError<DiscoverErrorKind> {}

// Cambia cuando cambia lo visto o los puntajes (no el orden ni lo "Por ver"): mientras no cambie, no se vuelve a pedir.
export function discoverKey(titles: Title[]): string {
  return titles
    .filter((t) => t.status === 'watched')
    .map((t) => `${t.id}[${t.scores.map((s) => `${s.userId}=${s.score}`).sort().join(',')}]`)
    .sort()
    .join('|')
}

// Se guarda un solo resultado (el de la última key) mientras la app está abierta.
let saved: { key: string; promise: Promise<Discover> } | null = null

export const forgetDiscover = () => {
  saved = null
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('recommendations', { body })
  if (error || !data) throw new DiscoverError('network')
  return data
}

export function fetchDiscover(key: string): Promise<Discover> {
  if (saved?.key === key) return saved.promise
  const entry = { key, promise: invoke<Discover>({ discover: true }) }
  saved = entry
  // Si falla no queda en memoria (salvo que ya haya otra pedida encima).
  entry.promise.catch(() => {
    if (saved === entry) saved = null
  })
  return entry.promise
}

export async function fetchSimilar(titleId: string): Promise<Recommendation[]> {
  return (await invoke<{ results: Recommendation[] }>({ similarTo: titleId })).results
}

export async function fetchProviders(): Promise<ProviderOption[]> {
  return (await invoke<{ providers: ProviderOption[] }>({ providers: true })).providers
}

export async function fetchPlatforms(coupleId: string): Promise<number[]> {
  const { data, error } = await supabase.from('couples').select('platforms').eq('id', coupleId).single()
  if (error || !data) throw new DiscoverError('network')
  return data.platforms as number[]
}

const call = (name: string, args: Record<string, unknown>) =>
  callRpc<void, DiscoverErrorKind>(name, args, ['no_couple', 'invalid_platforms', 'invalid_title'], (kind) => new DiscoverError(kind))

// Con otras plataformas cambian las recomendaciones: lo guardado ya no vale.
export const setPlatforms = async (ids: number[]) => {
  await call('set_platforms', { p_ids: ids })
  forgetDiscover()
}

export const dismissTitle = (mediaType: 'movie' | 'tv', tmdbId: number) =>
  call('dismiss_title', { p_media_type: mediaType, p_tmdb_id: tmdbId })

export const undismissTitle = (mediaType: 'movie' | 'tv', tmdbId: number) =>
  call('undismiss_title', { p_media_type: mediaType, p_tmdb_id: tmdbId })
