export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
