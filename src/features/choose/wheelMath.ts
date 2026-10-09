// Rotación final (en grados, sentido horario) para que el gajo `index` quede bajo la flecha de
// arriba, después de al menos `turns` vueltas completas desde `current`.
export function targetRotation(current: number, index: number, count: number, turns = 5): number {
  const center = (index + 0.5) * (360 / count)
  const base = current + turns * 360
  const extra = (((360 - center - base) % 360) + 360) % 360
  return base + extra
}

export function shortLabel(title: string, max = 14): string {
  return title.length <= max ? title : `${title.slice(0, max).trimEnd()}…`
}

// El nombre va a lo largo del radio. Se da vuelta según dónde queda después de girar (no antes),
// así ninguno termina cabeza abajo.
export function labelTransform(center: number, rotation: number): string {
  const final = (((center + rotation) % 360) + 360) % 360
  return final > 180 ? `rotate(${center + 90}) translate(-58 0)` : `rotate(${center - 90}) translate(58 0)`
}

// Colores en orden; si el último quedaría igual al primero (7 o 13 gajos con 6 colores), toma el del medio.
export function sliceColor(i: number, n: number, colors: string[]): string {
  if (n > 1 && i === n - 1 && n % colors.length === 1) return colors[Math.floor(colors.length / 2)]
  return colors[i % colors.length]
}
