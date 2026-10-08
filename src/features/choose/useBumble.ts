import { useCallback, useEffect, useState } from 'react'
import { loadOpenBumble, subscribeBumble, type BumbleSession } from './bumbleApi'

// La partida de dos celulares, siempre al día, como useTitles: se carga al montar, ante cada
// cambio de Realtime y al volver la app al frente.
export function useBumble(coupleId: string): { session: BumbleSession | null | undefined; offline: boolean; load: () => void } {
  // undefined = cargando; null = no hay partida abierta
  const [session, setSession] = useState<BumbleSession | null | undefined>(undefined)
  const [offline, setOffline] = useState(false)

  const load = useCallback(() => {
    loadOpenBumble(coupleId).then(
      (s) => {
        setSession(s)
        setOffline(false)
      },
      () => setOffline(true),
    )
  }, [coupleId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeBumble(coupleId, load)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coupleId, load])

  return { session, offline, load }
}
