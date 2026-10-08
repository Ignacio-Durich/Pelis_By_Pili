import { useState } from 'react'
import {
  activeCount,
  formatMinutes,
  IMDB_RANGE,
  imdbText,
  NO_FILTERS,
  RUNTIME_RANGE,
  runtimeText,
  type Filters,
} from './filters'
import { RangeSlider } from './RangeSlider'

type Props = {
  value: Filters
  options: { genres: string[]; platforms: string[] }
  // Títulos "Por ver" que cumplen los filtros, de todos los "Por ver".
  count: { matching: number; total: number }
  onChange: (f: Filters) => void
}

const types = [
  ['all', 'Todo'],
  ['movie', 'Películas'],
  ['tv', 'Series'],
] as const

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

export function FiltersPanel({ value, options, count: { matching, total }, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const active = activeCount(value)
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })

  return (
    <div className="filters">
      <button className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {active ? `Filtros (${active})` : 'Filtros'}
      </button>
      {active > 0 && (
        <small className="filters-count" aria-live="polite">
          {`${matching} de ${total} títulos ${matching === 1 ? 'cumple' : 'cumplen'} los filtros`}
        </small>
      )}
      {open && (
        <div className="filters-panel">
          <span>Tipo</span>
          <div className="segmented">
            {types.map(([key, label]) => (
              <button key={key} aria-pressed={value.type === key} onClick={() => set({ type: key })}>
                {label}
              </button>
            ))}
          </div>
          <RangeSlider
            label="Duración"
            {...RUNTIME_RANGE}
            value={value.runtime}
            text={runtimeText(value.runtime)}
            format={formatMinutes}
            onChange={(runtime) => set({ runtime })}
          />
          <RangeSlider
            label="IMDb"
            {...IMDB_RANGE}
            value={value.imdb}
            text={imdbText(value.imdb)}
            format={String}
            onChange={(imdb) => set({ imdb })}
          />
          <Chips label="Géneros" options={options.genres} chosen={value.genres} onToggle={(g) => set({ genres: toggle(value.genres, g) })} />
          <Chips
            label="Plataformas"
            options={options.platforms}
            chosen={value.platforms}
            onToggle={(p) => set({ platforms: toggle(value.platforms, p) })}
          />
          <button className="secondary" onClick={() => onChange(NO_FILTERS)}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}

function Chips({ label, options, chosen, onToggle }: { label: string; options: string[]; chosen: string[]; onToggle: (o: string) => void }) {
  return (
    <div className="chips-group">
      <span>{label}</span>
      {options.length === 0 ? (
        <small>Todavía no hay datos</small>
      ) : (
        <div className="chips">
          {options.map((o) => (
            <button key={o} className="chip" aria-pressed={chosen.includes(o)} onClick={() => onToggle(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
