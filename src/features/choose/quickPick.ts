import type { Title } from '../titles/titlesApi'

export const TIME_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: 90, label: 'Hasta 1 h 30' },
  { minutes: 120, label: 'Hasta 2 h' },
  { minutes: 150, label: 'Hasta 2 h 30' },
  { minutes: null, label: 'Sin apuro' },
]

// Géneros con el nombre que trae TMDB (los mismos de los filtros de la lista).
export type Answers = { maxMinutes: number | null; genres: string[]; platforms: string[] }

export const NO_ANSWERS: Answers = { maxMinutes: null, genres: [], platforms: [] }

const PICKS = 5

// IMDb, o TMDB si no hay; null = sin puntaje (va al final).
function score(t: Title): number | null {
  const imdb = t.imdbRating ? parseFloat(t.imdbRating) : NaN
  if (!Number.isNaN(imdb)) return imdb
  return t.tmdbRating
}

export function quickPick(titles: Title[], answers: Answers): { picks: Title[]; filled: boolean } {
  const chosen = answers.genres
  const genreMatches = (t: Title) => chosen.filter((g) => t.genres.includes(g)).length

  const fitting = titles.filter(
    (t) =>
      t.status === 'to_watch' &&
      (answers.maxMinutes === null || (t.runtime !== null && t.runtime <= answers.maxMinutes)) &&
      (answers.platforms.length === 0 || answers.platforms.some((p) => t.streaming.includes(p))),
  )

  // Siempre el mismo orden: más géneros en común, mejor puntaje, más nuevo.
  const ranked = fitting
    .map((t) => ({ t, genres: genreMatches(t), score: score(t) }))
    .sort(
      (a, b) =>
        b.genres - a.genres ||
        (b.score ?? -1) - (a.score ?? -1) ||
        b.t.createdAt.localeCompare(a.t.createdAt),
    )

  // Los que coinciden con los géneros van primero; si no llegan a 5, completan los demás.
  const picks = ranked.slice(0, PICKS)
  const filled = chosen.length > 0 && picks.some((r) => r.genres === 0)
  return { picks: picks.map((r) => r.t), filled }
}
