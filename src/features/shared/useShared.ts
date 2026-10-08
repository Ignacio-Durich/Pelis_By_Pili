import { readCache, saveCache } from '../../lib/offline'
import { useLive } from '../../lib/useLive'
import { listShared, subscribeShared, type SharedItem } from './sharedApi'

// La última bandeja queda en el celular: se muestra enseguida y sin conexión.
const listAndSave = (coupleId: string) =>
  listShared(coupleId).then((list) => {
    saveCache('shared', coupleId, list)
    return list
  })
const saved = (coupleId: string) => readCache<SharedItem[]>('shared', coupleId) ?? undefined

// La bandeja de compartidos, siempre al día. null = todavía no hay nada para mostrar.
export function useShared(coupleId: string): { items: SharedItem[] | null; load: () => void } {
  const { data, load } = useLive(coupleId, listAndSave, subscribeShared, saved)
  return { items: data ?? null, load }
}
