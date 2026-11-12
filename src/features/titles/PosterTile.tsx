import type { ReactNode } from 'react'
import { Icon } from '../../lib/icons'

type Props = {
  title: string
  posterPath: string | null
  // Puntaje IMDb ya formateado ("7.7"); sin puntaje y en cartelera, el chip dice "En cines".
  imdb: string | null
  inTheaters?: boolean
  // Recién agregada desde Descubrir: un ✓ sobre el póster.
  marked?: boolean
  children?: ReactNode
}

// Un título en las grillas de pósters (Lista, Descubrir). El chip va después del nombre en el
// HTML, así el lector de pantalla dice primero el título, aunque se vea encima del póster.
export function PosterTile({ title, posterPath, imdb, inTheaters, marked, children }: Props) {
  return (
    <div className="tile">
      <div className="tile-poster">
        {posterPath && <img src={`https://image.tmdb.org/t/p/w342${posterPath}`} alt="" loading="lazy" />}
        {marked && (
          <span className="tile-check">
            <Icon name="check" size={32} />
          </span>
        )}
      </div>
      <strong>{title}</strong>
      {children}
      {imdb ? (
        <span className="tile-badge">
          <span className="visually-hidden">{`IMDb ${imdb}`}</span>
          <span aria-hidden="true">{imdb}</span>
        </span>
      ) : (
        inTheaters && <span className="tile-badge">En cines</span>
      )}
    </div>
  )
}
