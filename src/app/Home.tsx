import { useState } from 'react'
import { useCouple } from '../features/couple/coupleContext'
import { Settings } from '../features/settings/Settings'
import { TitleList } from '../features/titles/TitleList'

export function Home() {
  const { memberCount } = useCouple()
  const [tab, setTab] = useState<'lista' | 'ajustes'>('lista')

  return (
    <div className="home">
      <main className="screen">
        {tab === 'lista' ? (
          <>
            <h1>Pelis By Pili</h1>
            {memberCount === 1 && <p>Esperando a tu pareja</p>}
            <TitleList />
          </>
        ) : (
          <Settings />
        )}
      </main>
      <nav className="tabs">
        <button aria-pressed={tab === 'lista'} onClick={() => setTab('lista')}>
          Lista
        </button>
        <button aria-pressed={tab === 'ajustes'} onClick={() => setTab('ajustes')}>
          Ajustes
        </button>
      </nav>
    </div>
  )
}
