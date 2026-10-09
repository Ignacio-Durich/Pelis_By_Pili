import { useEffect, useRef } from 'react'
import { fetchTitleDetail } from './detailApi'
import type { Title } from './titlesApi'

const WEEK_MS = 7 * 86_400_000
const MAX_PER_MOUNT = 30

const needsDetails = (t: Title) => t.detailsUpdatedAt === null || Date.now() - new Date(t.detailsUpdatedAt).getTime() >= WEEK_MS

// Completa en segundo plano duración, géneros y plataformas (y puntajes) de los títulos que no
// los tienen o los tienen viejos: la función title-detail los guarda y Realtime trae la lista
// nueva. De a uno, y hasta 30 por pantalla, para no cargar a TMDB (OMDb ya está cuidado: la
// función solo lo consulta si los puntajes tienen más de una semana). También los vistos: el
// director y las temporadas se ven en "Vistas". Corre uno solo a la vez en toda la app, porque
// cada pantalla con títulos (la lista y los modos de Elegir) lo usa vía useTitles.
let running = false

export function useBackfillDetails(titles: Title[] | null): void {
  const tried = useRef(new Set<string>())

  useEffect(() => {
    if (!titles || running) return
    const queue = titles.filter((t) => needsDetails(t) && !tried.current.has(t.id)).slice(0, MAX_PER_MOUNT - tried.current.size)
    if (queue.length === 0) return
    running = true
    void (async () => {
      for (const t of queue) {
        tried.current.add(t.id)
        await fetchTitleDetail(t.id).catch(() => {})
      }
      running = false
    })()
  }, [titles])
}
