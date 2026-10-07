import { expect, test } from 'vitest'
import { shortLabel, targetRotation } from './wheelMath'

test('targetRotation puts the chosen slice under the top pointer after at least 5 turns', () => {
  for (const [current, index, count] of [
    [0, 0, 1],
    [0, 2, 5],
    [1234, 7, 12],
    [90, 0, 3],
  ]) {
    const r = targetRotation(current, index, count)
    const center = (index + 0.5) * (360 / count)
    expect(((r + center) % 360 + 360) % 360).toBeCloseTo(0)
    expect(r - current).toBeGreaterThanOrEqual(5 * 360)
    expect(r - current).toBeLessThan(6 * 360)
  }
})

test('with 0 turns it only moves the slice under the pointer', () => {
  const r = targetRotation(0, 1, 4, 0)
  expect(r).toBeGreaterThanOrEqual(0)
  expect(r).toBeLessThan(360)
  expect((r + 135) % 360).toBeCloseTo(0)
})

test('shortLabel cuts long titles', () => {
  expect(shortLabel('Dark')).toBe('Dark')
  expect(shortLabel('Mi pobre angelito 2: Perdido en Nueva York')).toBe('Mi pobre angel…')
})
