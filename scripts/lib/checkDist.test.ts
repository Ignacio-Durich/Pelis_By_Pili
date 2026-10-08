import { expect, test } from 'vitest'
import { findLeaks } from './checkDist.ts'

const files = { 'index.html': '<html>https://abc.supabase.co</html>', 'assets/app.js': 'const k = "sb_secret_123"' }

test('finds secret values, secret names and the local Supabase URL', () => {
  expect(findLeaks(files, ['sb_secret_123'])).toEqual(['assets/app.js: un valor secreto'])
  expect(findLeaks({ 'a.js': 'TMDB_API_KEY' }, [])).toEqual(['a.js: el nombre TMDB_API_KEY'])
  expect(findLeaks({ 'a.js': 'http://127.0.0.1:54321' }, [])).toEqual(['a.js: la URL del Supabase local'])
})

test('a clean build has no leaks, and empty secrets are ignored', () => {
  expect(findLeaks(files, ['', 'otro'])).toEqual([])
})
