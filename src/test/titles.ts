import type { Title } from '../features/titles/titlesApi'

// Un título "Por ver" sin datos externos; cada test pisa lo que necesita.
export function makeTitle(overrides: Partial<Title> = {}): Title {
  return {
    id: 't1',
    tmdbId: 1,
    mediaType: 'movie',
    title: 'Título',
    originalTitle: null,
    year: 2020,
    posterPath: null,
    originNote: null,
    addedBy: 'u1',
    createdAt: '2026-10-07T12:00:00Z',
    imdbRating: null,
    rottenTomatoes: null,
    metacritic: null,
    tmdbRating: null,
    ratingsUpdatedAt: null,
    status: 'to_watch',
    watchedAt: null,
    scores: [],
    runtime: null,
    genres: [],
    streaming: [],
    detailsUpdatedAt: null,
    ...overrides,
  }
}
