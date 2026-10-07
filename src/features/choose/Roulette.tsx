import { useEffect, useRef, useState } from 'react'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { filterOptions, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { TitleCard } from '../titles/TitleCard'
import { TitleDetail } from '../titles/TitleDetail'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { pick } from './pick'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; random?: () => number }

export function Roulette({ filters, onFiltersChange, random = Math.random }: Props) {
  const { coupleId } = useCouple()
  const { titles, offline, load } = useTitles(coupleId)
  const [detailId, setDetailId] = useState<string | null>(null)
  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))
  const detail = titles?.find((t) => t.id === detailId)

  return (
    <>
      {/* Oculta y no desmontada mientras se ve el detalle: así no se pierden el resultado ni los vetos. */}
      <section className="roulette" hidden={!!detail}>
        <h2>Ruleta</h2>
        <FiltersPanel value={filters} options={filterOptions(toWatch)} onChange={onFiltersChange} />
        {offline && (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        )}
        {titles === null && !offline ? (
          <p>Cargando…</p>
        ) : (
          // Una sesión por combinación de filtros: cambiar un filtro renueva el resultado y los vetos.
          <Session key={JSON.stringify(filters)} matching={matching} random={random} onOpenDetail={setDetailId} />
        )}
      </section>
      {detail && <TitleDetail title={detail} onClose={() => setDetailId(null)} />}
    </>
  )
}

const SPIN_MS = 1200
const TICK_MS = 80

function Session({ matching, random, onOpenDetail }: { matching: Title[]; random: () => number; onOpenDetail: (id: string) => void }) {
  const { members } = useCouple()
  const nameOf = useMemberName()
  const [vetoed, setVetoed] = useState<string[]>([])
  const [usedBy, setUsedBy] = useState<string[]>([])
  const [resultId, setResultId] = useState<string | null>(null)
  const [noneLeft, setNoneLeft] = useState(false)
  // Nombre que se muestra mientras gira; null = no está girando.
  const [spinning, setSpinning] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const candidates = matching.filter((t) => !vetoed.includes(t.id))
  const result = candidates.find((t) => t.id === resultId)
  // La pareja quitó o marcó vista el título que había salido.
  const lost = resultId !== null && !result

  function spin(list: Title[]) {
    const land = () => setResultId(pick(list, random)?.id ?? null)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return land()
    setSpinning(list[0].title)
    const tick = window.setInterval(() => setSpinning(list[Math.floor(Math.random() * list.length)].title), TICK_MS)
    timers.current = [
      tick,
      window.setTimeout(() => {
        clearInterval(tick)
        setSpinning(null)
        land()
      }, SPIN_MS),
    ]
  }

  function veto(userId: string) {
    if (!result) return
    const remaining = candidates.filter((t) => t.id !== result.id)
    setVetoed((v) => [...v, result.id])
    setUsedBy((u) => [...u, userId])
    if (remaining.length === 0) {
      setResultId(null)
      setNoneLeft(true)
      return
    }
    spin(remaining)
  }

  if (spinning !== null) {
    return (
      <div className="roulette-spin" aria-live="polite">
        <p>Girando…</p>
        <strong>{spinning}</strong>
      </div>
    )
  }

  if (noneLeft) return <p>No quedan títulos con estos filtros</p>

  if (result) {
    const allUsed = members.every((m) => usedBy.includes(m.userId))
    return (
      <div className="roulette-result">
        <h3>Les tocó</h3>
        <div data-testid="roulette-result">
          <TitleCard title={result.title} originalTitle={result.originalTitle} year={result.year} mediaType={result.mediaType} posterPath={result.posterPath} />
        </div>
        <button className="secondary" onClick={() => onOpenDetail(result.id)}>
          Ver detalle
        </button>
        <div className="vetoes">
          {members.map((m) =>
            usedBy.includes(m.userId) ? (
              <button key={m.userId} disabled>{`${nameOf(m.userId)} ya vetó`}</button>
            ) : (
              <button key={m.userId} onClick={() => veto(m.userId)}>{`Veto de ${nameOf(m.userId)}`}</button>
            ),
          )}
        </div>
        {allUsed && <p>No quedan vetos: ¡a ver esta!</p>}
      </div>
    )
  }

  return (
    <>
      {lost && <p>Ese título ya no está en Por ver. Giren de nuevo.</p>}
      {candidates.length === 0 ? (
        <p>Ningún título cumple estos filtros</p>
      ) : (
        <p>
          {candidates.length === 1 ? 'Hay 1 título que cumple los filtros' : `Hay ${candidates.length} títulos que cumplen los filtros`}
        </p>
      )}
      <button disabled={candidates.length === 0} onClick={() => spin(candidates)}>
        Girar
      </button>
    </>
  )
}
