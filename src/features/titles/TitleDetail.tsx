import { useCallback, useEffect, useState } from 'react'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { fetchTitleDetail, type Provider, type TitleDetail as Detail } from './detailApi'
import { MyScore } from './MyScore'
import { formatScore, imdbScore, metacriticScore, ratingsDate, rtScore, tmdbScore } from './ratings'
import { enqueue, pendingFor } from '../../lib/offline'
import { kindLine, peopleLine } from './titleText'
import { removeTitle, setWatched, type Title } from './titlesApi'
import { isNetworkError, usePendingOwner } from './useTitles'

const groups = [
  ['subscription', 'Suscripción'],
  ['rent', 'Alquiler'],
  ['buy', 'Compra'],
  ['free', 'Gratis'],
] as const

export function TitleDetail({ title, onClose }: { title: Title; onClose: () => void }) {
  const nameOf = useMemberName()
  const { members } = useCouple()
  const userId = useUserId()
  const [watchFailed, setWatchFailed] = useState(false)
  const [watchQueued, setWatchQueued] = useState(false)
  const owner = usePendingOwner()
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
  const people = peopleLine(title.mediaType, title.director)
  const showOriginal = title.originalTitle && title.originalTitle.toLowerCase() !== title.title.toLowerCase()

  async function toggleWatched(watched: boolean) {
    setWatchFailed(false)
    setWatchQueued(false)
    // Si ya hay algo esperando, esto va detrás (así se manda en orden).
    if (pendingFor(owner).length > 0) {
      enqueue(owner, { kind: 'watched', titleId: title.id, watched })
      setWatchQueued(true)
      return
    }
    try {
      // La pantalla se actualiza sola: Realtime recarga la lista y el detalle recibe el título nuevo.
      await setWatched(title.id, watched)
    } catch (e) {
      // Sin red queda pendiente en el celular: la lista ya lo muestra cambiado.
      if (isNetworkError(e)) {
        enqueue(owner, { kind: 'watched', titleId: title.id, watched })
        setWatchQueued(true)
      } else setWatchFailed(true)
    }
  }

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
      <small>{kindLine(title.year, title.mediaType, title.seasons)}</small>
      {people && <small>{people}</small>}
      <small>{`La agregó ${nameOf(title.addedBy)}`}</small>
      {title.originNote && <small>{`De dónde vino: ${title.originNote}`}</small>}

      {title.status === 'watched' && title.watchedAt ? (
        <>
          <small>{`Vista el ${ratingsDate(title.watchedAt)}`}</small>
          <button className="secondary" onClick={() => toggleWatched(false)}>
            Volver a Por ver
          </button>
          <h3>Nuestros puntajes</h3>
          <ul className="our-scores">
            {members.map((m) => {
              const own = title.scores.find((sc) => sc.userId === m.userId)
              return (
                <li key={m.userId}>
                  <span>{own ? `${nameOf(m.userId)}: ${formatScore(own.score)}` : `${nameOf(m.userId)}: todavía no puntuó`}</span>
                  {own?.note && <small>{own.note}</small>}
                </li>
              )
            })}
          </ul>
          <MyScore key={title.id} titleId={title.id} current={title.scores.find((sc) => sc.userId === userId) ?? null} />
        </>
      ) : (
        <>
          <button onClick={() => toggleWatched(true)}>Marcar como vista</button>
          <p>Márquenla como vista para puntuarla.</p>
        </>
      )}
      {watchFailed && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
      {watchQueued && <p>⏳ Se guarda cuando vuelva la conexión</p>}

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
