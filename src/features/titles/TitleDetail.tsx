import { useCallback, useEffect, useState } from 'react'
import { useMemberName } from '../couple/coupleContext'
import { fetchTitleDetail, type Provider, type TitleDetail as Detail } from './detailApi'
import { imdbScore, metacriticScore, ratingsDate, rtScore, tmdbScore } from './ratings'
import { removeTitle, type Title } from './titlesApi'

const groups = [
  ['subscription', 'Suscripción'],
  ['rent', 'Alquiler'],
  ['buy', 'Compra'],
  ['free', 'Gratis'],
] as const

export function TitleDetail({ title, onClose }: { title: Title; onClose: () => void }) {
  const nameOf = useMemberName()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)

  const load = useCallback(() => {
    fetchTitleDetail(title.id).then(
      (d) => {
        setDetail(d)
        setFailed(false)
      },
      () => setFailed(true),
    )
  }, [title.id])

  useEffect(load, [load])

  // Mientras llega el detalle (o si falla) se muestra lo guardado en la lista.
  const ratings = detail?.ratings ?? {
    imdb: title.imdbRating,
    rottenTomatoes: title.rottenTomatoes,
    metacritic: title.metacritic,
    tmdb: title.tmdbRating,
    updatedAt: title.ratingsUpdatedAt,
  }
  const kind = title.mediaType === 'movie' ? 'Película' : 'Serie'
  const showOriginal = title.originalTitle && title.originalTitle.toLowerCase() !== title.title.toLowerCase()

  async function remove() {
    if (!window.confirm(`¿Quitar «${title.title}» de la lista?`)) return
    setRemoveFailed(false)
    try {
      await removeTitle(title.id)
      onClose()
    } catch {
      setRemoveFailed(true)
    }
  }

  return (
    <section className="detail">
      <button className="back" onClick={onClose}>
        Volver
      </button>
      {title.posterPath ? (
        <img className="poster-large" src={`https://image.tmdb.org/t/p/w342${title.posterPath}`} alt="" />
      ) : (
        <div className="poster-large" />
      )}
      <h2>{title.title}</h2>
      {showOriginal && <small>{`Original: ${title.originalTitle}`}</small>}
      <small>{title.year ? `${title.year} · ${kind}` : kind}</small>
      <small>{`La agregó ${nameOf(title.addedBy)}`}</small>
      {title.originNote && <small>{`De dónde vino: ${title.originNote}`}</small>}

      {failed && (
        <>
          <p role="alert">No se pudo cargar el detalle. Probá de nuevo.</p>
          <button onClick={load}>Reintentar</button>
        </>
      )}
      {!detail && !failed && <p>Cargando el detalle…</p>}

      {detail && (
        <>
          <h3>Sinopsis</h3>
          <p>{detail.overview || 'Sin sinopsis'}</p>
        </>
      )}

      <h3>Puntajes</h3>
      <ul className="scores">
        <li>{`IMDb ${imdbScore(ratings.imdb)}`}</li>
        <li>{`Rotten Tomatoes ${rtScore(ratings.rottenTomatoes)}`}</li>
        <li>{`Metacritic ${metacriticScore(ratings.metacritic)}`}</li>
        <li>{`TMDB ${tmdbScore(ratings.tmdb)}`}</li>
      </ul>
      {ratings.updatedAt && <small>{`Actualizados el ${ratingsDate(ratings.updatedAt)}`}</small>}
      {detail?.ratingsStale && <p>Hoy no se pudieron actualizar los puntajes</p>}

      {detail && (
        <>
          <h3>Dónde verla en Argentina</h3>
          {detail.providers ? (
            groups.map(([key, label]) =>
              detail.providers![key].length ? <ProviderGroup key={key} label={label} providers={detail.providers![key]} /> : null,
            )
          ) : (
            <p>Sin información de dónde verla</p>
          )}
          {detail.providers?.link && (
            <a href={detail.providers.link} target="_blank" rel="noreferrer">
              Ver opciones en TMDB
            </a>
          )}
          <small>Fuente: JustWatch</small>
        </>
      )}

      {removeFailed && <p role="alert">No se pudo quitar. Probá de nuevo.</p>}
      <button className="remove" onClick={remove}>
        Quitar
      </button>
    </section>
  )
}

function ProviderGroup({ label, providers }: { label: string; providers: Provider[] }) {
  return (
    <div className="providers">
      <h4>{label}</h4>
      <ul>
        {providers.map((p) => (
          <li key={p.name}>
            {p.logoPath ? <img src={`https://image.tmdb.org/t/p/w92${p.logoPath}`} alt={p.name} /> : <div className="logo" />}
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
