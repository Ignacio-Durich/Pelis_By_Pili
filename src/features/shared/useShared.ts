import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, saveCache } from '../../lib/offline'
import { listShared, subscribeShared, type SharedItem } from './sharedApi'

// La bandeja de compartidos, siempre al día, como useBumble: se carga al montar, ante cada
// cambio de Realtime, al volver la app al frente y al volver la conexión. La última bandeja queda
// en el celular: se muestra enseguida y sin conexión.
export function useShared(coupleId: string): { items: SharedItem[] | null; load: () => void } {
  const [items, setItems] = useState<SharedItem[] | null>(() => readCache<SharedItem[]>('shared', coupleId))
  // Solo cuenta la respuesta del último pedido: una vieja que llega tarde no pisa a la nueva.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    listShared(coupleId).then(
      (list) => {
        if (request !== latest.current) return
        saveCache('shared', coupleId, list)
        setItems(list)
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
    window.addEventListener('online', load)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
    }
  }, [coupleId, load])

  return { items, load }
}
