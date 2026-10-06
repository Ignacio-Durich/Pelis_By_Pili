import { useEffect, useState, type ReactNode } from 'react'
import { getMyCouple } from './coupleApi'
import { CoupleContext, type Couple } from './coupleContext'
import { coupleMessages } from './messages'
import { Onboarding } from './Onboarding'

export function CoupleGate({ children }: { children: ReactNode }) {
  // undefined = cargando, null = sin espacio
  const [couple, setCouple] = useState<Couple | null | undefined>(undefined)
  const [offline, setOffline] = useState(false)

  function fetchCouple() {
    getMyCouple().then(setCouple, () => setOffline(true))
  }

  function reload() {
    setOffline(false)
    setCouple(undefined)
    fetchCouple()
  }

  useEffect(fetchCouple, [])

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
  return <CoupleContext.Provider value={couple}>{children}</CoupleContext.Provider>
}
