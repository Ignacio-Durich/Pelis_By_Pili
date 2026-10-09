import { useState } from 'react'
import { FeedbackError, sendFeedback, type FeedbackErrorKind } from './feedbackApi'

const messages: Record<FeedbackErrorKind, string> = {
  invalid_feedback: 'El comentario tiene que tener entre 1 y 2000 letras.',
  too_many: 'Mandaste muchos hoy. Probá mañana.',
  network: 'No se pudo mandar. Probá de nuevo.',
}

export function Feedback() {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<FeedbackErrorKind | null>(null)

  async function send() {
    setBusy(true)
    setSent(false)
    setError(null)
    try {
      await sendFeedback(body.trim())
      setBody('')
      setSent(true)
    } catch (e) {
      setError(e instanceof FeedbackError ? e.kind : 'network')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="feedback">
      <h2>Comentarios y errores</h2>
      <p>Contanos qué mejorar o qué falló.</p>
      <textarea
        rows={4}
        maxLength={2000}
        aria-label="Comentario"
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          setSent(false)
        }}
      />
      <button disabled={busy || !body.trim()} onClick={send}>
        {busy ? 'Mandando…' : 'Mandar'}
      </button>
      <p role="status">{sent && '¡Gracias! Nacho lo va a leer.'}</p>
      {error && <p role="alert">{messages[error]}</p>}
    </section>
  )
}
