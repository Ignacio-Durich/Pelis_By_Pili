import { useCallback, useEffect, useRef, useState } from 'react'
import { listShared, subscribeShared, type SharedItem } from './sharedApi'

// La bandeja de compartidos, siempre al día, como useBumble: se carga al montar, ante cada
// cambio de Realtime y al volver la app al frente. Sin conexión queda lo último que se vio.
export function useShared(coupleId: string): { items: SharedItem[] | null; load: () => void } {
  const [items, setItems] = useState<SharedItem[] | null>(null)
  // Solo cuenta la respuesta del último pedido: una vieja que llega tarde no pisa a la nueva.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    listShared(coupleId).then(
      (list) => {
        if (request === latest.current) setItems(list)
      },
      () => {},
    )
  }, [coupleId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeShared(coupleId, load)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coupleId, load])

  return { items, load }
}
