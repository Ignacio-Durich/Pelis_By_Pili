import { useCallback, useEffect, useRef, useState } from 'react'
import { applyPending, flushPending, pendingFor, readCache, saveCache, subscribePending, type FlushResult, type Pending } from '../../lib/offline'
import { useUserId } from '../auth/sessionContext'
import { useCouple } from '../couple/coupleContext'
import { addSharedItem } from '../shared/sharedApi'
import { listTitles, setMyScore, setWatched, subscribeTitles, TitleError, type Title } from './titlesApi'

export type ShownTitle = Title & { pending?: boolean }
export type Dropped = FlushResult['dropped'][number]

// De quién es la cola de pendientes: la cuenta en esta pareja.
export function usePendingOwner(): string {
  return `${useUserId()}:${useCouple().coupleId}`
}

// Un error de red (o del servidor sin código conocido) se reintenta; uno con motivo se descarta.
export const isNetworkError = (e: unknown) => (e instanceof TitleError && e.kind === 'network') || (e instanceof Error && e.message === 'network')

const send = (p: Pending) =>
  p.kind === 'watched' ? setWatched(p.titleId, p.watched) : p.kind === 'score' ? setMyScore(p.titleId, p.score, p.note) : addSharedItem(p.query, p.note)

export function droppedMessage({ item, error }: Dropped): string {
  if (item.kind === 'later') {
    return error instanceof Error && error.message === 'inbox_full'
      ? 'No se pudo guardar un título anotado: la bandeja de Compartidos está llena'
      : 'No se pudo guardar un título anotado'
  }
  if (error instanceof TitleError && error.kind === 'not_found') return 'No se pudo guardar un cambio: ese título ya no está en la lista'
  if (error instanceof TitleError && error.kind === 'not_watched') return 'No se pudo guardar un cambio: para puntuar, primero tiene que estar vista'
  return 'No se pudo guardar un cambio'
}

// La lista del espacio, siempre al día: se carga al montar, ante cada cambio de Realtime, al volver
// la app al frente y al volver la conexión. Sin red se usa la última guardada, con lo pendiente
// aplicado; lo pendiente se manda cada vez que una carga sale bien.
export function useTitles(coupleId: string): {
  titles: ShownTitle[] | null
  offline: boolean
  load: () => void
  pending: number
  dropped: Dropped[]
  clearDropped: () => void
} {
  const userId = useUserId()
  const owner = `${userId}:${coupleId}`
  // null = cargando. La lista guardada se muestra enseguida (sin red, Supabase reintenta varios
  // segundos antes de rendirse) y se reemplaza cuando llega la del servidor.
  const [titles, setTitles] = useState<Title[] | null>(() => readCache<Title[]>('titles', coupleId))
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [pending, setPending] = useState<Pending[]>(() => pendingFor(owner))
  const [dropped, setDropped] = useState<Dropped[]>([])
  // Para volver a cargar después de mandar lo pendiente (load no se puede llamar a sí mismo).
  const reload = useRef<() => void>(() => {})

  const load = useCallback(() => {
    listTitles(coupleId).then(
      (list) => {
        saveCache('titles', coupleId, list)
        setTitles(list)
        setOffline(false)
        flushPending(owner, send, isNetworkError).then((result) => {
          if (result.dropped.length) setDropped((d) => [...d, ...result.dropped])
          if (result.sent || result.dropped.length) reload.current()
        })
      },
      () => {
        setOffline(true)
        setTitles((current) => current ?? readCache<Title[]>('titles', coupleId))
      },
    )
  }, [coupleId, owner])

  useEffect(() => {
    reload.current = load
  }, [load])

  useEffect(() => {
    load()
    const unsubscribe = subscribeTitles(coupleId, load)
    const stopPending = subscribePending(() => setPending(pendingFor(owner)))
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    return () => {
      unsubscribe()
      stopPending()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
    }
  }, [coupleId, owner, load])

  return {
    titles: titles && applyPending(titles, pending, userId),
    offline,
    load,
    pending: pending.length,
    dropped,
    clearDropped: () => setDropped([]),
  }
}
