import { useCallback, useEffect, useState } from 'react'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { SimilarTitles } from '../discover/SimilarTitles'
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

// onChanged: después de cada cambio la lista se vuelve a pedir, sin esperar a Realtime.
// titles: la lista, para que "Parecidas a esta" no ofrezca lo que ya está.
export function TitleDetail({
  title,
  titles = [],
  onClose,
  onChanged,
}: {
  title: Title
  titles?: Title[]
  onClose: () => void
  onChanged: () => void
}) {
  const nameOf = useMemberName()
  const { members } = useCouple()
  const userId = useUserId()
  const [watchFailed, setWatchFailed] = useState(false)
  const [watchQueued, setWatchQueued] = useState(false)
  const owner = usePendingOwner()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [busy, setBusy] = useState(false)

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
  // Solo los que hay: un puntaje sin dato no se muestra.
  const scores: [string, string | null][] = [
    ['IMDb', imdbScore(ratings.imdb)],
    ['Rotten Tomatoes', rtScore(ratings.rottenTomatoes)],
    ['Metacritic', metacriticScore(ratings.metacritic)],
    ['TMDB', tmdbScore(ratings.tmdb)],
  ]
  const shownScores = scores.filter(([, value]) => value !== null)
  const people = peopleLine(title.mediaType, title.director)
  const showOriginal = title.originalTitle && title.originalTitle.toLowerCase() !== title.title.toLowerCase()

  async function toggleWatched(watched: boolean) {
    if (busy) return
    setWatchFailed(false)
    setWatchQueued(false)
    // Si ya hay algo esperando, esto va detrás (así se manda en orden).
    if (pendingFor(owner).length > 0) {
      enqueue(owner, { kind: 'watched', titleId: title.id, watched })
      setWatchQueued(true)
      return
    }
    setBusy(true)
    try {
      await setWatched(title.id, watched)
      onChanged()
    } catch (e) {
      // Sin red queda pendiente en el celular: la lista ya lo muestra cambiado.
      if (isNetworkError(e)) {
        enqueue(owner, { kind: 'watched', titleId: title.id, watched })
        setWatchQueued(true)
      } else setWatchFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`¿Quitar «${title.title}» de la lista?`)) return
    setRemoveFailed(false)
    setBusy(true)
    try {
      await removeTitle(title.id)
      onClose()
      onChanged()
    } catch {
      setRemoveFailed(true)
    } finally {
      setBusy(false)
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
      <small>{kindLine(title.year, title.mediaType, title.seasons, title.runtime)}</small>
      {people && <small>{people}</small>}
      <small>{`La agregó ${nameOf(title.addedBy)}`}</small>
      {title.originNote && <small>{`De dónde vino: ${title.originNote}`}</small>}

      {title.status === 'watched' && title.watchedAt ? (
        <>
          <small>{`Vista el ${ratingsDate(title.watchedAt)}`}</small>
          <button className="secondary" disabled={busy} onClick={() => toggleWatched(false)}>
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
          <MyScore
            key={title.id}
            titleId={title.id}
            current={title.scores.find((sc) => sc.userId === userId) ?? null}
            onSaved={onChanged}
          />
        </>
      ) : (
        <>
          <button disabled={busy} onClick={() => toggleWatched(true)}>
            Marcar como vista
          </button>
          <p>Márquenla como vista para puntuarla.</p>
        </>
      )}
      {watchFailed && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
      {watchQueued && <p>⏳ Se guarda cuando vuelva la conexión</p>}

      {failed && (
        <>
          <p role="alert">No se pudo cargar el detalle. Probá de nuevo.</p>
          <button
            onClick={() => {
              setFailed(false)
              load()
            }}
          >
            Reintentar
          </button>
        </>
      )}
      {!detail && !failed && <p>Cargando el detalle…</p>}

      {detail && (
        <>
          <h3>Sinopsis</h3>
          <p>{detail.overview || 'Sin sinopsis'}</p>
          {/* Si TMDB no tiene tráiler, se busca en YouTube. */}
          <a
            className="button-link"
            href={
              detail.trailer ??
              `https://www.youtube.com/results?search_query=${encodeURIComponent([title.title, title.year, 'tráiler'].filter(Boolean).join(' '))}`
            }
            target="_blank"
            rel="noreferrer"
          >
            ▶ Ver tráiler
          </a>
        </>
      )}

      <h3>Puntajes</h3>
      {shownScores.length ? (
        <ul className="scores">
          {shownScores.map(([label, value]) => (
            <li key={label}>{`${label} ${value}`}</li>
          ))}
        </ul>
      ) : (
        <p>Todavía no hay puntajes</p>
      )}
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
            <a className="button-link" href={detail.providers.link} target="_blank" rel="noreferrer">
              Ver opciones en TMDB
            </a>
          )}
          <small>Fuente: JustWatch</small>
        </>
      )}

      {title.status === 'watched' && <SimilarTitles key={title.id} title={title} titles={titles} />}

      {removeFailed && <p role="alert">No se pudo quitar. Probá de nuevo.</p>}
      <button className="remove" disabled={busy} onClick={remove}>
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
