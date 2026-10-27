import { useState } from 'react'
import { useCouple } from '../features/couple/coupleContext'
import { Discover } from '../features/discover/Discover'
import { ChooseMenu } from '../features/choose/ChooseMenu'
import { Settings } from '../features/settings/Settings'
import { NO_FILTERS, type Filters } from '../features/titles/filters'
import { TitleList } from '../features/titles/TitleList'

export function Home() {
  const { memberCount } = useCouple()
  const [tab, setTab] = useState<'lista' | 'descubrir' | 'elegir' | 'ajustes'>('lista')
  // Los filtros viven acá para que la lista y la ruleta usen los mismos.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  // Tocar "Lista" estando en la lista cierra Agregar o el detalle: la lista se vuelve a montar.
  const [listKey, setListKey] = useState(0)

  function showList() {
    if (tab === 'lista') {
      setListKey((k) => k + 1)
      window.scrollTo(0, 0)
    } else setTab('lista')
  }

  return (
    <div className="home">
      <main className="screen">
        {tab === 'lista' ? (
          <>
            <h1>Lista</h1>
            {memberCount === 1 && <p>Esperando a tu pareja</p>}
            <TitleList key={listKey} filters={filters} onFiltersChange={setFilters} />
          </>
        ) : tab === 'descubrir' ? (
          <Discover />
        ) : tab === 'elegir' ? (
          <>
            <h1>Elegir</h1>
            <ChooseMenu filters={filters} onFiltersChange={setFilters} />
          </>
        ) : (
          <Settings />
        )}
      </main>
      <nav className="tabs">
        <button aria-pressed={tab === 'lista'} onClick={showList}>
          Lista
        </button>
        <button aria-pressed={tab === 'descubrir'} onClick={() => setTab('descubrir')}>
          Descubrir
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
