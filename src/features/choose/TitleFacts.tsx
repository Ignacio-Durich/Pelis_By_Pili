import { ScoreLine } from '../titles/TitleCard'
import { kindLine } from '../titles/titleText'
import type { Title } from '../titles/titlesApi'

// Los datos de una carta grande (Bumble y el duelo del Torneo). Solo <strong> y <span>, así entran
// también dentro de un <button>.
export function TitleFacts({ title }: { title: Title }) {
  return (
    <>
      <strong>{title.title}</strong>
      <span>{kindLine(title.year, title.mediaType, title.seasons, title.runtime)}</span>
      {title.genres.length > 0 && <span>{title.genres.slice(0, 3).join(' · ')}</span>}
      <ScoreLine imdb={title.imdbRating} rt={title.rottenTomatoes} as="span" />
      <span>{title.streaming.length ? title.streaming.join(', ') : 'Sin información de dónde verla'}</span>
    </>
  )
}
