import { useState } from 'react'
import { activeCount, NO_FILTERS, type Filters } from './filters'

type Props = { value: Filters; options: { genres: string[]; platforms: string[] }; onChange: (f: Filters) => void }

const types = [
  ['all', 'Todo'],
  ['movie', 'Películas'],
  ['tv', 'Series'],
] as const
const durations = [
  [90, 'Hasta 1 h 30'],
  [120, 'Hasta 2 h'],
  [150, 'Hasta 2 h 30'],
] as const
const imdbMins = [6, 7, 8]

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
const toNumber = (v: string) => (v === '' ? null : Number(v))

export function FiltersPanel({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const count = activeCount(value)
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })

  return (
    <div className="filters">
      <button className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {count ? `Filtros (${count})` : 'Filtros'}
      </button>
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
          <label>
            Duración
            <select value={value.maxRuntime ?? ''} onChange={(e) => set({ maxRuntime: toNumber(e.target.value) })}>
              <option value="">Cualquiera</option>
              {durations.map(([minutes, label]) => (
                <option key={minutes} value={minutes}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Puntaje IMDb
            <select value={value.minImdb ?? ''} onChange={(e) => set({ minImdb: toNumber(e.target.value) })}>
              <option value="">Cualquiera</option>
              {imdbMins.map((n) => (
                <option key={n} value={n}>{`${n} o más`}</option>
              ))}
            </select>
          </label>
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
