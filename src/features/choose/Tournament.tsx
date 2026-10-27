import { useEffect, useRef, useState, type ReactNode } from 'react'
import { readCache, saveCache } from '../../lib/offline'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { filterOptions, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { TitleDetail } from '../titles/TitleDetail'
import { InfoIcon } from '../titles/TitleCard'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { buildBracket, roundName, TOURNAMENT_PICKS, tournamentState, type Decision } from './bracket'
import { CountChoice } from './CountChoice'
import { GameTop } from './GameTop'
import { NO_PARTNER, playerName } from './players'
import { TitleFacts } from './TitleFacts'
import { TitlePicker } from './TitlePicker'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void; random?: () => number }

// El torneo se juega en un celular (los duelos se deciden juntos) y se guarda en ese celular por
// si iOS recarga la app. (Los guardados antes de poder elegir 8 o 16 no traen `each`.)
type LocalTournament = {
  each?: number
  id: string
  players: [string, string]
  picks: [string[] | null, string[] | null]
  active: 0 | 1
  slots: (string | null)[] | null
  decisions: Decision[]
}

// Un segundo toque enseguida cae sobre la carta del duelo siguiente: se ignora.
const DOUBLE_TAP_MS = 600

// true si el toque vale (no es el segundo de un doble toque).
function freshTap(last: { current: number }): boolean {
  const now = Date.now()
  if (now - last.current < DOUBLE_TAP_MS) return false
  last.current = now
  return true
}

export function Tournament({ filters, onFiltersChange, onBack, random = Math.random }: Props) {
  const { coupleId, members } = useCouple()
  const me = useUserId()
  const nameOf = useMemberName()
  const { titles, offline, load } = useTitles(coupleId)
  const [game, setGameState] = useState<LocalTournament | null>(() => readCache<LocalTournament>('tournament', me))
  const lastTap = useRef(0)
  const [each, setEach] = useState<number>(TOURNAMENT_PICKS[0])
  const [detailId, setDetailId] = useState<string | null>(null)
  const partner = members.find((m) => m.userId !== me)?.userId ?? null

  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))

  function setGame(next: LocalTournament | null) {
    setGameState(next)
    saveCache('tournament', me, next)
  }

  if (!game) {
    return (
      <section className="tournament-mode">
        <button className="back" onClick={onBack}>
          Volver a Elegir
        </button>
        <h2>Torneo</h2>
        {offline && titles === null && (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        )}
        {titles === null && !offline ? (
          <p>Cargando…</p>
        ) : (
          <>
            <p>{`Elijan ${each} cada uno y que se enfrenten de a dos.`}</p>
            <CountChoice label="¿Cuántas elige cada uno?" options={TOURNAMENT_PICKS} value={each} onChange={setEach} />
            <FiltersPanel value={filters} options={filterOptions(toWatch)} count={{ matching: matching.length, total: toWatch.length }} onChange={onFiltersChange} />
            {matching.length < 2 && <p>Hacen falta al menos 2 títulos</p>}
            <button
              disabled={matching.length < 2}
              onClick={() => setGame({ id: crypto.randomUUID(), each, players: [me, partner ?? NO_PARTNER], picks: [null, null], active: 0, slots: null, decisions: [] })}
            >
              Empezar
            </button>
          </>
        )}
      </section>
    )
  }

  // Mientras carga la lista (o sin conexión) no se calcula nada: con la lista vacía todo
  // parecería borrado.
  if (titles === null) {
    return (
      <section className="tournament-mode">
        <GameTop onBack={onBack} />
        {offline ? (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        ) : (
          <p>Cargando…</p>
        )}
      </section>
    )
  }

  const all = titles
  const byId = new Map(all.map((t) => [t.id, t]))
  const name = (i: 0 | 1) => playerName(game.players[i], nameOf)
  const end = () => setGame(null)
  const [first, second] = game.picks
  const need = game.each ?? TOURNAMENT_PICKS[0]

  let content
  if (!first) {
    content = (
      <TitlePicker
        turnOf={name(0)}
        titles={all}
        matching={matching}
        initial={[]}
        need={need}
        onDone={(ids) => setGame({ ...game, picks: [ids, null] })}
      />
    )
  } else if (game.active === 0) {
    content = (
      <>
        <p>{`Pasale el celu a ${name(1)}`}</p>
        <button onClick={() => setGame({ ...game, active: 1 })}>{`Listo, soy ${name(1)}`}</button>
      </>
    )
  } else if (!second || !game.slots) {
    content = (
      <TitlePicker
        turnOf={name(1)}
        titles={all}
        matching={matching}
        initial={[]}
        need={need}
        locked={{ ids: first, label: `La eligió ${name(0)}` }}
        onDone={(ids) => {
          const rest = matching.map((t) => t.id).filter((id) => !first.includes(id) && !ids.includes(id))
          setGame({ ...game, picks: [first, ids], slots: buildBracket(first, ids, rest, need, random) })
        }}
      />
    )
  } else {
    // Lo que se marca como visto o se borra a mitad del torneo queda como hueco.
    const state = tournamentState(game.slots, game.decisions, (id) => byId.get(id)?.status === 'to_watch')
    const undo = game.decisions.length > 0 && (
      <button className="secondary" aria-label="Deshacer" onClick={() => freshTap(lastTap) && setGame({ ...game, decisions: game.decisions.slice(0, -1) })}>
        ↩️ Deshacer
      </button>
    )

    if (state.kind === 'duel') {
      const choose = (winner: string) => {
        if (!freshTap(lastTap)) return
        setGame({ ...game, decisions: [...game.decisions, { pair: state.pair, winner }] })
      }
      content = (
        <Duel
          key={state.pair.join()}
          label={`${roundName(game.slots.length, state.round)} · duelo ${state.index} de ${state.total}`}
          pair={[byId.get(state.pair[0])!, byId.get(state.pair[1])!]}
          random={random}
          undo={undo}
          onChoose={choose}
          onOpenDetail={setDetailId}
        />
      )
    } else if (state.kind === 'winner') {
      const winner = byId.get(state.titleId)!
      content = (
        <>
          <h3>{`¡Ganó ${winner.title}!`}</h3>
          <div className="duel">
            <DuelCard title={winner} />
          </div>
          {/* También pasa por freshTap: un doble toque en la final no tiene que caer acá. */}
          <button onClick={() => freshTap(lastTap) && end()}>Listo</button>
          {undo}
        </>
      )
    } else {
      content = (
        <>
          <p>No quedó ninguna candidata en la lista</p>
          <button onClick={end}>Listo</button>
        </>
      )
    }
  }

  const detail = detailId ? byId.get(detailId) : undefined
  return (
    <>
      {/* Oculto y no desmontado mientras se ve el detalle: al volver sigue el mismo duelo. */}
      <section className="tournament-mode" hidden={!!detail}>
        <GameTop onBack={onBack} onEnd={end} />
        {content}
      </section>
      {detail && <TitleDetail title={detail} onClose={() => setDetailId(null)} onChanged={load} />}
    </>
  )
}

// "Que decida la suerte": el borde pasa de una carta a la otra, cada vez más lento, se queda en la
// ganadora un momento y recién ahí cuenta como elegida.
const LUCK_STEPS = 13
const LUCK_FIRST_MS = 80
const LUCK_SLOWDOWN = 1.15
const LUCK_HOLD_MS = 700

type DuelProps = {
  label: string
  pair: [Title, Title]
  random: () => number
  undo: ReactNode
  onChoose: (id: string) => void
  onOpenDetail: (id: string) => void
}

function Duel({ label, pair, random, undo, onChoose, onOpenDetail }: DuelProps) {
  const [lit, setLit] = useState<0 | 1 | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const spinning = lit !== null

  function luck() {
    const winner = random() < 0.5 ? 0 : 1
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onChoose(pair[winner].id)
    // Arranca en la primera y termina en la ganadora: con la segunda, un paso más.
    let at = 0
    for (let step = 0; step < LUCK_STEPS + winner; step++) {
      at += LUCK_FIRST_MS * LUCK_SLOWDOWN ** step
      timers.current.push(window.setTimeout(() => setLit((step % 2) as 0 | 1), at))
    }
    timers.current.push(window.setTimeout(() => onChoose(pair[winner].id), at + LUCK_HOLD_MS))
    setLit(0)
  }

  return (
    <>
      <p className="duel-round">{label}</p>
      <div className="duel">
        {pair.map((t, i) => (
          <div key={t.id} className="duel-slot">
            {i === 1 && <span className="duel-vs">vs</span>}
            <DuelCard title={t} lit={lit === i} disabled={spinning} onChoose={() => onChoose(t.id)} />
            <button className="round info duel-detail" aria-label={`Ver detalle de ${t.title}`} disabled={spinning} onClick={() => onOpenDetail(t.id)}>
              <InfoIcon />
            </button>
          </div>
        ))}
      </div>
      <div className="duel-actions">
        <button className="secondary" disabled={spinning} onClick={luck}>
          Que decida la suerte
        </button>
        {!spinning && undo}
      </div>
    </>
  )
}

// Una candidata del duelo: se toca entera para elegirla.
// Sin onChoose (la ganadora) no es un botón: VoiceOver no dice "botón atenuado".
function DuelCard({ title, lit = false, disabled = false, onChoose }: { title: Title; lit?: boolean; disabled?: boolean; onChoose?: () => void }) {
  const inside = (
    <>
      {title.posterPath ? <img src={`https://image.tmdb.org/t/p/w342${title.posterPath}`} alt="" /> : <span className="duel-poster" />}
      <span className="duel-info">
        <TitleFacts title={title} />
      </span>
    </>
  )
  if (!onChoose) return <div className="duel-card winner">{inside}</div>
  return (
    <button className={lit ? 'duel-card lit' : 'duel-card'} disabled={disabled} onClick={onChoose}>
      {inside}
    </button>
  )
}
