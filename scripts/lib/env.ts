export function requireEnv(
  names: string[],
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const missing = names.filter((name) => !source[name])
  if (missing.length > 0) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`)
  return Object.fromEntries(names.map((name) => [name, source[name]!]))
}
