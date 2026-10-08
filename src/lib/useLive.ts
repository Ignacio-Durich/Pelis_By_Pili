import { useCallback, useEffect, useRef, useState } from 'react'

// Datos de la pareja que se mantienen al día: se cargan al montar, ante cada aviso de Realtime, al
// volver la app al frente y al volver la conexión. `fetch` y `subscribe` son funciones fijas del
// módulo (no se recrean); `initial` da lo guardado en el celular, si hay.
export function useLive<T>(
  key: string,
  fetch: (key: string) => Promise<T>,
  subscribe: (key: string, onChange: () => void) => () => void,
  initial?: (key: string) => T | undefined,
): { data: T | undefined; offline: boolean; load: () => void } {
  // undefined = cargando
  const [data, setData] = useState<T | undefined>(() => initial?.(key))
  const [offline, setOffline] = useState(false)
  // Solo cuenta la respuesta del último pedido: una vieja que llega tarde no pisa a la nueva.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    fetch(key).then(
      (value) => {
        if (request !== latest.current) return
        setData(value)
        setOffline(false)
      },
      () => {
        if (request === latest.current) setOffline(true)
      },
    )
  }, [key, fetch])

  useEffect(() => {
    load()
    const unsubscribe = subscribe(key, load)
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
  }, [key, subscribe, load])

  return { data, offline, load }
}
