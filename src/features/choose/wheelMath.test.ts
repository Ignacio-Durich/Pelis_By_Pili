import { expect, test } from 'vitest'
import { labelTransform, shortLabel, sliceColor, targetRotation } from './wheelMath'

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

test('a label is flipped by where it ends after spinning, so it never reads upside down', () => {
  expect(labelTransform(90, 0)).toBe('rotate(0) translate(58 0)')
  expect(labelTransform(90, 180)).toBe('rotate(180) translate(-58 0)')
  expect(labelTransform(270, 180)).toBe('rotate(180) translate(58 0)')
})

test('no two neighbouring slices share a color, the last and the first included', () => {
  const colors = ['1', '2', '3', '4', '5', '6']
  for (let n = 2; n <= 13; n++) {
    const all = Array.from({ length: n }, (_, i) => sliceColor(i, n, colors))
    for (let i = 0; i < n; i++) expect(all[i], `n=${n} i=${i}`).not.toBe(all[(i + 1) % n])
  }
})
