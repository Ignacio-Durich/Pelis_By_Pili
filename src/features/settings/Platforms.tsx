import { useEffect, useState } from 'react'
import { useCouple } from '../couple/coupleContext'
import { fetchPlatforms, fetchProviders, setPlatforms, type ProviderOption } from '../discover/discoverApi'

// Ajustes → Nuestras plataformas: las que pagan, para "En sus plataformas" de Novedades.
export function Platforms() {
  const { coupleId } = useCouple()
  const [providers, setProviders] = useState<ProviderOption[] | null>(null)
  const [chosen, setChosen] = useState<number[]>([])
  // Se ven las conocidas y las que ya tenían elegidas al abrir; el resto, con "Ver más".
  const [chosenAtStart, setChosenAtStart] = useState<number[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchProviders(), fetchPlatforms(coupleId)])
      .then(([all, mine]) => {
        if (cancelled) return
        setProviders(all)
        setChosen(mine)
        setChosenAtStart(mine)
      })
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
  }, [coupleId])

  // Guardado optimista: se ve al toque y, si falla, vuelve a como estaba.
  async function toggle(id: number) {
    const before = chosen
    const next = before.includes(id) ? before.filter((x) => x !== id) : [...before, id]
    setChosen(next)
    setSaving(true)
    setSaveFailed(false)
    try {
      await setPlatforms(next)
    } catch {
      setChosen(before)
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const visible = providers && (showAll ? providers : providers.filter((p) => p.known || chosenAtStart.includes(p.id)))

  return (
    <section className="platforms">
      <h2>Nuestras plataformas</h2>
      <p>Las que pagan. Se usan en Novedades.</p>
      {loadFailed && <p role="alert">No se pudieron cargar las plataformas</p>}
      {visible && (
        <div className="platforms-grid">
          {visible.map((p) => (
            <button key={p.id} className="platform-option" aria-pressed={chosen.includes(p.id)} disabled={saving} onClick={() => toggle(p.id)}>
              {p.logoPath && <img src={`https://image.tmdb.org/t/p/w92${p.logoPath}`} alt="" />}
              {p.name}
            </button>
          ))}
        </div>
      )}
      {visible && visible.length < providers!.length && (
        <button className="secondary" onClick={() => setShowAll(true)}>
          Ver más
        </button>
      )}
      {saveFailed && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
    </section>
  )
}
