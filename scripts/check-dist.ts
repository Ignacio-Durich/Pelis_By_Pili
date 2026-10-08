// Uso: npx tsx --env-file=.env.local scripts/check-dist.ts (lo corre `npm run deploy` antes de publicar).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { findLeaks } from './lib/checkDist.ts'
import { requireEnv } from './lib/env.ts'

const secrets = Object.values(requireEnv(['SUPABASE_SERVICE_ROLE_KEY', 'TMDB_API_KEY', 'OMDB_API_KEY']))
const files: Record<string, string> = {}
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else files[path] = readFileSync(path, 'latin1')
  }
}
walk('dist')

const leaks = findLeaks(files, secrets)
if (leaks.length > 0) {
  console.error(`No se publica: dist/ contiene\n- ${leaks.join('\n- ')}`)
  process.exit(1)
}
console.log(`dist/ revisado: ${Object.keys(files).length} archivos, sin claves ni URL local.`)
