import type { ReactNode } from 'react'
import { formatMinutes } from './filters'
import { kindLine, peopleLine } from './titleText'

type Props = {
  title: string
  originalTitle: string | null
  year: number | null
  mediaType: 'movie' | 'tv'
  posterPath: string | null
  director?: string | null
  seasons?: number | null
  runtime?: number | null
  children?: ReactNode
}

export function TitleCard({ title, originalTitle, year, mediaType, posterPath, director, seasons, runtime, children }: Props) {
  const people = peopleLine(mediaType, director)
  const showOriginal = originalTitle && originalTitle.toLowerCase() !== title.toLowerCase()
  return (
    <div className="card">
      {posterPath ? (
        <img className="poster" src={`https://image.tmdb.org/t/p/w185${posterPath}`} alt="" loading="lazy" />
      ) : (
        <div className="poster" />
      )}
      <div className="card-text">
        <strong>{title}</strong>
        {showOriginal && <small>{`Original: ${originalTitle}`}</small>}
        <small>{[kindLine(year, mediaType, seasons), runtime ? formatMinutes(runtime) : null].filter(Boolean).join(' · ')}</small>
        {people && <small>{people}</small>}
        {children}
      </div>
    </div>
  )
}
