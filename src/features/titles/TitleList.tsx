import { useCallback, useEffect, useRef, useState } from 'react'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { AddTitle } from './AddTitle'
import { formatScore, imdbScore, ratingsDate, rtScore } from './ratings'
import { TitleDetail } from './TitleDetail'
import { TitleCard } from './TitleCard'
import { listTitles, removeTitle, subscribeTitles, type Title } from './titlesApi'

export function TitleList() {
  const { coupleId, members } = useCouple()
  const nameOf = useMemberName()
  // null = cargando
  const [titles, setTitles] = useState<Title[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  // Por id: el detalle abierto toma siempre la versión más nueva del título (Realtime recarga la lista).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'to_watch' | 'watched'>('to_watch')
  // La ventana es la que scrollea: al abrir una pantalla se sube al principio y al volver
  // se recupera el lugar de la lista.
  const listScroll = useRef(0)

  function openScreen(show: () => void) {
    listScroll.current = window.scrollY
    show()
    window.scrollTo(0, 0)
  }

  function backToList(hide: () => void) {
    hide()
    requestAnimationFrame(() => window.scrollTo(0, listScroll.current))
  }

  const load = useCallback(() => {
    listTitles(coupleId).then(
      (list) => {
        setTitles(list)
        setOffline(false)
      },
      () => setOffline(true),
    )
  }, [coupleId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeTitles(coupleId, load)
    // Al volver la app al frente: el Realtime puede haberse cortado en segundo plano.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coupleId, load])

  async function remove(title: Title) {
    if (!window.confirm(`¿Quitar «${title.title}» de la lista?`)) return
    setRemoveFailed(false)
    try {
      await removeTitle(title.id)
    } catch {
      setRemoveFailed(true)
    }
  }

  const selected = titles?.find((t) => t.id === selectedId)
  if (selected) return <TitleDetail title={selected} onClose={() => backToList(() => setSelectedId(null))} />
  if (adding) return <AddTitle coupleId={coupleId} titles={titles ?? []} onClose={() => backToList(() => setAdding(false))} />

  // "Por ver": del más nuevo al más viejo (como llega). "Vistas": la vista más reciente primero.
  const shown = titles
    ?.filter((t) => t.status === tab)
    .sort((a, b) => (tab === 'watched' ? (b.watchedAt ?? '').localeCompare(a.watchedAt ?? '') : 0))

  const emptyText =
    tab === 'watched'
      ? 'Todavía no vieron nada juntos'
      : titles?.length
        ? 'No queda nada por ver'
        : 'Nuestra lista está vacía'

  // "Nacho 8,75 · Pili —"
  const ourScores = (t: Title) =>
    members
      .map((m) => {
        const own = t.scores.find((sc) => sc.userId === m.userId)
        return `${nameOf(m.userId)} ${own ? formatScore(own.score) : '—'}`
      })
      .join(' · ')

  return (
    <section className="titles">
      <div className="segmented">
        <button aria-pressed={tab === 'to_watch'} onClick={() => setTab('to_watch')}>
          Por ver
        </button>
        <button aria-pressed={tab === 'watched'} onClick={() => setTab('watched')}>
          Vistas
        </button>
      </div>
      <h2>{tab === 'to_watch' ? 'Por ver' : 'Vistas'}</h2>
      {offline && (
        <>
          <p role="alert">Sin conexión. Probá de nuevo.</p>
          <button onClick={load}>Reintentar</button>
        </>
      )}
      {titles === null && !offline && <p>Cargando…</p>}
      {shown?.length === 0 && <p>{emptyText}</p>}
      {removeFailed && <p role="alert">No se pudo quitar. Probá de nuevo.</p>}
      <ul className="title-list">
        {shown?.map((t) => (
          <li key={t.id}>
            <button className="open" aria-label={`Ver ${t.title}`} onClick={() => openScreen(() => setSelectedId(t.id))}>
              <TitleCard title={t.title} originalTitle={t.originalTitle} year={t.year} mediaType={t.mediaType} posterPath={t.posterPath}>
                <small>{`IMDb ${imdbScore(t.imdbRating)} · RT ${rtScore(t.rottenTomatoes)}`}</small>
                {t.status === 'watched' && t.watchedAt ? (
                  <>
                    <small>{`Vista el ${ratingsDate(t.watchedAt)}`}</small>
                    <small>{ourScores(t)}</small>
                  </>
                ) : (
                  <>
                    <small>{`La agregó ${nameOf(t.addedBy)}`}</small>
                    {t.originNote && <small>{`De dónde vino: ${t.originNote}`}</small>}
                  </>
                )}
              </TitleCard>
            </button>
            <button className="remove" aria-label={`Quitar ${t.title}`} onClick={() => remove(t)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {tab === 'to_watch' && (
        <button className="add" aria-label="Agregar" onClick={() => openScreen(() => setAdding(true))}>
          +
        </button>
      )}
    </section>
  )
}
