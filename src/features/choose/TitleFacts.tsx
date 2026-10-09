import { formatMinutes } from '../titles/filters'
import { imdbScore, rtScore } from '../titles/ratings'
import { kindLine } from '../titles/titleText'
import type { Title } from '../titles/titlesApi'

// Los datos de una carta grande (Bumble y el duelo del Torneo). Solo <strong> y <span>, así entran
// también dentro de un <button>.
export function TitleFacts({ title }: { title: Title }) {
  const facts = [kindLine(title.year, title.mediaType, title.seasons), title.runtime ? formatMinutes(title.runtime) : null].filter(Boolean).join(' · ')
  return (
    <>
      <strong>{title.title}</strong>
      <span>{facts}</span>
      {title.genres.length > 0 && <span>{title.genres.slice(0, 3).join(' · ')}</span>}
      <span>{`IMDb ${imdbScore(title.imdbRating)} · RT ${rtScore(title.rottenTomatoes)}`}</span>
      <span>{title.streaming.length ? title.streaming.join(', ') : 'Sin información de dónde verla'}</span>
    </>
  )
}
