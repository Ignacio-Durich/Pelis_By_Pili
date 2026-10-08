import { useEffect, useRef, useState } from 'react'
import type { Title } from '../titles/titlesApi'
import { Wheel } from './Wheel'
import { targetRotation } from './wheelMath'

// Si la rueda no avisa que terminó (pestaña en segundo plano), el resultado aparece igual.
const SPIN_FALLBACK_MS = 4500

// La ruleta de desempate: el resultado sale de la semilla, así los dos celulares ven la misma.
export function TieBreak({ candidates, index, label, onEnd }: { candidates: Title[]; index: number; label: string; onEnd: (id: string) => void }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const fallback = useRef<number | undefined>(undefined)

  useEffect(() => () => clearTimeout(fallback.current), [])

  function finish() {
    clearTimeout(fallback.current)
    setSpinning(false)
    onEnd(candidates[index].id)
  }

  function spin() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return finish()
    setSpinning(true)
    setRotation((r) => targetRotation(r, index, candidates.length))
    fallback.current = window.setTimeout(finish, SPIN_FALLBACK_MS)
  }

  return (
    <>
      <p>{label}</p>
      <Wheel items={candidates.map((t) => ({ id: t.id, label: t.title }))} rotation={rotation} animate={spinning} onEnd={finish} />
      <button disabled={spinning} onClick={spin}>
        Girar
      </button>
    </>
  )
}
