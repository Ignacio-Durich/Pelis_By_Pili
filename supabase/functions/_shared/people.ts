// Quién la dirigió (o creó) y cuántas temporadas tiene, desde el detalle de TMDB.

type People = { created_by?: { name: string }[]; credits?: { crew?: { job: string; name: string }[] } }

// Series: quién la creó. Películas: quién la dirigió. Hasta 3 nombres.
export function pickDirector(details: People): string | null {
  const created = (details.created_by ?? []).map((p) => p.name)
  const names = created.length ? created : (details.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name)
  return [...new Set(names)].slice(0, 3).join(', ') || null
}

export function pickSeasons(details: { number_of_seasons?: number }): number | null {
  return details.number_of_seasons && details.number_of_seasons > 0 ? details.number_of_seasons : null
}
