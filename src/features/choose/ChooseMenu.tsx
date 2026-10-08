import { useState } from 'react'
import type { Filters } from '../titles/filters'
import { Bumble } from './Bumble'
import { QuickQuestions } from './QuickQuestions'
import { Reveal } from './Reveal'
import { Roulette } from './Roulette'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void }

export function ChooseMenu({ filters, onFiltersChange }: Props) {
  const [mode, setMode] = useState<'bumble' | 'reveal' | 'roulette' | 'quick' | null>(null)

  if (mode) {
    const back = () => setMode(null)
    if (mode === 'bumble') return <Bumble filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    if (mode === 'reveal') return <Reveal filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    if (mode === 'roulette') return <Roulette filters={filters} onFiltersChange={onFiltersChange} onBack={back} />
    return <QuickQuestions onBack={back} />
  }

  return (
    <section className="choose-menu">
      <h2>¿Qué vemos?</h2>
      <button onClick={() => setMode('bumble')}>
        Bumble
        <small>Deslicen y gana la que les guste a los dos</small>
      </button>
      <button onClick={() => setMode('reveal')}>
        Top 3 secreto
        <small>Cada uno elige 3 en secreto y se muestran a la vez</small>
      </button>
      <button onClick={() => setMode('roulette')}>
        Ruleta
        <small>Gira entre los títulos que cumplen los filtros</small>
      </button>
      <button onClick={() => setMode('quick')}>
        Preguntas rápidas
        <small>Respondan tres preguntas y les sugerimos 5</small>
      </button>
    </section>
  )
}
