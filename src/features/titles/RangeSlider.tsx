import type { CSSProperties } from 'react'

type Props = {
  label: string
  min: number
  max: number
  step: number
  value: [number, number]
  text: string
  format: (v: number) => string
  onChange: (v: [number, number]) => void
}

// Dos deslizadores nativos superpuestos (mínimo y máximo): funcionan con el dedo y con el
// teclado sin librerías. Un extremo se frena en el valor del otro.
export function RangeSlider({ label, min, max, step, value: [low, high], text, format, onChange }: Props) {
  const percent = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <div className="range">
      <div className="range-head">
        <span>{label}</span>
        <small>{text}</small>
      </div>
      <div className="range-track" style={{ '--from': `${percent(low)}%`, '--to': `${percent(high)}%` } as CSSProperties}>
        <input
          type="range"
          aria-label={`${label} mínimo`}
          aria-valuetext={format(low)}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high), high])}
        />
        <input
          type="range"
          aria-label={`${label} máximo`}
          aria-valuetext={format(high)}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low)])}
        />
      </div>
    </div>
  )
}
