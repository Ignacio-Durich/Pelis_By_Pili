// Uso: npx tsx --env-file=.env.local scripts/verify/tmdb-providers.ts
import { requireEnv } from '../lib/env.ts'

const { TMDB_API_KEY } = requireEnv(['TMDB_API_KEY'])

async function tmdb<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.themoviedb.org/3${path}?api_key=${TMDB_API_KEY}`)
  if (!res.ok) throw new Error(`TMDB ${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

type Provider = { provider_name: string }

const { results: regions } = await tmdb<{ results: { iso_3166_1: string }[] }>('/watch/providers/regions')
console.log('Región AR disponible:', regions.some((r) => r.iso_3166_1 === 'AR') ? 'sí' : 'no')

const titles = [
  { label: 'Parasite (película)', path: '/movie/496243/watch/providers' },
  { label: 'Breaking Bad (serie)', path: '/tv/1396/watch/providers' },
]

for (const { label, path } of titles) {
  const { results } = await tmdb<{ results?: Record<string, Record<string, Provider[] | string>> }>(path)
  const ar = results?.AR
  if (!ar) {
    console.log(label, 'sin datos para AR')
    continue
  }
  for (const [kind, list] of Object.entries(ar)) {
    if (Array.isArray(list)) console.log(label, kind, list.map((p) => p.provider_name).join(', '))
  }
}
