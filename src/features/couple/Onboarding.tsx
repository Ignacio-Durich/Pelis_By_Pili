import { useState } from 'react'
import { acceptInvite, CoupleError, createCouple, type CoupleErrorKind } from './coupleApi'
import { parseInviteToken } from './invite'
import { coupleMessages } from './messages'

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CoupleErrorKind | null>(null)
  // Se lee de la URL en cada render: así el token sobrevive al login sin guardarlo en otro lado.
  const token = parseInviteToken(window.location.href)

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (token) window.history.replaceState(null, '', '/')
      onDone()
    } catch (e) {
      const kind = e instanceof CoupleError ? e.kind : 'network'
      // Una invitación rechazada no sirve más: se descarta para poder crear un espacio propio.
      if (token && kind !== 'network') window.history.replaceState(null, '', '/')
      setError(kind)
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>Pelis By Pili</h1>
      {token ? (
        <>
          <p>Te invitaron a un espacio</p>
          <button disabled={busy} onClick={() => run(() => acceptInvite(token))}>
            Unirme
          </button>
        </>
      ) : (
        <button disabled={busy} onClick={() => run(createCouple)}>
          Crear nuestro espacio
        </button>
      )}
      {error && <p role="alert">{coupleMessages[error]}</p>}
    </main>
  )
}
