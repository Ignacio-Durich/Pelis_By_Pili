import { useEffect, useState } from 'react'
import { useCouple } from '../couple/coupleContext'
import { TitleDetail } from '../titles/TitleDetail'
import { useTitles } from '../titles/useTitles'
import { discoverKey, fetchDiscover, type Discover as DiscoverData, type Recommendation } from './discoverApi'
import { RecommendationList } from './RecommendationList'

const originNote = () => 'De Descubrir'

export function Discover() {
  const { coupleId } = useCouple()
  const { titles, load } = useTitles(coupleId)
  const [data, setData] = useState<DiscoverData | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)
  // 'both', 'news' o el id de un miembro.
  const [section, setSection] = useState('both')
  // Una sola lista de ocultas para todas las secciones: el mismo título no aparece en dos lados.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  // Mientras no cambie lo visto ni los puntajes, fetchDiscover devuelve lo que ya tiene.
  const key = titles ? discoverKey(titles) : null

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (key === null || !online) return
    let current = true
    fetchDiscover(key).then(
      (d) => {
        if (!current) return
        setData(d)
        setFailed(false)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [key, online, attempt])

  const opened = titles?.find((t) => t.id === openId)
  if (opened) return <TitleDetail title={opened} titles={titles ?? []} onClose={() => setOpenId(null)} onChanged={load} />

  function onHide(recKey: string, hide: boolean) {
    setHidden((set) => {
      const next = new Set(set)
      if (hide) next.add(recKey)
      else next.delete(recKey)
      return next
    })
  }

  const list = (items: Recommendation[]) => (
    <RecommendationList
      key={section}
      coupleId={coupleId}
      items={items}
      titles={titles ?? []}
      originNote={originNote}
      hidden={hidden}
      onHide={onHide}
      onOpenWatched={setOpenId}
    />
  )

  function content(d: DiscoverData) {
    if (d.forBoth.length === 0 && d.forEach.length === 0)
      return <p>Cuando marquen títulos como vistos y les pongan puntaje, acá van a aparecer recomendaciones</p>
    // Un miembro que ya no tiene opción (cambió lo puntuado) vuelve a "Para los dos".
    const current = section === 'news' || d.forEach.some((m) => m.userId === section) ? section : 'both'
    const options = [
      { id: 'both', label: 'Para los dos' },
      ...d.forEach.map((m) => ({ id: m.userId, label: m.name })),
      { id: 'news', label: 'Novedades' },
    ]
    return (
      <>
        <div className="segmented">
          {options.map((o) => (
            <button key={o.id} aria-pressed={current === o.id} onClick={() => setSection(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        {current === 'news' ? (
          <>
            <h2>En cines</h2>
            {list(d.inTheaters)}
            <h2>En sus plataformas</h2>
            {d.onPlatforms ? (
              <>
                {d.platformNames.length > 0 && <small>{d.platformNames.join(' · ')}</small>}
                {list(d.onPlatforms)}
              </>
            ) : (
              <p>Elijan sus plataformas en Ajustes para ver lo nuevo que tienen</p>
            )}
          </>
        ) : (
          list(current === 'both' ? d.forBoth : (d.forEach.find((m) => m.userId === current)?.results ?? []))
        )}
      </>
    )
  }

  return (
    <section className="titles">
      <h1>Descubrir</h1>
      {!online && <p className="offline-note">Sin conexión: no se pueden buscar recomendaciones ahora.</p>}
      {failed && online ? (
        <>
          <p role="alert">No se pudieron cargar las recomendaciones</p>
          <button
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
          >
            Reintentar
          </button>
        </>
      ) : data ? (
        content(data)
      ) : (
        online && <p>Buscando recomendaciones…</p>
      )}
    </section>
  )
}
