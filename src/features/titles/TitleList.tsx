import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import { useCouple, useMemberName } from '../couple/coupleContext'
import type { SharedItem } from '../shared/sharedApi'
import { SharedInbox } from '../shared/SharedInbox'
import { useShared } from '../shared/useShared'
import { AddTitle } from './AddTitle'
import { ClearSearch } from './ClearSearch'
import { filterOptions, matchesFilters, matchesQuery, NO_FILTERS, type Filters } from './filters'
import { FiltersPanel } from './FiltersPanel'
import { PosterTile } from './PosterTile'
import { formatScore, imdbScore } from './ratings'
import { TitleDetail } from './TitleDetail'
import { droppedMessage, useTitles } from './useTitles'
import { kindLine } from './titleText'
import type { Title } from './titlesApi'

export function TitleList({ filters, onFiltersChange }: { filters: Filters; onFiltersChange: (f: Filters) => void }) {
  const { coupleId, members } = useCouple()
  const nameOf = useMemberName()
  const { titles, offline, load, pending, dropped, clearDropped } = useTitles(coupleId)
  const { items: shared } = useShared(coupleId)
  // false = cerrado; si no, Agregar (con el ítem de la bandeja que se está buscando, si hay).
  const [adding, setAdding] = useState<false | { shared?: SharedItem }>(false)
  // Por id: el detalle abierto toma siempre la versión más nueva del título (Realtime recarga la lista).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'to_watch' | 'watched'>('to_watch')
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  // La ventana es la que scrollea: al abrir una pantalla se sube al principio y al volver
  // se recupera el lugar de la lista.
  const listScroll = useRef(0)
  // El último título abierto, para avisar si desaparece mientras se lo mira (lo quitó la pareja).
  const opened = useRef<Title | null>(null)
  const [gone, setGone] = useState<string | null>(null)

  function openScreen(show: () => void) {
    setGone(null)
    listScroll.current = window.scrollY
    show()
    window.scrollTo(0, 0)
  }

  function backToList(hide: () => void) {
    hide()
    requestAnimationFrame(() => window.scrollTo(0, listScroll.current))
  }

  const selected = titles?.find((t) => t.id === selectedId)
  useEffect(() => {
    if (!selectedId || !titles || titles.some((t) => t.id === selectedId)) return
    setGone(opened.current?.title ?? null)
    backToList(() => setSelectedId(null))
  }, [selectedId, titles])

  if (selected) return <TitleDetail title={selected} titles={titles ?? []} onClose={() => backToList(() => setSelectedId(null))} onChanged={load} />
  if (adding)
    return <AddTitle coupleId={coupleId} titles={titles ?? []} shared={adding.shared} onClose={() => backToList(() => setAdding(false))} />

  // "Por ver": del más nuevo al más viejo (como llega). "Vistas": la vista más reciente primero.
  const inTab = titles?.filter((t) => t.status === tab)
  // Los filtros valen para "Por ver" (y la ruleta); "Vistas" se ve entera.
  const filtered = inTab?.filter((t) => tab === 'watched' || matchesFilters(t, filters))
  const shown = filtered
    ?.filter((t) => matchesQuery(t, query))
    .sort((a, b) => (tab === 'watched' ? (b.watchedAt ?? '').localeCompare(a.watchedAt ?? '') : 0))

  const emptyText =
    tab === 'watched'
      ? 'Todavía no vieron nada juntos'
      : titles?.length
        ? 'No queda nada por ver'
        : 'Nuestra lista está vacía'

  // "Tomás 8,75 · Juli —"
  const ourScores = (t: Title) =>
    members
      .map((m) => {
        const own = t.scores.find((sc) => sc.userId === m.userId)
        return `${nameOf(m.userId)} ${own ? formatScore(own.score) : '—'}`
      })
      .join(' · ')

  return (
    <section className="titles">
      {shared && <SharedInbox items={shared} onSearch={(item) => openScreen(() => setAdding({ shared: item }))} />}
      <div className="list-tools">
        <div className="search-field">
          <input
            ref={searchInput}
            type="search"
            aria-label="Buscar en la lista"
            placeholder="Nombre o director"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ClearSearch value={query} onClear={() => setQuery('')} input={searchInput} />
        </div>
        {tab === 'to_watch' && (
          <FiltersPanel
            value={filters}
            options={filterOptions(inTab ?? [])}
            count={{ matching: shown?.length ?? 0, total: inTab?.length ?? 0 }}
            onChange={onFiltersChange}
          />
        )}
      </div>
      <div className="segmented fit">
        <button aria-pressed={tab === 'to_watch'} onClick={() => setTab('to_watch')}>
          Por ver
        </button>
        <button aria-pressed={tab === 'watched'} onClick={() => setTab('watched')}>
          Vistas
        </button>
      </div>
      {offline && titles ? (
        // Sin red, con la última lista guardada: se puede seguir y lo hecho se manda después.
        <p className="offline-note">
          Sin conexión. Lo que hagas se guarda cuando vuelva la conexión
          {pending > 0 && ` (${pending} ${pending === 1 ? 'pendiente' : 'pendientes'})`}
        </p>
      ) : (
        offline && (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        )
      )}
      {!offline && pending > 0 && <p className="offline-note">{`Guardando ${pending} ${pending === 1 ? 'cambio' : 'cambios'}…`}</p>}
      {dropped.length > 0 && (
        <div role="alert" className="dropped">
          {[...new Set(dropped.map(droppedMessage))].map((m) => (
            <p key={m}>{m}</p>
          ))}
          <button className="secondary" onClick={clearDropped}>
            Entendido
          </button>
        </div>
      )}
      {titles === null && !offline && <p>Cargando…</p>}
      {shown?.length === 0 &&
        (filtered?.length ? (
          <p>{`Ningún título coincide con «${query.trim()}»`}</p>
        ) : inTab?.length ? (
          <>
            <p>Ningún título cumple estos filtros</p>
            <button className="secondary" onClick={() => onFiltersChange(NO_FILTERS)}>
              Limpiar filtros
            </button>
          </>
        ) : (
          <p>{emptyText}</p>
        ))}
      {gone && <p role="alert">{`«${gone}» ya no está en la lista`}</p>}
      <ul className="title-list poster-grid">
        {shown?.map((t) => (
          <li key={t.id}>
            <button
              className="open"
              onClick={() =>
                openScreen(() => {
                  opened.current = t
                  setSelectedId(t.id)
                })
              }
            >
              <span className="visually-hidden">Ver </span>
              <PosterTile title={t.title} posterPath={t.posterPath} imdb={imdbScore(t.imdbRating)} inTheaters={t.inTheaters}>
                <small>{t.status === 'watched' ? ourScores(t) : kindLine(t.year, t.mediaType)}</small>
                {t.pending && (
                  <span className="tile-corner">
                    ⏳<span className="visually-hidden"> Se guarda cuando vuelva la conexión</span>
                  </span>
                )}
              </PosterTile>
            </button>
          </li>
        ))}
      </ul>
      {tab === 'to_watch' && (
        <button className="add" aria-label="Agregar" onClick={() => openScreen(() => setAdding({}))}>
          <Icon name="plus" />
          Agregar
        </button>
      )}
    </section>
  )
}
