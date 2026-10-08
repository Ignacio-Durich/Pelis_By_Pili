import type { Title } from '../features/titles/titlesApi'

// Sin internet: lo último visto queda en el celular (con su dueño, así otra cuenta no lo usa) y lo
// que se hace sin red espera en una cola hasta que vuelve la conexión. Todo en try/catch: sin
// almacenamiento la app sigue andando, solo que sin red no tiene qué mostrar.

export function saveCache<T>(key: string, owner: string, value: T): void {
  try {
    localStorage.setItem(`pelis-cache:${key}`, JSON.stringify({ owner, value }))
  } catch {
    // Sin almacenamiento no hay copia para usar sin red.
  }
}

export function readCache<T>(key: string, owner: string): T | null {
  try {
    const saved = JSON.parse(localStorage.getItem(`pelis-cache:${key}`) ?? 'null') as { owner: string; value: T } | null
    return saved?.owner === owner ? saved.value : null
  } catch {
    return null
  }
}

export type Pending =
  | { id: string; kind: 'watched'; titleId: string; watched: boolean }
  | { id: string; kind: 'score'; titleId: string; score: number; note: string }
  | { id: string; kind: 'later'; query: string; note: string }

type NewPending = Pending extends infer P ? (P extends Pending ? Omit<P, 'id'> : never) : never

const queueKey = (owner: string) => `pelis-pending:${owner}`
const listeners = new Set<() => void>()

export function pendingFor(owner: string): Pending[] {
  try {
    const items = JSON.parse(localStorage.getItem(queueKey(owner)) ?? '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function write(owner: string, items: Pending[]) {
  try {
    if (items.length) localStorage.setItem(queueKey(owner), JSON.stringify(items))
    else localStorage.removeItem(queueKey(owner))
  } catch {
    // Sin almacenamiento el cambio no sobrevive a una recarga.
  }
  listeners.forEach((cb) => cb())
}

export function enqueue(owner: string, item: NewPending): Pending {
  const full = { ...item, id: crypto.randomUUID() } as Pending
  write(owner, [...pendingFor(owner), full])
  return full
}

export function subscribePending(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export type FlushResult = { sent: number; dropped: { item: Pending; error: unknown }[] }

const running = new Map<string, Promise<FlushResult>>()

// Manda en orden. Un error de red corta (lo que falta queda para la próxima); cualquier otro
// error descarta ese pendiente y sigue. Dos llamadas a la vez comparten la misma corrida, así
// nada se manda dos veces.
export function flushPending(owner: string, send: (item: Pending) => Promise<void>, isNetwork: (e: unknown) => boolean): Promise<FlushResult> {
  const current = running.get(owner)
  if (current) return current
  const run = (async () => {
    const result: FlushResult = { sent: 0, dropped: [] }
    for (let item = pendingFor(owner)[0]; item; item = pendingFor(owner)[0]) {
      try {
        await send(item)
        result.sent++
      } catch (error) {
        if (isNetwork(error)) break
        result.dropped.push({ item, error })
      }
      write(
        owner,
        pendingFor(owner).filter((p) => p.id !== item.id),
      )
    }
    return result
  })().finally(() => running.delete(owner))
  running.set(owner, run)
  return run
}

// La lista como va a quedar: vista o no vista y el puntaje propio, marcados como pendientes.
export function applyPending(titles: Title[], pending: Pending[], userId: string): (Title & { pending?: boolean })[] {
  return titles.map((title) => {
    const mine = pending.filter((p) => p.kind !== 'later' && p.titleId === title.id)
    if (mine.length === 0) return title
    let shown: Title & { pending?: boolean } = { ...title, pending: true }
    for (const p of mine) {
      if (p.kind === 'watched') {
        shown = { ...shown, status: p.watched ? 'watched' : 'to_watch', watchedAt: p.watched ? (shown.watchedAt ?? new Date().toISOString()) : null }
      } else if (p.kind === 'score') {
        const score = { userId, score: p.score, note: p.note.trim() || null, updatedAt: new Date().toISOString() }
        shown = { ...shown, scores: [...shown.scores.filter((s) => s.userId !== userId), score] }
      }
    }
    return shown
  })
}
