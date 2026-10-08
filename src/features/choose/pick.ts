export function pick<T>(candidates: T[], random: () => number = Math.random): T | null {
  if (candidates.length === 0) return null
  return candidates[Math.floor(random() * candidates.length)]
}

// Fisher–Yates sobre una copia: el mismo `random` da siempre el mismo orden (los tests lo usan).
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
