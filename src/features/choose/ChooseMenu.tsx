import { useState } from 'react'
import type { Filters } from '../titles/filters'
import { QuickQuestions } from './QuickQuestions'
import { Roulette } from './Roulette'

type Props = { filters: Filters; onFiltersChange: (f: Filters) => void }

export function ChooseMenu({ filters, onFiltersChange }: Props) {
  const [mode, setMode] = useState<'roulette' | 'quick' | null>(null)

  if (mode) {
    return (
      <>
        <button className="back" onClick={() => setMode(null)}>
          Volver a los modos
        </button>
        {mode === 'roulette' ? <Roulette filters={filters} onFiltersChange={onFiltersChange} /> : <QuickQuestions />}
      </>
    )
  }

  return (
    <section className="choose-menu">
      <h2>¿Qué vemos?</h2>
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
