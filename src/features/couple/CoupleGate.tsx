import { useEffect, useState, type ReactNode } from 'react'
import { readCache, saveCache } from '../../lib/offline'
import { useUserId } from '../auth/sessionContext'
import { CoupleError, getMyCouple } from './coupleApi'
import { CoupleContext, type Couple } from './coupleContext'
import { coupleMessages } from './messages'
import { NameForm } from './NameForm'
import { Onboarding } from './Onboarding'

export function CoupleGate({ children }: { children: ReactNode }) {
  const userId = useUserId()
  // undefined = cargando, null = sin espacio
  // Con la pareja guardada se entra enseguida y se actualiza cuando contesta el servidor.
  const [couple, setCouple] = useState<Couple | null | undefined>(() => readCache<Couple | null>('couple', userId) ?? undefined)
  const [offline, setOffline] = useState(false)

  function fetchCouple() {
    // La pareja queda guardada con la cuenta como dueña: sin red se usa esa.
    getMyCouple().then(
      (c) => {
        saveCache('couple', userId, c)
        setCouple(c)
      },
      (e) => {
        const saved = e instanceof CoupleError && e.kind === 'network' ? readCache<Couple | null>('couple', userId) : null
        if (saved) setCouple((current) => current ?? saved)
        else setOffline(true)
      },
    )
  }

  function reload() {
    setOffline(false)
    setCouple(undefined)
    fetchCouple()
  }

  useEffect(fetchCouple, [userId])

  if (offline) {
    return (
      <main className="screen">
        <p>{coupleMessages.network}</p>
        <button onClick={reload}>Reintentar</button>
      </main>
    )
  }
  if (couple === undefined) return <main className="screen">Cargando…</main>
  if (couple === null) return <Onboarding onDone={reload} />
  if (!couple.members.find((m) => m.userId === userId)?.displayName) return <NameForm onDone={reload} />
  return <CoupleContext.Provider value={couple}>{children}</CoupleContext.Provider>
}
