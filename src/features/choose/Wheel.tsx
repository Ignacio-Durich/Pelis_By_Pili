import { shortLabel } from './wheelMath'

type Props = { items: { id: string; label: string }[]; rotation: number; animate: boolean; onEnd: () => void }

const COLORS = ['#ffb703', '#fb8500', '#8ecae6', '#219ebc', '#e76f51', '#2a9d8f']
const R = 96
const MAX_LABELS = 12

// Punto del borde a `deg` grados desde arriba, en sentido horario.
const point = (deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return `${(R * Math.cos(rad)).toFixed(2)} ${(R * Math.sin(rad)).toFixed(2)}`
}

// El nombre va a lo largo del radio; en la mitad izquierda se da vuelta para no quedar cabeza abajo.
const labelTransform = (center: number) =>
  center > 180 ? `rotate(${center + 90}) translate(-58 0)` : `rotate(${center - 90}) translate(58 0)`

export function Wheel({ items, rotation, animate, onEnd }: Props) {
  const seg = 360 / items.length
  return (
    <div className="wheel">
      <svg viewBox="-100 -100 200 200" role="img" aria-label={`Ruleta con ${items.length} ${items.length === 1 ? 'título' : 'títulos'}`}>
        <g
          data-testid="wheel-rotor"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: animate ? 'transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)' : 'none',
          }}
          onTransitionEnd={onEnd}
        >
          {items.map((item, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <g key={item.id}>
                {items.length === 1 ? (
                  <circle data-slice r={R} fill={color} />
                ) : (
                  <path
                    data-slice
                    d={`M0 0 L${point(i * seg)} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${point((i + 1) * seg)} Z`}
                    fill={color}
                    style={{ stroke: 'var(--bg)' }}
                    strokeWidth="1"
                  />
                )}
                {items.length <= MAX_LABELS && (
                  <text transform={labelTransform((i + 0.5) * seg)} textAnchor="middle" dominantBaseline="middle">
                    {shortLabel(item.label)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
        <circle r="10" style={{ fill: 'var(--bg)' }} />
        <path className="wheel-pointer" d="M-9 -104 L9 -104 L0 -84 Z" />
      </svg>
    </div>
  )
}
