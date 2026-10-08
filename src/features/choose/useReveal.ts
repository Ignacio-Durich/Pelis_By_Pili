import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOpenReveal, subscribeReveal, type RevealSession } from './revealApi'

// La partida de Top 3 secreto con dos celulares, siempre al día, como useBumble: se carga al
// montar, ante cada cambio de Realtime y al volver la app al frente.
export function useReveal(coupleId: string): { session: RevealSession | null | undefined; offline: boolean; load: () => void } {
  // undefined = cargando; null = no hay partida abierta
  const [session, setSession] = useState<RevealSession | null | undefined>(undefined)
  const [offline, setOffline] = useState(false)
  // Solo cuenta la respuesta del último pedido: una vieja que llega tarde no pisa a la nueva.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    loadOpenReveal(coupleId).then(
      (s) => {
        if (request !== latest.current) return
        setSession(s)
        setOffline(false)
      },
      () => {
        if (request === latest.current) setOffline(true)
      },
    )
  }, [coupleId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeReveal(coupleId, load)
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
