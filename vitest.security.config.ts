import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Habla con el proyecto real de Supabase: crea y borra solo sus propios usuarios y filas.
export default defineConfig({
  test: {
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnv('', process.cwd(), ''),
  },
})
