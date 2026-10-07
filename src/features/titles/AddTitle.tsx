import { useEffect, useRef, useState } from 'react'
import { useMemberName } from '../couple/coupleContext'
import { fetchTitleDetail } from './detailApi'
import { searchTitles, type SearchResult } from './searchApi'
import { TitleCard } from './TitleCard'
import { addTitle, TitleError, type Title, type TitleErrorKind } from './titlesApi'

type Props = { coupleId: string; titles: Title[]; onClose: () => void }

const addMessages: Record<TitleErrorKind, string> = {
  duplicate: 'Ya está en la lista',
  network: 'No se pudo agregar. Probá de nuevo.',
}

const keyOf = (t: { mediaType: string; tmdbId: number }) => `${t.mediaType}:${t.tmdbId}`

export function AddTitle({ coupleId, titles, onClose }: Props) {
  const nameOf = useMemberName()
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  // null = todavía no se buscó nada
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [addError, setAddError] = useState<TitleErrorKind | null>(null)
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

  async function add(result: SearchResult) {
    if (busyKey) return
    setBusyKey(keyOf(result))
    setAddError(null)
    try {
      const id = await addTitle(coupleId, result, note)
      // En segundo plano: la función guarda los puntajes y Realtime actualiza la tarjeta.
      fetchTitleDetail(id).catch(() => {})
      setAdded((list) => [...list, keyOf(result)])
      setNote('')
    } catch (e) {
      setAddError(e instanceof TitleError ? e.kind : 'network')
    } finally {
      setBusyKey(null)
    }
  }

  const existing = new Map(titles.map((t) => [keyOf(t), t]))
  // Con menos de 2 letras no hay búsqueda en curso: lo que haya quedado de antes no se muestra.
  const active = query.trim().length >= 2

  return (
    <section className="add-title">
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
      <button onClick={onClose}>Volver</button>
      {active && searching && <p>Buscando…</p>}
      {active && searchFailed && <p role="alert">No se pudo buscar. Probá de nuevo.</p>}
      {addError && <p role="alert">{addMessages[addError]}</p>}
      {active && !searching && results?.length === 0 && <p>No encontramos nada con ese nombre</p>}
      <ul className="title-list">
        {active &&
          results?.map((r) => {
            const key = keyOf(r)
            const inList = existing.get(key)
            const status = added.includes(key)
              ? '✓ Agregada'
              : inList
                ? `Ya está en la lista (la agregó ${nameOf(inList.addedBy)})`
                : null
            return (
              <li key={key}>
                <button className="result" disabled={!!inList || added.includes(key) || busyKey !== null} onClick={() => add(r)}>
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
