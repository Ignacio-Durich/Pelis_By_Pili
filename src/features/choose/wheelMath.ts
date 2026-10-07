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
