import { useEffect, useRef } from 'react'
import { fetchTitleDetail } from './detailApi'
import type { Title } from './titlesApi'

const WEEK_MS = 7 * 86_400_000
const MAX_PER_MOUNT = 30

const needsDetails = (t: Title) => t.detailsUpdatedAt === null || Date.now() - new Date(t.detailsUpdatedAt).getTime() >= WEEK_MS

// Completa en segundo plano duración, géneros y plataformas (y puntajes) de los títulos que no
// los tienen o los tienen viejos: la función title-detail los guarda y Realtime trae la lista
// nueva. De a uno, y hasta 30 por vez que se abre la lista, para no cargar a TMDB (OMDb ya está
// cuidado: la función solo lo consulta si los puntajes tienen más de una semana).
export function useBackfillDetails(titles: Title[] | null): void {
  const tried = useRef(new Set<string>())
  const running = useRef(false)

  useEffect(() => {
    if (!titles || running.current) return
    const queue = titles.filter((t) => needsDetails(t) && !tried.current.has(t.id)).slice(0, MAX_PER_MOUNT - tried.current.size)
    if (queue.length === 0) return
    running.current = true
    void (async () => {
      for (const t of queue) {
        tried.current.add(t.id)
        await fetchTitleDetail(t.id).catch(() => {})
      }
      running.current = false
    })()
  }, [titles])
}
