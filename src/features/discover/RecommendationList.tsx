import { useEffect, useState } from 'react'
import { fetchTitleDetail } from '../titles/detailApi'
import { imdbScore } from '../titles/ratings'
import { searchDetails, type Extra } from '../titles/searchApi'
import { TitleCard } from '../titles/TitleCard'
import { addTitle, removeTitle, TitleError, type Title } from '../titles/titlesApi'
import { dismissTitle, recKey, undismissTitle, type Recommendation } from './discoverApi'

type Props = {
  coupleId: string
  items: Recommendation[]
  titles: Title[] // la lista: lo que ya está no se ofrece para agregar
  originNote: (r: Recommendation) => string // "De Descubrir" o "Parecida a <título>"
  hidden: Set<string> // claves descartadas o agregadas en otra sección
  onHide: (key: string, hide: boolean) => void // avisa al padre para sacarla de las otras secciones
  onOpenWatched?: (titleId: string) => void
}

const messages = {
  duplicate: 'Ya está en la lista',
  network: 'No se pudo agregar. Probá de nuevo.',
  remove: 'No se pudo sacar. Probá de nuevo.',
  dismiss: 'No se pudo descartar. Probá de nuevo.',
  undismiss: 'No se pudo deshacer. Probá de nuevo.',
}


// "A", "A y B", "A, B y C"
const joinNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`)

export function RecommendationList({ coupleId, items, titles, originNote, hidden, onHide, onOpenWatched }: Props) {
  const [shown, setShown] = useState(10)
  const [extras, setExtras] = useState<Record<string, Extra>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // Lo agregado desde acá (clave → id): tocarlo de nuevo lo saca de la lista.
  const [added, setAdded] = useState<Record<string, string>>({})
  // Lo descartado desde acá: se queda con su "Deshacer" aunque el padre ya lo oculte.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [error, setError] = useState<keyof typeof messages | null>(null)

  const existing = new Map(titles.map((t) => [recKey(t), t]))
  // Lo que ya está en la lista no se ofrece (salvo lo recién agregado acá, que se puede sacar, y las
  // series vistas con temporada nueva). Con Descubrir guardado en memoria, lo agregado no vuelve.
  const available = items.filter((r) => {
    const key = recKey(r)
    if (key in added || dismissed.has(key)) return true
    return !hidden.has(key) && (!existing.has(key) || !!r.watchedTitleId)
  })
  const visible = available.slice(0, shown)
  // Los datos extra se piden solo para lo que se ve (searchDetails guarda lo ya pedido).
  const visibleKeys = visible.map(recKey).join('|')

  useEffect(() => {
    if (!visibleKeys) return
    searchDetails(visibleKeys.split('|').map((k) => ({ mediaType: k.split(':')[0] as 'movie' | 'tv', tmdbId: Number(k.split(':')[1]) }))).then(
      (found) => setExtras((map) => ({ ...map, ...found })),
      // Sin estos datos las tarjetas igual sirven.
      () => {},
    )
  }, [visibleKeys])

  // Corre una acción de a una; si falla deja el aviso con ese mensaje.
  async function run(key: string, failure: keyof typeof messages, action: () => Promise<void>) {
    if (busyKey) return
    setBusyKey(key)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(failure === 'network' && e instanceof TitleError && e.kind === 'duplicate' ? 'duplicate' : failure)
    } finally {
      setBusyKey(null)
    }
  }

  const add = (r: Recommendation) =>
    run(recKey(r), 'network', async () => {
      const id = await addTitle(coupleId, r, originNote(r))
      // En segundo plano: la función guarda los puntajes y Realtime actualiza la tarjeta.
      fetchTitleDetail(id).catch(() => {})
      setAdded((map) => ({ ...map, [recKey(r)]: id }))
      onHide(recKey(r), true)
    })

  const takeOut = (r: Recommendation) =>
    run(recKey(r), 'remove', async () => {
      await removeTitle(added[recKey(r)])
      setAdded((map) => Object.fromEntries(Object.entries(map).filter(([k]) => k !== recKey(r))))
      onHide(recKey(r), false)
    })

  const dismiss = (r: Recommendation) =>
    run(recKey(r), 'dismiss', async () => {
      await dismissTitle(r.mediaType, r.tmdbId)
      setDismissed((set) => new Set(set).add(recKey(r)))
      onHide(recKey(r), true)
    })

  const undo = (r: Recommendation) =>
    run(recKey(r), 'undismiss', async () => {
      await undismissTitle(r.mediaType, r.tmdbId)
      setDismissed((set) => new Set([...set].filter((k) => k !== recKey(r))))
      onHide(recKey(r), false)
    })

  const toggleDetail = (key: string) =>
    setOpen((set) => {
      const next = new Set(set)
      if (!next.delete(key)) next.add(key)
      return next
    })


  return (
    <>
      {error && <p role="alert">{messages[error]}</p>}
      <ul className="title-list rec-list">
        {visible.map((r) => {
          const key = recKey(r)
          if (dismissed.has(key)) {
            return (
              <li key={key} className="rec-dismissed">
                <span>Descartada · </span>
                <button className="small" disabled={busyKey !== null} onClick={() => undo(r)}>
                  Deshacer
                </button>
              </li>
            )
          }
          const justAdded = key in added
          const watchedSeries = !!r.watchedTitleId
          const status = watchedSeries
            ? 'Ya la vieron · salió una temporada nueva'
            : justAdded
              ? '✓ Agregada · tocala de nuevo para sacarla'
              : null
          const extra = extras[key]
          const detailOpen = open.has(key)
          return (
            <li key={key} className="rec-item">
              <button
                className="result"
                disabled={!watchedSeries && busyKey !== null}
                onClick={() => (watchedSeries ? onOpenWatched?.(r.watchedTitleId!) : justAdded ? takeOut(r) : add(r))}
              >
                <TitleCard
                  title={r.title}
                  originalTitle={r.originalTitle}
                  year={r.year}
                  mediaType={r.mediaType}
                  posterPath={r.posterPath}
                  director={extra?.director}
                  seasons={extra?.seasons}
                  runtime={extra?.runtime}
                >
                  {extra?.imdb && <small>{`IMDb ${imdbScore(extra.imdb)}`}</small>}
                  {r.newSeason && !watchedSeries && <small>Temporada nueva</small>}
                  {r.because && r.because.length > 0 && <small>{`Porque vieron ${joinNames(r.because)}`}</small>}
                  {r.platforms && r.platforms.length > 0 && <small>{`En ${r.platforms.join(' · ')}`}</small>}
                  {status && <small>{status}</small>}
                </TitleCard>
              </button>
              {!watchedSeries && (
                <div className="rec-actions">
                  <button className="small" aria-expanded={detailOpen} onClick={() => toggleDetail(key)}>
                    {detailOpen ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                  {!justAdded && (
                    <button className="small" disabled={busyKey !== null} onClick={() => dismiss(r)}>
                      No me interesa
                    </button>
                  )}
                </div>
              )}
              {detailOpen && (
                <div className="rec-detail">
                  {r.overview && <p>{r.overview}</p>}
                  {r.genres.length > 0 && <small>{r.genres.join(' · ')}</small>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {available.length > shown && (
        <button className="secondary" onClick={() => setShown((n) => n + 10)}>
          Ver más
        </button>
      )}
    </>
  )
}
