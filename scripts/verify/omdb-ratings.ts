// Uso: npx tsx --env-file=.env.local scripts/verify/omdb-ratings.ts
import { requireEnv } from '../lib/env.ts'
import { summarizeOmdb } from './lib.ts'

const { OMDB_API_KEY } = requireEnv(['OMDB_API_KEY'])

const titles = [
  { label: 'Parasite (película)', imdbId: 'tt6751668' },
  { label: 'Breaking Bad (serie)', imdbId: 'tt0903747' },
]

for (const { label, imdbId } of titles) {
  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`
  const json = (await (await fetch(url)).json()) as {
    Response: string
    Error?: string
    Ratings?: { Source: string; Value: string }[]
  }
  console.log(label, { Response: json.Response, Error: json.Error, ...summarizeOmdb(json) })
}
