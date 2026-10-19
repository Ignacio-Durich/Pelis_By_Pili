// Datos del detalle de TMDB que usan el detalle de un título y la búsqueda: quién la dirigió (o creó),
// cuántas temporadas tiene, cuánto dura y su id de IMDb.

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

type RuntimeFields = { runtime?: number | null; episode_run_time?: number[]; last_episode_to_air?: { runtime?: number | null } | null }

// Películas: su duración. Series: la de un episodio (TMDB suele traer episode_run_time vacío,
// así que se usa la del último episodio emitido).
export function pickRuntime(details: RuntimeFields): number | null {
  if (details.runtime && details.runtime > 0) return details.runtime
  const episode = details.episode_run_time?.find((m) => m > 0)
  if (episode) return episode
  const last = details.last_episode_to_air?.runtime
  return last && last > 0 ? last : null
}

export function pickImdbId(details: { imdb_id?: string | null; external_ids?: { imdb_id?: string | null } }): string | null {
  return details.imdb_id ?? details.external_ids?.imdb_id ?? null
}
