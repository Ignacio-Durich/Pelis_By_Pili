// Lógica pura del detalle de un título (sin APIs de Deno), testeada con Vitest.
import { isOmdbLimit, summarizeOmdb } from '../_shared/omdb.ts'

export type Provider = { name: string; logoPath: string | null }
export type Providers = { link: string | null; subscription: Provider[]; rent: Provider[]; buy: Provider[]; free: Provider[] }
export type StoredRatings = {
  imdb: string | null
  rottenTomatoes: string | null
  metacritic: string | null
  tmdb: number | null
  updatedAt: string | null
}
export type TitleDetail = { overview: string; ratings: StoredRatings; ratingsStale: boolean; providers: Providers | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEEK_MS = 7 * 86_400_000

export function parseTitleId(body: unknown): string | null {
  const id = (body as { titleId?: unknown } | null)?.titleId
  return typeof id === 'string' && UUID.test(id) ? id : null
}

// Los puntajes se renuevan como mucho una vez por semana, para cuidar las consultas de OMDb.
export function needsRefresh(updatedAt: string | null, now: Date): boolean {
  return updatedAt === null || now.getTime() - new Date(updatedAt).getTime() >= WEEK_MS
}

export function pickImdbId(details: { imdb_id?: string | null; external_ids?: { imdb_id?: string | null } }): string | null {
  return details.imdb_id ?? details.external_ids?.imdb_id ?? null
}

type TmdbProvider = { provider_name: string; logo_path: string | null; display_priority?: number }

export function toProviders(ar: unknown): Providers | null {
  const data = ar as Partial<Record<'link' | 'flatrate' | 'rent' | 'buy' | 'free' | 'ads', unknown>> | undefined
  if (!data) return null
  const list = (...keys: ('flatrate' | 'rent' | 'buy' | 'free' | 'ads')[]) => {
    const seen = new Set<string>()
    return keys
      .flatMap((k) => (data[k] as TmdbProvider[] | undefined) ?? [])
      .sort((a, b) => (a.display_priority ?? 0) - (b.display_priority ?? 0))
      .filter((p) => {
        if (seen.has(p.provider_name)) return false
        seen.add(p.provider_name)
        return true
      })
      .map((p) => ({ name: p.provider_name, logoPath: p.logo_path ?? null }))
  }
  const providers = {
    link: typeof data.link === 'string' ? data.link : null,
    subscription: list('flatrate'),
    rent: list('rent'),
    buy: list('buy'),
    free: list('free', 'ads'),
  }
  const empty = !providers.subscription.length && !providers.rent.length && !providers.buy.length && !providers.free.length
  return empty ? null : providers
}

// omdb === null: no se consultó (puntajes vigentes, o el título no tiene id de IMDb).
export function mergeRatings(
  stored: StoredRatings,
  omdb: unknown | null,
  tmdbScore: number | null,
  now: Date,
): { ratings: StoredRatings; stale: boolean; save: boolean } {
  if (omdb === null && !needsRefresh(stored.updatedAt, now)) return { ratings: stored, stale: false, save: false }
  if (omdb !== null && isOmdbLimit(omdb as { Response?: string; Error?: string })) {
    return { ratings: stored, stale: true, save: false }
  }
  const fromOmdb = omdb === null ? { imdb: null, rottenTomatoes: null, metacritic: null } : summarizeOmdb(omdb as never)
  const tmdb = tmdbScore === null ? null : Math.round(tmdbScore * 10) / 10
  return { ratings: { ...fromOmdb, tmdb, updatedAt: now.toISOString() }, stale: false, save: true }
}
