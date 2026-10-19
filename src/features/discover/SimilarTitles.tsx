import { useEffect, useState } from 'react'
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
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
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
  }, [title.id, attempt])

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
      {failed ? (
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
        <p>Buscando parecidas…</p>
      ) : items.length === 0 ? (
        <p>TMDB no tiene parecidas para este título</p>
      ) : (
        <RecommendationList
          coupleId={coupleId}
          items={items}
          titles={titles}
          originNote={() => `Parecida a ${title.title}`}
          hidden={hidden}
          onHide={onHide}
        />
      )}
    </>
  )
}
