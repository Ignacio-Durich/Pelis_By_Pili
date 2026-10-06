import { expect, test } from 'vitest'
import { requireEnv } from './env.ts'

test('returns the requested values', () => {
  expect(requireEnv(['A', 'B'], { A: '1', B: '2', C: '3' })).toEqual({ A: '1', B: '2' })
})

test('throws naming every missing variable', () => {
  expect(() => requireEnv(['A', 'B', 'C'], { A: '1' })).toThrow(
    new Error('Faltan variables de entorno: B, C'),
  )
})

test('treats empty strings as missing', () => {
  expect(() => requireEnv(['A'], { A: '' })).toThrow(new Error('Faltan variables de entorno: A'))
})
