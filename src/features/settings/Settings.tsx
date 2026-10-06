import { useState } from 'react'
import { signOut } from '../auth/authApi'
import { CoupleError, createInvite, type CoupleErrorKind } from '../couple/coupleApi'
import { useCouple } from '../couple/coupleContext'
import { buildInviteLink } from '../couple/invite'
import { coupleMessages } from '../couple/messages'

export function Settings() {
  const { memberCount } = useCouple()
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<CoupleErrorKind | null>(null)

  async function invite() {
    setBusy(true)
    setError(null)
    try {
      setLink(buildInviteLink(window.location.origin, await createInvite()))
    } catch (e) {
      setError(e instanceof CoupleError ? e.kind : 'network')
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  return (
    <>
      <h1>Ajustes</h1>
      {memberCount < 2 ? (
        <section>
          <button disabled={busy} onClick={invite}>
            Invitar a mi pareja
          </button>
          {link && (
            <>
              <input readOnly aria-label="Enlace de invitación" value={link} onFocus={(e) => e.target.select()} />
              <button onClick={() => copy(link)}>Copiar enlace</button>
              {copied && <p>¡Copiado!</p>}
            </>
          )}
          {error && <p role="alert">{coupleMessages[error]}</p>}
        </section>
      ) : (
        <p>Son dos personas en este espacio</p>
      )}
      <button onClick={() => signOut()}>Cerrar sesión</button>
    </>
  )
}
