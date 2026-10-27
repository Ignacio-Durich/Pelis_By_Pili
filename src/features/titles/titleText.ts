// Las líneas de texto de un título que se repiten en la tarjeta y el detalle.
import { formatMinutes } from './filters'

// "2008 · Serie · 5 temporadas · 47 min por episodio" o "2010 · Película · 2 h 28"
export function kindLine(year: number | null, mediaType: 'movie' | 'tv', seasons?: number | null, runtime?: number | null): string {
  const kind = mediaType === 'movie' ? 'Película' : 'Serie'
  const count = seasons ? `${seasons} ${seasons === 1 ? 'temporada' : 'temporadas'}` : null
  // De una serie, TMDB da lo que dura un episodio.
  const length = runtime ? `${formatMinutes(runtime)}${mediaType === 'tv' ? ' por episodio' : ''}` : null
  return [year, kind, count, length].filter(Boolean).join(' · ')
}

// "Dirigida por …" o, si es serie, "Creada por …"
export function peopleLine(mediaType: 'movie' | 'tv', director: string | null | undefined): string | null {
  if (!director) return null
  return `${mediaType === 'movie' ? 'Dirigida' : 'Creada'} por ${director}`
}
