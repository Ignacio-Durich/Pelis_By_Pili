import type { ReactNode } from 'react'

type Props = {
  title: string
  originalTitle: string | null
  year: number | null
  mediaType: 'movie' | 'tv'
  posterPath: string | null
  children?: ReactNode
}

export function TitleCard({ title, originalTitle, year, mediaType, posterPath, children }: Props) {
  const kind = mediaType === 'movie' ? 'Película' : 'Serie'
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
        <small>{year ? `${year} · ${kind}` : kind}</small>
        {children}
      </div>
    </div>
  )
}
