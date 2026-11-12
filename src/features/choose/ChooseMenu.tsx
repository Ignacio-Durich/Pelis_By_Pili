import { useState } from 'react'
import { Icon, type IconName } from '../../lib/icons'
import type { Filters } from '../titles/filters'
import { Bumble } from './Bumble'
import { QuickQuestions } from './QuickQuestions'
import { Reveal } from './Reveal'
import { Roulette } from './Roulette'
import { Tournament } from './Tournament'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void }

type Mode = 'bumble' | 'reveal' | 'tournament' | 'roulette' | 'quick'

const MODES: [Mode, string, string, IconName][] = [
  ['bumble', 'Bumble', 'Deslicen y gana la que les guste a los dos', 'heart'],
  ['reveal', 'Top 3 secreto', 'Cada uno elige 3 en secreto y se muestran a la vez', 'eyeOff'],
  ['tournament', 'Torneo', 'Elijan 4 cada uno y que se enfrenten de a dos', 'trophy'],
  ['roulette', 'Ruleta', 'Gira entre los títulos que cumplen los filtros', 'wheel'],
  ['quick', 'Preguntas rápidas', 'Respondan tres preguntas y les sugerimos 5', 'bolt'],
]

export function ChooseMenu({ filters, onFiltersChange }: Props) {
  const [mode, setMode] = useState<Mode | null>(null)

  if (mode) {
    const back = () => setMode(null)
    if (mode === 'bumble') return <Bumble filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    if (mode === 'reveal') return <Reveal filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    if (mode === 'tournament') return <Tournament filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    if (mode === 'roulette') return <Roulette filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    return <QuickQuestions onBack={back} />
  }

  return (
    <section className="choose-menu">
      {MODES.map(([key, name, about, icon]) => (
        <button key={key} onClick={() => setMode(key)}>
          <Icon name={icon} size={26} />
          <span>
            <strong>{name}</strong>
            <small>{about}</small>
          </span>
        </button>
      ))}
    </section>
  )
}
