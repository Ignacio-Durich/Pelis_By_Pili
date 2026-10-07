import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Por defecto, contra el Supabase local (.env.test.local pisa a .env.local).
// SUPABASE_TARGET=remote apunta al proyecto real: crea y borra solo sus propios usuarios y filas.
const mode = process.env.SUPABASE_TARGET === 'remote' ? 'production' : 'test'

export default defineConfig({
  test: {
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnv(mode, process.cwd(), ''),
  },
})
