import { useState, type FormEvent } from 'react'
import { CoupleError, setDisplayName, type CoupleErrorKind } from './coupleApi'
import { coupleMessages } from './messages'

export function NameForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CoupleErrorKind | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await setDisplayName(name)
      onDone()
    } catch (e) {
      setError(e instanceof CoupleError ? e.kind : 'network')
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>¿Cómo te llamás?</h1>
      <p>Así te va a ver tu pareja en la lista.</p>
      <form onSubmit={save}>
        <label>
          Tu nombre
          <input value={name} maxLength={30} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || !name.trim()}>
          Guardar
        </button>
      </form>
      {error && <p role="alert">{coupleMessages[error]}</p>}
    </main>
  )
}
