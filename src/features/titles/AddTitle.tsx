import { useEffect, useRef, useState } from 'react'
import { enqueue } from '../../lib/offline'
import { useMemberName } from '../couple/coupleContext'
import { dismissShared, originNote, type SharedItem } from '../shared/sharedApi'
import { fetchTitleDetail } from './detailApi'
import { searchTitles, type SearchResult } from './searchApi'
import { TitleCard } from './TitleCard'
import { addTitle, removeTitle, TitleError, type Title } from './titlesApi'
import { usePendingOwner } from './useTitles'

// `shared`: se abrió desde la bandeja de compartidos, con la búsqueda y la nota ya cargadas.
type Props = { coupleId: string; titles: Title[]; onClose: () => void; shared?: SharedItem }

const addMessages: Record<'duplicate' | 'network' | 'remove', string> = {
  duplicate: 'Ya está en la lista',
  network: 'No se pudo agregar. Probá de nuevo.',
  remove: 'No se pudo sacar. Probá de nuevo.',
}

const keyOf = (t: { mediaType: string; tmdbId: number }) => `${t.mediaType}:${t.tmdbId}`

export function AddTitle({ coupleId, titles, onClose, shared }: Props) {
  const nameOf = useMemberName()
  const [query, setQuery] = useState(shared?.query ?? '')
  const [note, setNote] = useState(shared ? originNote(shared) : '')
  // El ítem compartido sale de la bandeja con el primer título agregado desde él.
  const dismissed = useRef(false)
  // null = todavía no se buscó nada
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // Lo agregado desde esta pantalla (clave → id): tocarlo de nuevo lo saca de la lista.
  const [added, setAdded] = useState<Record<string, string>>({})
  const [addError, setAddError] = useState<keyof typeof addMessages | null>(null)
  const owner = usePendingOwner()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [savedForLater, setSavedForLater] = useState(false)
  // La última consulta: una respuesta que llega tarde para una consulta vieja se descarta.
  const latest = useRef('')

  useEffect(() => {
    const q = query.trim()
    latest.current = q
    if (q.length < 2) return
    const timer = setTimeout(() => {
      setSearching(true)
      setSearchFailed(false)
      searchTitles(q).then(
        (found) => {
          if (latest.current !== q) return
          setResults(found)
          setSearching(false)
        },
        () => {
          if (latest.current !== q) return
          setSearchFailed(true)
          setSearching(false)
        },
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Sin poder buscar, el nombre queda en el celular y al volver la conexión va a Compartidos.
  function saveForLater() {
    enqueue(owner, { kind: 'later', query: query.trim(), note: note.trim() })
    setSavedForLater(true)
    setQuery('')
    setNote('')
  }

  async function add(result: SearchResult) {
    if (busyKey) return
    setBusyKey(keyOf(result))
    setAddError(null)
    try {
      const id = await addTitle(coupleId, result, note)
      // En segundo plano: la función guarda los puntajes y Realtime actualiza la tarjeta.
      fetchTitleDetail(id).catch(() => {})
      setAdded((map) => ({ ...map, [keyOf(result)]: id }))
      if (shared && !dismissed.current) {
        dismissed.current = true
        dismissShared(shared.id).catch(() => {})
      }
      // Desde un compartido la nota queda, por si el reel nombraba varias.
      if (!shared) setNote('')
    } catch (e) {
      setAddError(e instanceof TitleError && e.kind === 'duplicate' ? 'duplicate' : 'network')
    } finally {
      setBusyKey(null)
    }
  }

  async function takeOut(key: string) {
    if (busyKey) return
    setBusyKey(key)
    setAddError(null)
    try {
      await removeTitle(added[key])
      setAdded((map) => Object.fromEntries(Object.entries(map).filter(([k]) => k !== key)))
    } catch {
      setAddError('remove')
    } finally {
      setBusyKey(null)
    }
  }

  const existing = new Map(titles.map((t) => [keyOf(t), t]))
  // Con menos de 2 letras no hay búsqueda en curso: lo que haya quedado de antes no se muestra.
  const active = query.trim().length >= 2

  return (
    <section className="add-title">
      <button className="back" onClick={onClose}>
        Volver
      </button>
      <h2>Agregar</h2>
      <label>
        Buscar película o serie
        <input
          type="search"
          maxLength={100}
          placeholder="En español o en inglés"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        ¿De dónde vino? (opcional)
        <input maxLength={200} placeholder="Ej.: un reel, una recomendación" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {active && searching && <p>Buscando…</p>}
      {!online && <p>Sin conexión: no se puede buscar ahora.</p>}
      {online && active && searchFailed && <p role="alert">No se pudo buscar. Probá de nuevo.</p>}
      {(!online || (active && searchFailed)) && (
        <button className="secondary" disabled={!query.trim()} onClick={saveForLater}>
          Guardar para agregar después
        </button>
      )}
      {savedForLater && <p>⏳ Guardado. Va a aparecer en Compartidos cuando vuelva la conexión</p>}
      {addError && <p role="alert">{addMessages[addError]}</p>}
      {active && !searching && results?.length === 0 && <p>No encontramos nada con ese nombre</p>}
      <ul className="title-list">
        {active &&
          results?.map((r) => {
            const key = keyOf(r)
            const inList = existing.get(key)
            const justAdded = key in added
            const status = justAdded
              ? '✓ Agregada · tocala de nuevo para sacarla'
              : inList
                ? `Ya está en la lista (la agregó ${nameOf(inList.addedBy)})`
                : null
            return (
              <li key={key}>
                <button
                  className="result"
                  disabled={(!!inList && !justAdded) || busyKey !== null}
                  onClick={() => (justAdded ? takeOut(key) : add(r))}
                >
                  <TitleCard title={r.title} originalTitle={r.originalTitle} year={r.year} mediaType={r.mediaType} posterPath={r.posterPath}>
                    {r.overview && <small className="overview">{r.overview}</small>}
                    {status && <small>{status}</small>}
                  </TitleCard>
                </button>
              </li>
            )
          })}
      </ul>
    </section>
  )
}
