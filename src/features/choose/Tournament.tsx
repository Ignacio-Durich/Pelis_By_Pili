import { useRef, useState } from 'react'
import { useUserId } from '../auth/sessionContext'
import { useCouple, useMemberName } from '../couple/coupleContext'
import { filterOptions, formatMinutes, matchesFilters, type Filters } from '../titles/filters'
import { FiltersPanel } from '../titles/FiltersPanel'
import { imdbScore, rtScore } from '../titles/ratings'
import type { Title } from '../titles/titlesApi'
import { useTitles } from '../titles/useTitles'
import { buildBracket, ROUND_NAMES, TOURNAMENT_PICKS, tournamentState, type Decision } from './bracket'
import { GameTop } from './GameTop'
import { NO_PARTNER, playerName } from './players'
import { TitlePicker } from './TitlePicker'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void; random?: () => number }

// El torneo se juega en un celular (los duelos se deciden juntos) y se guarda en ese celular por
// si iOS recarga la app.
type LocalTournament = {
  id: string
  players: [string, string]
  picks: [string[] | null, string[] | null]
  active: 0 | 1
  slots: (string | null)[] | null
  decisions: Decision[]
}

const LOCAL_KEY = 'pelis-tournament-local'
// Un segundo toque enseguida cae sobre la carta del duelo siguiente: se ignora.
const DOUBLE_TAP_MS = 600

// true si el toque vale (no es el segundo de un doble toque).
function freshTap(last: { current: number }): boolean {
  const now = Date.now()
  if (now - last.current < DOUBLE_TAP_MS) return false
  last.current = now
  return true
}

function readLocal(): LocalTournament | null {
  try {
    const game = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') as LocalTournament | null
    return game && Array.isArray(game.picks) && Array.isArray(game.decisions) ? game : null
  } catch {
    return null
  }
}

function saveLocal(game: LocalTournament | null) {
  try {
    if (game) localStorage.setItem(LOCAL_KEY, JSON.stringify(game))
    else localStorage.removeItem(LOCAL_KEY)
  } catch {
    // Sin almacenamiento el torneo sigue, solo que no sobrevive a una recarga.
  }
}

export function Tournament({ filters, onFiltersChange, onBack, random = Math.random }: Props) {
  const { coupleId, members } = useCouple()
  const me = useUserId()
  const nameOf = useMemberName()
  const { titles, offline, load } = useTitles(coupleId)
  const [game, setGameState] = useState<LocalTournament | null>(readLocal)
  const lastTap = useRef(0)
  const partner = members.find((m) => m.userId !== me)?.userId ?? null

  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const matching = toWatch.filter((t) => matchesFilters(t, filters))

  function setGame(next: LocalTournament | null) {
    setGameState(next)
    saveLocal(next)
  }

  if (!game) {
    return (
      <section className="tournament-mode">
        <button className="back" onClick={onBack}>
          Volver a los modos
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
            <p>Elijan 4 cada uno y que se enfrenten de a dos.</p>
            <FiltersPanel value={filters} options={filterOptions(toWatch)} count={{ matching: matching.length, total: toWatch.length }} onChange={onFiltersChange} />
            {matching.length < 2 && <p>Hacen falta al menos 2 títulos</p>}
            <button
              disabled={matching.length < 2}
              onClick={() => setGame({ id: crypto.randomUUID(), players: [me, partner ?? NO_PARTNER], picks: [null, null], active: 0, slots: null, decisions: [] })}
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

  let content
  if (!first) {
    content = (
      <TitlePicker
        heading={`Turno de ${name(0)}: elegí 4`}
        titles={all}
        matching={matching}
        initial={[]}
        need={TOURNAMENT_PICKS}
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
        heading={`Turno de ${name(1)}: elegí 4`}
        titles={all}
        matching={matching}
        initial={[]}
        need={TOURNAMENT_PICKS}
        locked={{ ids: first, label: `La eligió ${name(0)}` }}
        onDone={(ids) => {
          const rest = matching.map((t) => t.id).filter((id) => !first.includes(id) && !ids.includes(id))
          setGame({ ...game, picks: [first, ids], slots: buildBracket(first, ids, rest, random) })
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
      const [a, b] = state.pair.map((id) => byId.get(id)!)
      content = (
        <>
          <p className="duel-round">{`${ROUND_NAMES[state.round]} · duelo ${state.index} de ${state.total}`}</p>
          <div className="duel">
            <DuelCard key={a.id} title={a} onChoose={() => choose(a.id)} />
            <span className="duel-vs">vs</span>
            <DuelCard key={b.id} title={b} onChoose={() => choose(b.id)} />
          </div>
          {undo}
        </>
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

  return (
    <section className="tournament-mode">
      <GameTop onBack={onBack} onEnd={end} />
      {content}
    </section>
  )
}

// Una candidata del duelo: se toca entera para elegirla.
function DuelCard({ title, onChoose }: { title: Title; onChoose?: () => void }) {
  const kind = title.mediaType === 'movie' ? 'Película' : 'Serie'
  const facts = [title.year, kind, title.runtime ? formatMinutes(title.runtime) : null].filter(Boolean).join(' · ')
  return (
    <button className="duel-card" disabled={!onChoose} onClick={onChoose}>
      {title.posterPath ? <img src={`https://image.tmdb.org/t/p/w342${title.posterPath}`} alt="" /> : <span className="duel-poster" />}
      <span className="duel-info">
        <strong>{title.title}</strong>
        <span>{facts}</span>
        {title.genres.length > 0 && <span>{title.genres.slice(0, 3).join(' · ')}</span>}
        <span>{`IMDb ${imdbScore(title.imdbRating)} · RT ${rtScore(title.rottenTomatoes)}`}</span>
        <span>{title.streaming.length ? title.streaming.join(', ') : 'Sin información de dónde verla'}</span>
      </span>
    </button>
  )
}
