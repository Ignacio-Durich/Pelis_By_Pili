import type { Title } from '../titles/titlesApi'

export type MoodId = 'laugh' | 'romantic' | 'moved' | 'adrenaline' | 'intrigue' | 'mindbending' | 'scary' | 'learn' | 'relax'

// Ánimos y los géneros de TMDB (es-AR; las series usan algunos propios) que cuentan para cada uno.
export const MOODS: { id: MoodId; label: string; genres: string[] }[] = [
  { id: 'laugh', label: '😂 Reírnos', genres: ['Comedia', 'Animación', 'Familia', 'Kids'] },
  { id: 'romantic', label: '💕 Algo romántico', genres: ['Romance', 'Comedia', 'Música'] },
  { id: 'moved', label: '😢 Emocionarnos', genres: ['Drama', 'Romance', 'Historia', 'Música'] },
  { id: 'adrenaline', label: '💥 Adrenalina', genres: ['Acción', 'Aventura', 'Action & Adventure', 'Bélica', 'War & Politics', 'Western'] },
  { id: 'intrigue', label: '🕵️ Intriga', genres: ['Misterio', 'Crimen', 'Suspense'] },
  { id: 'mindbending', label: '🚀 Volar la cabeza', genres: ['Ciencia ficción', 'Fantasía', 'Sci-Fi & Fantasy'] },
  { id: 'scary', label: '👻 Miedo', genres: ['Terror', 'Suspense'] },
  { id: 'learn', label: '🧠 Aprender algo', genres: ['Documental', 'Historia'] },
  { id: 'relax', label: '😌 Relax', genres: ['Animación', 'Comedia', 'Familia', 'Documental', 'Música', 'Kids', 'Reality'] },
]

export const TIME_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: 90, label: 'Hasta 1 h 30' },
  { minutes: 120, label: 'Hasta 2 h' },
  { minutes: 150, label: 'Hasta 2 h 30' },
  { minutes: null, label: 'Sin apuro' },
]

export type Answers = { maxMinutes: number | null; moods: MoodId[]; platforms: string[] }

export const NO_ANSWERS: Answers = { maxMinutes: null, moods: [], platforms: [] }

const PICKS = 5

// IMDb, o TMDB si no hay; null = sin puntaje (va al final).
function score(t: Title): number | null {
  const imdb = t.imdbRating ? parseFloat(t.imdbRating) : NaN
  if (!Number.isNaN(imdb)) return imdb
  return t.tmdbRating
}

export function quickPick(titles: Title[], answers: Answers): { picks: Title[]; filled: boolean } {
  const chosen = MOODS.filter((m) => answers.moods.includes(m.id))
  const moodMatches = (t: Title) => chosen.filter((m) => m.genres.some((g) => t.genres.includes(g))).length

  const fitting = titles.filter(
    (t) =>
      t.status === 'to_watch' &&
      (answers.maxMinutes === null || (t.runtime !== null && t.runtime <= answers.maxMinutes)) &&
      (answers.platforms.length === 0 || answers.platforms.some((p) => t.streaming.includes(p))),
  )

  // Siempre el mismo orden: más ánimos en común, mejor puntaje, más nuevo.
  const ranked = fitting
    .map((t) => ({ t, moods: moodMatches(t), score: score(t) }))
    .sort(
      (a, b) =>
        b.moods - a.moods ||
        (b.score ?? -1) - (a.score ?? -1) ||
        b.t.createdAt.localeCompare(a.t.createdAt),
    )

  // Los que coinciden con el ánimo van primero; si no llegan a 5, completan los demás.
  const picks = ranked.slice(0, PICKS)
  const filled = chosen.length > 0 && picks.some((r) => r.moods === 0)
  return { picks: picks.map((r) => r.t), filled }
}
