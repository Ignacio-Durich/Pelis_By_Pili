export function pick<T>(candidates: T[], random: () => number = Math.random): T | null {
  if (candidates.length === 0) return null
  return candidates[Math.floor(random() * candidates.length)]
}
