import { useState } from 'react'
import { acceptInvite, CoupleError, createCouple, type CoupleErrorKind } from './coupleApi'
import { parseInviteToken } from './invite'
import { coupleMessages } from './messages'

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CoupleErrorKind | null>(null)
  // Se lee de la URL en cada render: así el token sobrevive al login sin guardarlo en otro lado.
  const token = parseInviteToken(window.location.href)
  // En iPhone la app de la pantalla de inicio no recibe el enlace (se abre en Safari): se pega acá.
  const [pasted, setPasted] = useState('')
  const pastedToken = parseInviteToken(pasted)

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (token) window.history.replaceState(null, '', '/')
      onDone()
    } catch (e) {
      const kind = e instanceof CoupleError ? e.kind : 'network'
      // Ya está en un espacio (lo aceptó en otra ventana, o se perdió la respuesta): volver a leerlo.
      if (kind === 'already_in_couple') {
        if (token) window.history.replaceState(null, '', '/')
        return onDone()
      }
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
        <>
          <label>
            ¿Te mandaron un enlace de invitación? Pegalo acá
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </label>
          <button disabled={busy || !pastedToken} onClick={() => pastedToken && run(() => acceptInvite(pastedToken))}>
            Unirme
          </button>
          <button disabled={busy} onClick={() => run(createCouple)}>
            Crear nuestro espacio
          </button>
        </>
      )}
      {error && <p role="alert">{coupleMessages[error]}</p>}
    </main>
  )
}
