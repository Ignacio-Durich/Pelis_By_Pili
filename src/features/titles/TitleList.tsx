import { useCallback, useEffect, useState } from 'react'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { AddTitle } from './AddTitle'
import { TitleCard } from './TitleCard'
import { listTitles, removeTitle, subscribeTitles, type Title } from './titlesApi'

export function TitleList() {
  const { coupleId } = useCouple()
  const nameOf = useMemberName()
  // null = cargando
  const [titles, setTitles] = useState<Title[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [adding, setAdding] = useState(false)

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

  if (adding) return <AddTitle coupleId={coupleId} titles={titles ?? []} onClose={() => setAdding(false)} />

  return (
    <section className="titles">
      <h2>Por ver</h2>
      {offline && (
        <>
          <p role="alert">Sin conexión. Probá de nuevo.</p>
          <button onClick={load}>Reintentar</button>
        </>
      )}
      {titles === null && !offline && <p>Cargando…</p>}
      {titles?.length === 0 && <p>Nuestra lista está vacía</p>}
      {removeFailed && <p role="alert">No se pudo quitar. Probá de nuevo.</p>}
      <ul className="title-list">
        {titles?.map((t) => (
          <li key={t.id}>
            <TitleCard title={t.title} originalTitle={t.originalTitle} year={t.year} mediaType={t.mediaType} posterPath={t.posterPath}>
              <small>{`La agregó ${nameOf(t.addedBy)}`}</small>
              {t.originNote && <small>{`De dónde vino: ${t.originNote}`}</small>}
            </TitleCard>
            <button className="remove" aria-label={`Quitar ${t.title}`} onClick={() => remove(t)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <button className="add" aria-label="Agregar" onClick={() => setAdding(true)}>
        +
      </button>
    </section>
  )
}
