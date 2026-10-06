export type RatingsSummary = {
  imdb: string | null
  rottenTomatoes: string | null
  metacritic: string | null
}

export function summarizeOmdb(json: { Ratings?: { Source: string; Value: string }[] }): RatingsSummary {
  const find = (source: string) => json.Ratings?.find((r) => r.Source === source)?.Value ?? null
  return {
    imdb: find('Internet Movie Database'),
    rottenTomatoes: find('Rotten Tomatoes'),
    metacritic: find('Metacritic'),
  }
}
