import { useState, type FormEvent } from 'react'
import { formatScore, parseScore } from './ratings'
import { enqueue, pendingFor } from '../../lib/offline'
import { setMyScore, TitleError, type Score, type TitleErrorKind } from './titlesApi'
import { isNetworkError, usePendingOwner } from './useTitles'

const messages: Partial<Record<TitleErrorKind, string>> = {
  not_found: 'Este título ya no está en la lista',
  not_watched: 'Márquenla como vista para puntuarla.',
}
const SAVE_FAILED = 'No se pudo guardar. Probá de nuevo.'

export function MyScore({ titleId, current }: { titleId: string; current: Score | null }) {
  const [text, setText] = useState(current ? formatScore(current.score) : '')
  const [note, setNote] = useState(current?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [queued, setQueued] = useState(false)
  const owner = usePendingOwner()
  const [error, setError] = useState<string | null>(null)
  const score = parseScore(text)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (score === null) return
    setBusy(true)
    setSaved(false)
    setQueued(false)
    setError(null)
    // Si ya hay algo esperando, esto va detrás (así se manda en orden).
    if (pendingFor(owner).length > 0) {
      enqueue(owner, { kind: 'score', titleId, score, note })
      setQueued(true)
      setBusy(false)
      return
    }
    try {
      await setMyScore(titleId, score, note)
      setSaved(true)
    } catch (e) {
      // Sin red queda pendiente en el celular y se manda al volver la conexión.
      if (isNetworkError(e)) {
        enqueue(owner, { kind: 'score', titleId, score, note })
        setQueued(true)
        return
      }
      setError((e instanceof TitleError && messages[e.kind]) || SAVE_FAILED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="my-score" onSubmit={save}>
      <h3>Tu puntaje</h3>
      <label>
        Del 1 al 10
        <input inputMode="decimal" placeholder="Ej.: 8,75" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {text.trim() !== '' && score === null && <small>Poné un número del 1 al 10, con hasta 2 decimales</small>}
      <label>
        Una nota (opcional)
        <textarea rows={4} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" disabled={score === null || busy}>
        Guardar
      </button>
      {saved && <p>Guardado</p>}
      {queued && <p>⏳ Se guarda cuando vuelva la conexión</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
