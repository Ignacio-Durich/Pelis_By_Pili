import { useEffect, useRef, useState } from 'react'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { filterOptions, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { TitleCard } from '../titles/TitleCard'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { BumbleCard } from './BumbleCard'
import { bumbleUndo, bumbleVote, finishBumble, startBumble, type BumbleSession } from './bumbleApi'
import { bumbleState, buildDeck, lastUndoable, seededIndex, type BumbleState, type Vote } from './bumbleLogic'
import { useBumble } from './useBumble'
import { Wheel } from './Wheel'
import { targetRotation } from './wheelMath'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void; random?: () => number }

// Partida de un solo celular: no pasa por la base, pero se guarda en el celular por si iOS
// recarga la app a mitad de partida. `active` es quién tiene el celular; `round`, la última
// vuelta que vieron empezar (para avisar cuando arranca la siguiente).
type LocalGame = { id: string; deck: string[]; votes: Vote[]; players: [string, string]; active: 0 | 1; round: number }

const LOCAL_KEY = 'pelis-bumble-local'
// El otro jugador cuando el espacio todavía tiene un solo miembro.
const NO_PARTNER = 'pareja'

function readLocal(): LocalGame | null {
  try {
    const game = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') as LocalGame | null
    return game && Array.isArray(game.deck) && Array.isArray(game.votes) && Array.isArray(game.players) ? game : null
  } catch {
    return null
  }
}

function saveLocal(game: LocalGame | null) {
  try {
    if (game) localStorage.setItem(LOCAL_KEY, JSON.stringify(game))
    else localStorage.removeItem(LOCAL_KEY)
  } catch {
    // Sin almacenamiento la partida sigue, solo que no sobrevive a una recarga.
  }
}

const sameVote = (x: Vote, y: Vote) => x.userId === y.userId && x.round === y.round && x.titleId === y.titleId

export function Bumble({ filters, onFiltersChange, onBack, random = Math.random }: Props) {
  const { coupleId, members } = useCouple()
  const me = useUserId()
  const { titles, offline, load: loadTitles } = useTitles(coupleId)
  const { session, offline: bumbleOffline, load } = useBumble(coupleId)
  const [local, setLocalState] = useState<LocalGame | null>(readLocal)
  const [error, setError] = useState<string | null>(null)
  const partner = members.find((m) => m.userId !== me)?.userId ?? null

  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))

  function setLocal(game: LocalGame | null) {
    setLocalState(game)
    saveLocal(game)
  }

  function startOne() {
    setLocal({ id: crypto.randomUUID(), deck: buildDeck(toWatch, filters, random), votes: [], players: [me, partner ?? NO_PARTNER], active: 0, round: 1 })
  }

  function startTwo() {
    setError(null)
    startBumble(buildDeck(toWatch, filters, random)).then(load, () => setError('No se pudo empezar. Probá de nuevo.'))
  }

  let body
  let inGame = false
  if (titles === null || session === undefined) {
    body = !offline && !bumbleOffline && <p>Cargando…</p>
  } else if (session && partner) {
    // Si la pareja empezó una partida de dos celulares, se entra directo.
    inGame = true
    body = <TwoPhones key={session.id} session={session} me={me} partner={partner} titles={titles} reload={load} onBack={onBack} />
  } else if (local) {
    inGame = true
    body = <OnePhone game={local} titles={titles} onChange={setLocal} onBack={onBack} />
  } else {
    body = (
      <>
        <p>Deslicen las cartas. Hay match cuando a los dos les gusta la misma.</p>
        <FiltersPanel value={filters} options={filterOptions(toWatch)} count={{ matching: matching.length, total: toWatch.length }} onChange={onFiltersChange} />
        <h3>¿Cuántos celulares van a usar?</h3>
        {matching.length < 2 && <p>Hacen falta al menos 2 títulos</p>}
        <div className="bumble-votes">
          <button disabled={matching.length < 2} onClick={startOne}>
            📱 Uno
          </button>
          <button disabled={matching.length < 2 || !partner} onClick={startTwo}>
            📱📱 Dos
          </button>
        </div>
        {!partner && <small>Para usar dos celulares, tu pareja tiene que unirse</small>}
        {error && <p role="alert">{error}</p>}
      </>
    )
  }

  return (
    <section className="bumble-mode">
      {/* En la partida, el encabezado es una sola fila (Top) para que la carta entre en la pantalla. */}
      {!inGame && (
        <>
          <button className="back" onClick={onBack}>
            Volver a los modos
          </button>
          <h2>Bumble</h2>
        </>
      )}
      {(offline || bumbleOffline) && (
        <>
          <p role="alert">Sin conexión. Probá de nuevo.</p>
          <button
            onClick={() => {
              loadTitles()
              load()
            }}
          >
            Reintentar
          </button>
        </>
      )}
      {body}
    </section>
  )
}

function useTitleMap(titles: Title[]) {
  return new Map(titles.map((t) => [t.id, t]))
}

type GameProps = { titles: Title[]; onBack: () => void }

function TwoPhones({ session, me, partner, titles, reload, onBack }: GameProps & { session: BumbleSession; me: string; partner: string; reload: () => void }) {
  const nameOf = useMemberName()
  const byId = useTitleMap(titles)
  // Votos propios que todavía no volvieron de la base: la carta avanza sin esperar.
  const [pending, setPending] = useState<Vote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // Los votos que había al tocar Deshacer: el botón vuelve recién con la partida recargada.
  const [undoingFrom, setUndoingFrom] = useState<Vote[] | null>(null)
  const seen = useRef<string[] | null>(null)

  // Un título borrado de la lista se saltea en los dos celulares.
  const deck = session.deck.filter((id) => byId.has(id))
  // Un voto a un título borrado se fue con él (cascade): ya no está en camino.
  const waiting = pending.filter((p) => deck.includes(p.titleId) && !session.votes.some((s) => sameVote(s, p)))
  const votes = [...session.votes, ...waiting]
  const players: [string, string] = [me, partner]
  const state = bumbleState(deck, votes, players)
  const matchKeys = state.kind === 'round' ? state.matches.map((id) => `${state.round}:${id}`).join(',') : ''

  // Cada match nuevo se anuncia; los que ya estaban al entrar, no.
  useEffect(() => {
    const keys = matchKeys ? matchKeys.split(',') : []
    const fresh = seen.current && keys.find((k) => !seen.current!.includes(k))
    seen.current = keys
    if (fresh) setToast(fresh)
  }, [matchKeys])

  function vote(liked: boolean) {
    if (state.kind !== 'round' || !state.next[0]) return
    const mine: Vote = { userId: me, round: state.round, titleId: state.next[0], liked }
    setError(null)
    setPending((p) => [...p, mine])
    bumbleVote(session.id, mine.round, mine.titleId, liked).then(reload, () => {
      setPending((p) => p.filter((x) => !sameVote(x, mine)))
      setError('No se pudo guardar. Probá de nuevo.')
    })
  }

  function undo() {
    // Solo se ofrece sin votos en camino, así que los pendientes ya están todos en la base.
    setPending([])
    setError(null)
    setUndoingFrom(session.votes)
    bumbleUndo(session.id).then(reload, () => {
      setUndoingFrom(null)
      setError('No se pudo deshacer. Probá de nuevo.')
    })
  }

  const finish = (result: string | null) => finishBumble(session.id, result).then(reload, () => setError('No se pudo guardar. Probá de nuevo.'))

  if (state.kind !== 'round') {
    return (
      <>
        <Top onBack={onBack} />
        <Outcome state={state} byId={byId} seed={session.id} onDone={finish} />
        {error && <p role="alert">{error}</p>}
      </>
    )
  }

  const n = state.cards.length
  const card = state.next[0] ? byId.get(state.next[0]) : undefined
  const toastTitle = toast && matchKeys.split(',').includes(toast) ? byId.get(toast.split(':')[1])?.title : null
  const canUndo = waiting.length === 0 && lastUndoable(deck, votes, players, me) !== null
  const undoing = undoingFrom === session.votes

  return (
    <>
      <Top onBack={onBack} onEnd={() => finish(null)} />
      <p className="bumble-status">
        {state.round > 1 && <span>{`Vuelta ${state.round}`}</span>}
        <span>{`Vos: ${state.done[0]} de ${n} · ${nameOf(partner)}: ${state.done[1]} de ${n}`}</span>
        <span>{`Matches: ${state.matches.length}`}</span>
      </p>
      <div className="bumble-stage">
        <p role="status" className="bumble-match">
          {toastTitle ? `¡Match! ${toastTitle}` : ''}
        </p>
        {card ? (
          <BumbleCard title={card} onVote={vote} undo={canUndo ? { onClick: undo, disabled: undoing } : undefined} />
        ) : (
          <>
            <p>{`Esperando a ${nameOf(partner)} (${state.done[1]} de ${n})`}</p>
            {canUndo && <UndoButton disabled={undoing} onClick={undo} />}
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

function OnePhone({ game, titles, onChange, onBack }: GameProps & { game: LocalGame; onChange: (g: LocalGame | null) => void }) {
  const nameOf = useMemberName()
  const byId = useTitleMap(titles)
  const deck = game.deck.filter((id) => byId.has(id))
  const state = bumbleState(deck, game.votes, game.players)
  const name = (i: 0 | 1) => (game.players[i] === NO_PARTNER ? 'tu pareja' : nameOf(game.players[i]))
  const end = () => onChange(null)

  if (state.kind !== 'round') {
    return (
      <>
        <Top onBack={onBack} />
        <Outcome state={state} byId={byId} seed={game.id} onDone={end} />
      </>
    )
  }

  if (state.round > game.round) {
    return (
      <>
        <Top onBack={onBack} onEnd={end} />
        <p>{`¡${state.cards.length} matches! Vuelven a deslizar solo esos`}</p>
        <button onClick={() => onChange({ ...game, round: state.round, active: 0 })}>Seguir</button>
      </>
    )
  }

  const player = game.players[game.active]
  const next = state.next[game.active]
  const last = lastUndoable(deck, game.votes, game.players, player)
  const undo = last ? () => onChange({ ...game, votes: game.votes.filter((x) => x !== last) }) : null

  if (game.active === 0 && !next) {
    return (
      <>
        <Top onBack={onBack} onEnd={end} />
        <p>{`Pasale el celu a ${name(1)}`}</p>
        <button onClick={() => onChange({ ...game, active: 1 })}>{`Listo, soy ${name(1)}`}</button>
        {undo && <UndoButton disabled={false} onClick={undo} />}
      </>
    )
  }

  const card = next ? byId.get(next) : undefined
  const vote = (liked: boolean) => next && onChange({ ...game, votes: [...game.votes, { userId: player, round: state.round, titleId: next, liked }] })

  return (
    <>
      <Top onBack={onBack} onEnd={end} />
      <p className="bumble-status">
        {state.round > 1 && <span>{`Vuelta ${state.round}`}</span>}
        <span>{`Turno de ${name(game.active)} · ${state.done[game.active]} de ${state.cards.length}`}</span>
      </p>
      <div className="bumble-stage">{card && <BumbleCard title={card} onVote={vote} undo={undo ? { onClick: undo, disabled: false } : undefined} />}</div>
    </>
  )
}

function Top({ onBack, onEnd }: { onBack: () => void; onEnd?: () => void }) {
  return (
    <div className="bumble-top">
      <button className="back" onClick={onBack}>
        Volver a los modos
      </button>
      {onEnd && (
        <button className="back" onClick={onEnd}>
          Terminar
        </button>
      )}
    </div>
  )
}

function UndoButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button className="secondary" aria-label="Deshacer" disabled={disabled} onClick={onClick}>
      ↩️ Deshacer
    </button>
  )
}

type Ending = Exclude<BumbleState, { kind: 'round' }>

function Outcome({ state, byId, seed, onDone }: { state: Ending; byId: Map<string, Title>; seed: string; onDone: (winner: string | null) => void }) {
  const [rouletteWinner, setRouletteWinner] = useState<string | null>(null)

  if (state.kind === 'none') {
    return (
      <>
        <p>No hubo match esta vez</p>
        <button onClick={() => onDone(null)}>Otra partida</button>
      </>
    )
  }

  const winnerId = state.kind === 'winner' ? state.titleId : rouletteWinner
  const winner = winnerId ? byId.get(winnerId) : undefined
  if (winnerId && winner) {
    return (
      <>
        <h3>{`¡Ganó ${winner.title}!`}</h3>
        <TitleCard title={winner.title} originalTitle={winner.originalTitle} year={winner.year} mediaType={winner.mediaType} posterPath={winner.posterPath} />
        <button onClick={() => onDone(winnerId)}>Listo</button>
      </>
    )
  }

  if (state.kind !== 'roulette') return null
  return <TieBreak candidates={state.candidates.map((id) => byId.get(id)!)} index={seededIndex(`${seed}:${state.round}`, state.candidates.length)} onEnd={setRouletteWinner} />
}

// Si la rueda no avisa que terminó (pestaña en segundo plano), el resultado aparece igual.
const SPIN_FALLBACK_MS = 4500

// La ruleta de desempate: el resultado sale de la semilla, así los dos celulares ven la misma.
function TieBreak({ candidates, index, onEnd }: { candidates: Title[]; index: number; onEnd: (id: string) => void }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const fallback = useRef<number | undefined>(undefined)

  useEffect(() => () => clearTimeout(fallback.current), [])

  function finish() {
    clearTimeout(fallback.current)
    setSpinning(false)
    onEnd(candidates[index].id)
  }

  function spin() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return finish()
    setSpinning(true)
    setRotation((r) => targetRotation(r, index, candidates.length))
    fallback.current = window.setTimeout(finish, SPIN_FALLBACK_MS)
  }

  return (
    <>
      <p>Siguen empatados: decide la ruleta</p>
      <Wheel items={candidates.map((t) => ({ id: t.id, label: t.title }))} rotation={rotation} animate={spinning} onEnd={finish} />
      <button disabled={spinning} onClick={spin}>
        Girar
      </button>
    </>
  )
}
