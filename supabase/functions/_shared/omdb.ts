// Puntajes de OMDb (IMDb, Rotten Tomatoes, Metacritic). Lo usan la función title-detail y el
// script scripts/verify/omdb-ratings.ts.

export type RatingsSummary = {
  imdb: string | null
  rottenTomatoes: string | null
  metacritic: string | null
}

export function summarizeOmdb(json: { Ratings?: { Source: string; Value: string }[] }): RatingsSummary {
  const find = (source: string) => {
    const value = json.Ratings?.find((r) => r.Source === source)?.Value
    return value && value !== 'N/A' ? value : null
  }
  return {
    imdb: find('Internet Movie Database'),
    rottenTomatoes: find('Rotten Tomatoes'),
    metacritic: find('Metacritic'),
  }
}

// OMDb responde 200 con { Response: 'False', Error: 'Request limit reached!' } al agotar el día.
export function isOmdbLimit(json: { Response?: string; Error?: string }): boolean {
  return json.Response === 'False' && /limit/i.test(json.Error ?? '')
}
