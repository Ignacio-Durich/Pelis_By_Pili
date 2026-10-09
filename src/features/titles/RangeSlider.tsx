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

// Dos deslizadores nativos superpuestos (desde y hasta): funcionan con el dedo y con el
// teclado sin librerías. Un extremo se frena un paso antes del otro: un rango cerrado
// ("Hasta 0 min") nunca daría resultados.
export function RangeSlider({ label, min, max, step, value: [low, high], text, format, onChange }: Props) {
  const percent = (v: number) => ((v - min) / (max - min)) * 100
  // Con los dos pulgares juntos solo se puede tocar el de arriba: en la mitad alta tiene que ser
  // el mínimo (el máximo no puede subir más), si no la barra queda trabada.
  const minOnTop = high - low <= step && low > (min + max) / 2
  return (
    <div className="range">
      <div className="range-head">
        <span>{label}</span>
        <small>{text}</small>
      </div>
      <div className="range-track" style={{ '--from': `${percent(low)}%`, '--to': `${percent(high)}%` } as CSSProperties}>
        <input
          type="range"
          aria-label={`${label} desde`}
          style={{ zIndex: minOnTop ? 2 : 1 }}
          aria-valuetext={format(low)}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high - step), high])}
        />
        <input
          type="range"
          aria-label={`${label} hasta`}
          aria-valuetext={format(high)}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low + step)])}
        />
      </div>
    </div>
  )
}
