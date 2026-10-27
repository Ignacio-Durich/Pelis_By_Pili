import { useEffect, useRef, useState } from 'react'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { activeCount, filterOptions, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { TitleCard } from '../titles/TitleCard'
import { TitleDetail } from '../titles/TitleDetail'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { pick } from './pick'
import { Wheel } from './Wheel'
import { targetRotation } from './wheelMath'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; random?: () => number; onBack: () => void }

export function Roulette({ filters, onFiltersChange, random = Math.random, onBack }: Props) {
  const { coupleId } = useCouple()
  const { titles, offline, load } = useTitles(coupleId)
  const [detailId, setDetailId] = useState<string | null>(null)
  // Igual que en la lista: el detalle abre arriba y "Volver" deja la ruleta donde estaba.
  const scroll = useRef(0)

  function openDetail(id: string) {
    scroll.current = window.scrollY
    setDetailId(id)
    window.scrollTo(0, 0)
  }

  function closeDetail() {
    setDetailId(null)
    requestAnimationFrame(() => window.scrollTo(0, scroll.current))
  }
  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))
  const detail = titles?.find((t) => t.id === detailId)

  return (
    <>
      {/* Oculta y no desmontada mientras se ve el detalle: así no se pierden el resultado ni los vetos. */}
      <section className="roulette" hidden={!!detail}>
        <button className="back" onClick={onBack}>
          Volver a Elegir
        </button>
        <h2>Ruleta</h2>
        <p>Gira entre los títulos que cumplen los filtros.</p>
        <FiltersPanel
          value={filters}
          options={filterOptions(toWatch)}
          count={{ matching: matching.length, total: toWatch.length }}
          onChange={onFiltersChange}
        />
        {offline && titles === null && (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        )}
        {titles === null && !offline ? (
          <p>Cargando…</p>
        ) : (
          // Una sesión por combinación de filtros: cambiar un filtro renueva el resultado y los vetos.
          <Session key={JSON.stringify(filters)} matching={matching} filtered={activeCount(filters) > 0} random={random} onOpenDetail={openDetail} />
        )}
      </section>
      {detail && <TitleDetail title={detail} onClose={closeDetail} onChanged={load} />}
    </>
  )
}

// Si la rueda no avisa que terminó (por ejemplo, la pestaña quedó en segundo plano), el
// resultado aparece igual.
const SPIN_FALLBACK_MS = 4500

type SessionProps = { matching: Title[]; filtered: boolean; random: () => number; onOpenDetail: (id: string) => void }

function Session({ matching, filtered, random, onOpenDetail }: SessionProps) {
  const { members } = useCouple()
  const nameOf = useMemberName()
  const [vetoed, setVetoed] = useState<string[]>([])
  const [usedBy, setUsedBy] = useState<string[]>([])
  const [resultId, setResultId] = useState<string | null>(null)
  const [vetoedAll, setVetoedAll] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  // Los títulos de la rueda en el último giro: así el gajo elegido queda bajo la flecha.
  const [spinItems, setSpinItems] = useState<Title[] | null>(null)
  const pending = useRef<string | null>(null)
  const fallback = useRef<number | undefined>(undefined)

  useEffect(() => () => clearTimeout(fallback.current), [])

  const candidates = matching.filter((t) => !vetoed.includes(t.id))
  const result = candidates.find((t) => t.id === resultId)
  // Si la pareja agrega uno después de vetar todo, se puede volver a girar.
  const noneLeft = vetoedAll && candidates.length === 0
  // La pareja quitó o marcó vista el título que había salido.
  const lost = resultId !== null && !result

  function finish() {
    if (pending.current === null) return
    clearTimeout(fallback.current)
    setSpinning(false)
    setResultId(pending.current)
    pending.current = null
  }

  function spin(list: Title[]) {
    const chosen = pick(list, random)
    if (!chosen) return
    const index = list.indexOf(chosen)
    setSpinItems(list)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRotation((r) => targetRotation(r, index, list.length, 0))
      setResultId(chosen.id)
      return
    }
    pending.current = chosen.id
    setResultId(null)
    setSpinning(true)
    setRotation((r) => targetRotation(r, index, list.length))
    fallback.current = window.setTimeout(finish, SPIN_FALLBACK_MS)
  }

  function veto(userId: string) {
    if (!result) return
    const remaining = candidates.filter((t) => t.id !== result.id)
    setVetoed((v) => [...v, result.id])
    setUsedBy((u) => [...u, userId])
    if (remaining.length === 0) {
      setResultId(null)
      setVetoedAll(true)
      return
    }
    spin(remaining)
  }

  const wheelItems = (spinning || result) && spinItems ? spinItems : candidates
  const wheel = wheelItems.length > 0 && !noneLeft && (
    <Wheel items={wheelItems.map((t) => ({ id: t.id, label: t.title }))} rotation={rotation} animate={spinning} onEnd={finish} />
  )

  // La rueda va siempre en el mismo lugar: si cambiara de contenedor, React la recrearía ya en su
  // posición final y el giro (por ejemplo, después de un veto) no se vería.
  // La región que se lee en voz alta existe siempre (si nace con el texto, no se anuncia):
  // "Girando…" a la vista y, al parar, el resultado solo para el lector de pantalla.
  return (
    <>
      {wheel}
      <p className={spinning ? 'spinning' : 'visually-hidden'} aria-live="polite">
        {spinning ? 'Girando…' : result ? `Les tocó ${result.title}` : ''}
      </p>
      {content()}
    </>
  )

  function content() {
    if (spinning) return null

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
          // Con un filtro activo ya cuenta el panel de filtros.
          !filtered && (
          <p>
            {candidates.length === 1 ? 'Hay 1 título que cumple los filtros' : `Hay ${candidates.length} títulos que cumplen los filtros`}
          </p>
          )
        )}
        <button disabled={candidates.length === 0} onClick={() => spin(candidates)}>
          Girar
        </button>
      </>
    )
  }
}
