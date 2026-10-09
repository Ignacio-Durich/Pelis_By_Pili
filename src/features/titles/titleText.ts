// Las líneas de texto de un título que se repiten en la tarjeta y el detalle.

// "2008 · Serie · 5 temporadas"
export function kindLine(year: number | null, mediaType: 'movie' | 'tv', seasons?: number | null): string {
  const kind = mediaType === 'movie' ? 'Película' : 'Serie'
  const count = seasons ? `${seasons} ${seasons === 1 ? 'temporada' : 'temporadas'}` : null
  return [year, kind, count].filter(Boolean).join(' · ')
}

// "Dirigida por …" o, si es serie, "Creada por …"
export function peopleLine(mediaType: 'movie' | 'tv', director: string | null | undefined): string | null {
  if (!director) return null
  return `${mediaType === 'movie' ? 'Dirigida' : 'Creada'} por ${director}`
}
