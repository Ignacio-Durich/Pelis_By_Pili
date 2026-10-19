import { useEffect, useState } from 'react'
import { useOnline } from '../../lib/useOnline'
import { useCouple } from '../couple/coupleContext'
import type { Title } from '../titles/titlesApi'
import { fetchSimilar, type Recommendation } from './discoverApi'
import { RecommendationList } from './RecommendationList'

// "Parecidas a esta" en la ficha de una vista: lo que TMDB considera parecido a ese título.
export function SimilarTitles({ title, titles }: { title: Title; titles: Title[] }) {
  const { coupleId } = useCouple()
  const [items, setItems] = useState<Recommendation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const online = useOnline()
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!online) return
    let current = true
    fetchSimilar(title.id).then(
      (r) => {
        if (!current) return
        setItems(r)
        setFailed(false)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [title.id, online, attempt])

  function onHide(key: string, hide: boolean) {
    setHidden((set) => {
      const next = new Set(set)
      if (hide) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return (
    <>
      <h3>Parecidas a esta</h3>
      {!online && <p className="offline-note">Sin conexión: no se pueden buscar parecidas ahora.</p>}
      {failed && online ? (
        <>
          <p role="alert">No se pudieron cargar las parecidas</p>
          <button
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
          >
            Reintentar
          </button>
        </>
      ) : items === null ? (
        online && <p>Buscando parecidas…</p>
      ) : items.length === 0 ? (
        <p>TMDB no tiene parecidas para este título</p>
      ) : (
        <RecommendationList
          coupleId={coupleId}
          items={items}
          titles={titles}
          // La base acepta como mucho 200 caracteres en la nota de origen.
          originNote={() => `Parecida a ${title.title}`.slice(0, 200)}
          hidden={hidden}
          onHide={onHide}
        />
      )}
    </>
  )
}
