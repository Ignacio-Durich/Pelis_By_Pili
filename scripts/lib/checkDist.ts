const SECRET_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'TMDB_API_KEY', 'OMDB_API_KEY']
const LOCAL_SUPABASE = '127.0.0.1:54321'

// Revisa lo que se va a publicar: ni claves secretas (nombre o valor) ni la URL del Supabase local.
export function findLeaks(files: Record<string, string>, secretValues: string[]): string[] {
  const leaks: string[] = []
  for (const [path, content] of Object.entries(files)) {
    if (secretValues.some((v) => v && content.includes(v))) leaks.push(`${path}: un valor secreto`)
    for (const name of SECRET_NAMES) if (content.includes(name)) leaks.push(`${path}: el nombre ${name}`)
    if (content.includes(LOCAL_SUPABASE)) leaks.push(`${path}: la URL del Supabase local`)
  }
  return leaks
}
