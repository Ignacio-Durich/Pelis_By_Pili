import { useState } from 'react'
import { useCouple } from '../features/couple/coupleContext'
import { Roulette } from '../features/choose/Roulette'
import { Settings } from '../features/settings/Settings'
import { NO_FILTERS, type Filters } from '../features/titles/filters'
import { TitleList } from '../features/titles/TitleList'

export function Home() {
  const { memberCount } = useCouple()
  const [tab, setTab] = useState<'lista' | 'elegir' | 'ajustes'>('lista')
  // Los filtros viven acá para que la lista y la ruleta usen los mismos.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  return (
    <div className="home">
      <main className="screen">
        {tab === 'lista' ? (
          <>
            <h1>Pelis By Pili</h1>
            {memberCount === 1 && <p>Esperando a tu pareja</p>}
            <TitleList filters={filters} onFiltersChange={setFilters} />
          </>
        ) : tab === 'elegir' ? (
          <Roulette filters={filters} onFiltersChange={setFilters} />
        ) : (
          <Settings />
        )}
      </main>
      <nav className="tabs">
        <button aria-pressed={tab === 'lista'} onClick={() => setTab('lista')}>
          Lista
        </button>
        <button aria-pressed={tab === 'elegir'} onClick={() => setTab('elegir')}>
          Elegir
        </button>
        <button aria-pressed={tab === 'ajustes'} onClick={() => setTab('ajustes')}>
          Ajustes
        </button>
      </nav>
    </div>
  )
}
