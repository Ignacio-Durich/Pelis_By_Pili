import { useState } from 'react'
import { TitleCard } from '../titles/TitleCard'
import type { Title } from '../titles/titlesApi'

type Props = {
  heading: string
  titles: Title[]
  matching: Title[]
  initial: string[]
  // Cuántas hay que elegir (o todas las que se puedan, si son menos).
  need: number
  // Las que ya eligió el otro: se ven, con su texto, pero no se pueden elegir.
  locked?: { ids: string[]; label: string }
  onDone: (ids: string[]) => void
}

// Marcar títulos de "Por ver" (con los filtros); "Listo" queda a la vista aunque la lista scrollee.
// Lo usan Top 3 secreto y el Torneo.
export function TitlePicker({ heading, titles, matching, initial, need, locked, onDone }: Props) {
  const [chosen, setChosen] = useState<string[]>(initial)
  // Lo ya elegido sigue a la vista aunque los filtros hayan cambiado.
  // (Salvo que ya se haya visto: eso no se puede elegir.)
  const options = [...matching, ...titles.filter((t) => initial.includes(t.id) && !matching.includes(t) && t.status === 'to_watch')]
  const isLocked = (id: string) => locked?.ids.includes(id) ?? false
  const selectable = options.filter((t) => !isLocked(t.id))
  const picked = chosen.filter((id) => selectable.some((t) => t.id === id))
  const target = Math.min(need, selectable.length)

  // Sobre la selección más nueva: dos toques seguidos no se pisan.
  function toggle(id: string) {
    setChosen((prev) => {
      const current = prev.filter((x) => selectable.some((t) => t.id === x))
      if (current.includes(id)) return current.filter((x) => x !== id)
      return current.length < target ? [...current, id] : current
    })
  }

  return (
    <>
      <h3>{heading}</h3>
      <ul className="title-list reveal-options">
        {options.map((t) => (
          <li key={t.id}>
            <button className="result" aria-pressed={picked.includes(t.id)} disabled={isLocked(t.id)} onClick={() => toggle(t.id)}>
              <TitleCard title={t.title} originalTitle={t.originalTitle} year={t.year} mediaType={t.mediaType} posterPath={t.posterPath}>
                {isLocked(t.id) && <small>{locked!.label}</small>}
              </TitleCard>
            </button>
          </li>
        ))}
      </ul>
      <button className="reveal-done" disabled={options.length === 0 || picked.length !== target} onClick={() => onDone(picked)}>
        {`Listo (${picked.length} de ${target})`}
      </button>
    </>
  )
}
