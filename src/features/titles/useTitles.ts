import { useCallback, useEffect, useState } from 'react'
import { listTitles, subscribeTitles, type Title } from './titlesApi'

// La lista del espacio, siempre al día: se carga al montar, ante cada cambio de Realtime y al
// volver la app al frente (en segundo plano el Realtime puede haberse cortado).
export function useTitles(coupleId: string): { titles: Title[] | null; offline: boolean; load: () => void } {
  // null = cargando
  const [titles, setTitles] = useState<Title[] | null>(null)
  const [offline, setOffline] = useState(false)

  const load = useCallback(() => {
    listTitles(coupleId).then(
      (list) => {
        setTitles(list)
        setOffline(false)
      },
      () => setOffline(true),
    )
  }, [coupleId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeTitles(coupleId, load)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coupleId, load])

  return { titles, offline, load }
}
