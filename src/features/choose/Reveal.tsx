import { useEffect, useState } from 'react'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { filterOptions, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { TitleCard } from '../titles/TitleCard'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { seededIndex } from './bumbleLogic'
import { GameTop } from './GameTop'
import { finishReveal, RevealError, startReveal, submitReveal, type RevealSession } from './revealApi'
import { PICKS, revealResult } from './revealLogic'
import { TieBreak } from './TieBreak'
import { TitlePicker } from './TitlePicker'
import { useReveal } from './useReveal'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void }

// Partida de un solo celular: no pasa por la base; se guarda en el celular por si iOS recarga la
// app. `active` es quién tiene el celular.
type LocalReveal = { id: string; players: [string, string]; picks: [string[] | null, string[] | null]; active: 0 | 1; revealed: boolean }

const LOCAL_KEY = 'pelis-reveal-local'
const NO_PARTNER = 'pareja'

function readLocal(): LocalReveal | null {
  try {
    const game = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') as LocalReveal | null
    return game && Array.isArray(game.picks) && Array.isArray(game.players) ? game : null
  } catch {
    return null
  }
}

function saveLocal(game: LocalReveal | null) {
  try {
    if (game) localStorage.setItem(LOCAL_KEY, JSON.stringify(game))
    else localStorage.removeItem(LOCAL_KEY)
  } catch {
    // Sin almacenamiento la partida sigue, solo que no sobrevive a una recarga.
  }
}

export function Reveal({ filters, onFiltersChange, onBack }: Props) {
  const { coupleId, members } = useCouple()
  const me = useUserId()
  const { titles, offline, load: loadTitles } = useTitles(coupleId)
  const { session, offline: revealOffline, load } = useReveal(coupleId)
  const [local, setLocalState] = useState<LocalReveal | null>(readLocal)
  const [error, setError] = useState<string | null>(null)
  const partner = members.find((m) => m.userId !== me)?.userId ?? null

  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))

  function setLocal(game: LocalReveal | null) {
    setLocalState(game)
    saveLocal(game)
  }

  function startTwo() {
    setError(null)
    startReveal().then(load, () => setError('No se pudo empezar. Probá de nuevo.'))
  }

  let body
  let inGame = false
  if (titles === null || session === undefined) {
    body = !offline && !revealOffline && <p>Cargando…</p>
  } else if (session && partner) {
    // Si la pareja empezó una partida de dos celulares, se entra directo.
    inGame = true
    body = <TwoPhones key={session.id} session={session} me={me} partner={partner} titles={titles} matching={matching} reload={load} onBack={onBack} />
  } else if (local) {
    inGame = true
    body = <OnePhone game={local} titles={titles} matching={matching} onChange={setLocal} onBack={onBack} />
  } else {
    body = (
      <>
        <p>Cada uno elige 3 en secreto y se muestran a la vez.</p>
        <FiltersPanel value={filters} options={filterOptions(toWatch)} count={{ matching: matching.length, total: toWatch.length }} onChange={onFiltersChange} />
        <h3>¿Cuántos celulares van a usar?</h3>
        {matching.length < 1 && <p>Hace falta al menos 1 título</p>}
        <div className="bumble-votes">
          <button
            disabled={matching.length < 1}
            onClick={() => setLocal({ id: crypto.randomUUID(), players: [me, partner ?? NO_PARTNER], picks: [null, null], active: 0, revealed: false })}
          >
            📱 Uno
          </button>
          <button disabled={matching.length < 1 || !partner} onClick={startTwo}>
            📱📱 Dos
          </button>
        </div>
        {!partner && <small>Para usar dos celulares, tu pareja tiene que unirse</small>}
        {error && <p role="alert">{error}</p>}
      </>
    )
  }

  return (
    <section className="reveal-mode">
      {!inGame && (
        <>
          <button className="back" onClick={onBack}>
            Volver a los modos
          </button>
          <h2>Top 3 secreto</h2>
        </>
      )}
      {((offline && titles === null) || revealOffline) && (
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

type GameProps = { titles: Title[]; matching: Title[]; onBack: () => void }

function TwoPhones({ session, me, partner, titles, matching, reload, onBack }: GameProps & { session: RevealSession; me: string; partner: string; reload: () => void }) {
  const nameOf = useMemberName()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = session.picks.find((p) => p.userId === me)?.titleIds ?? null
  const theirs = session.picks.find((p) => p.userId === partner)?.titleIds ?? []
  const fail = (message: string) => () => setError(message)
  const finish = (result: string | null) => finishReveal(session.id, result).then(reload, fail('No se pudo guardar. Probá de nuevo.'))

  if (session.revealed) {
    return (
      <>
        <GameTop onBack={onBack} />
        <Revelation picks={[mine ?? [], theirs]} names={[nameOf(me), nameOf(partner)]} titles={titles} seed={session.id} onDone={finish} />
        {error && <p role="alert">{error}</p>}
      </>
    )
  }

  function send(ids: string[]) {
    setError(null)
    submitReveal(session.id, ids).then(
      () => {
        setEditing(false)
        reload()
      },
      (e) => {
        // El otro reveló justo antes (o fue un doble toque): no es un error, se muestra la revelación.
        if (e instanceof RevealError && e.kind === 'closed') reload()
        else setError('No se pudo guardar. Probá de nuevo.')
      },
    )
  }

  return (
    <>
      <GameTop onBack={onBack} onEnd={() => finish(null)} />
      {!mine || editing ? (
        <>
          {session.ready.includes(partner) && <p className="reveal-ready">{`${nameOf(partner)} ya eligió`}</p>}
          <TitlePicker need={PICKS} heading="Elegí tus 3" titles={titles} matching={matching} initial={mine ?? []} onDone={send} />
        </>
      ) : (
        <>
          <p>{`Listo. Esperando a ${nameOf(partner)}…`}</p>
          <button className="secondary" onClick={() => setEditing(true)}>
            Cambiar mi elección
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  )
}

function OnePhone({ game, titles, matching, onChange, onBack }: GameProps & { game: LocalReveal; onChange: (g: LocalReveal | null) => void }) {
  const nameOf = useMemberName()
  const name = (i: 0 | 1) => (game.players[i] === NO_PARTNER ? 'tu pareja' : nameOf(game.players[i]))
  const end = () => onChange(null)
  const [first, second] = game.picks

  if (game.revealed) {
    return (
      <>
        <GameTop onBack={onBack} />
        <Revelation picks={[first ?? [], second ?? []]} names={[name(0), name(1)]} titles={titles} seed={game.id} onDone={end} />
      </>
    )
  }

  let content
  if (!first) {
    content = <TitlePicker need={PICKS} heading={`Turno de ${name(0)}: elegí tus 3`} titles={titles} matching={matching} initial={[]} onDone={(ids) => onChange({ ...game, picks: [ids, null] })} />
  } else if (game.active === 0) {
    // El primero ya eligió: se pasa el celular sin mostrar lo que eligió.
    content = (
      <>
        <p>{`Pasale el celu a ${name(1)}`}</p>
        <button onClick={() => onChange({ ...game, active: 1 })}>{`Listo, soy ${name(1)}`}</button>
      </>
    )
  } else if (!second) {
    content = <TitlePicker need={PICKS} heading={`Turno de ${name(1)}: elegí tus 3`} titles={titles} matching={matching} initial={[]} onDone={(ids) => onChange({ ...game, picks: [first, ids] })} />
  } else {
    content = (
      <>
        <p>Eligieron los dos.</p>
        <button onClick={() => onChange({ ...game, revealed: true })}>Revelar</button>
      </>
    )
  }

  return (
    <>
      <GameTop onBack={onBack} onEnd={end} />
      {content}
    </>
  )
}

const COUNT_FROM = 3

function Revelation({ picks, names, titles, seed, onDone }: { picks: [string[], string[]]; names: [string, string]; titles: Title[]; seed: string; onDone: (winner: string | null) => void }) {
  const [count, setCount] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : COUNT_FROM))
  const [rouletteWinner, setRouletteWinner] = useState<string | null>(null)

  useEffect(() => {
    if (count === 0) return
    const timer = window.setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [count])

  if (count > 0) {
    return (
      <p className="reveal-count" aria-live="polite">
        {count}
      </p>
    )
  }

  const byId = new Map(titles.map((t) => [t.id, t]))
  // Lo que se marcó como visto o se borró antes de revelar ya no cuenta.
  const result = revealResult(picks, (id) => byId.get(id)?.status === 'to_watch')
  const winnerId = result.winner ?? rouletteWinner
  const winner = winnerId ? byId.get(winnerId) : undefined
  const cards = (ids: string[]) => (
    <ul className="title-list">
      {ids.map((id) => {
        const t = byId.get(id)!
        return (
          <li key={id}>
            <TitleCard title={t.title} originalTitle={t.originalTitle} year={t.year} mediaType={t.mediaType} posterPath={t.posterPath} />
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {winner ? (
        <>
          <h3>{`¡Ganó ${winner.title}!`}</h3>
          <button onClick={() => onDone(winner.id)}>Listo</button>
        </>
      ) : result.roulette ? (
        <TieBreak
          candidates={result.roulette.map((id) => byId.get(id)!)}
          index={seededIndex(`${seed}:reveal`, result.roulette.length)}
          label="Que decida la ruleta"
          onEnd={setRouletteWinner}
        />
      ) : (
        <>
          <p>No queda ninguno de los elegidos en la lista</p>
          <button onClick={() => onDone(null)}>Listo</button>
        </>
      )}
      {result.matches.length > 0 && (
        <>
          <h3>Coinciden</h3>
          {cards(result.matches)}
        </>
      )}
      {result.only.map((ids, i) =>
        ids.length > 0 ? (
          <div key={i}>
            <h3>{`Eligió ${names[i]}`}</h3>
            {cards(ids)}
          </div>
        ) : null,
      )}
    </>
  )
}
