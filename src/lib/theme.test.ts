import { beforeEach, expect, test } from 'vitest'
import { applyTheme, DEFAULT_THEME, savedTheme, saveTheme, THEMES } from './theme'

const root = () => document.documentElement
const meta = () => document.querySelector('meta[name="theme-color"]')

beforeEach(() => {
  localStorage.clear()
  root().removeAttribute('style')
  document.head.innerHTML = '<meta name="theme-color" content="#1b1b2f">'
})

test('there are 15 themes with unique ids, starting with the current one', () => {
  expect(THEMES).toHaveLength(15)
  expect(new Set(THEMES.map((t) => t.id)).size).toBe(15)
  expect(THEMES[0]).toMatchObject({ id: 'noche', name: 'Azul noche', bg: '#1b1b2f', accent: '#ffb703' })
  expect(DEFAULT_THEME).toBe('noche')
})

test('applying a theme sets its colors, color scheme and status bar color', () => {
  applyTheme('menta')
  expect(root().style.getPropertyValue('--bg')).toBe('#f1faf6')
  expect(root().style.getPropertyValue('--accent')).toBe('#0f9d76')
  expect(root().style.getPropertyValue('--text')).toBe('#0f2a22')
  expect(root().style.colorScheme).toBe('light')
  expect(meta()?.getAttribute('content')).toBe('#f1faf6')
  applyTheme('cine')
  expect(root().style.getPropertyValue('--bg')).toBe('#1a0b10')
  expect(root().style.colorScheme).toBe('dark')
})

test('an unknown theme falls back to the default one', () => {
  applyTheme('no-existe')
  expect(root().style.getPropertyValue('--bg')).toBe('#1b1b2f')
})

test('the chosen theme is remembered on this phone', () => {
  expect(savedTheme()).toBe('noche')
  saveTheme('oceano')
  expect(savedTheme()).toBe('oceano')
  localStorage.setItem('pelis-theme', 'basura')
  expect(savedTheme()).toBe('noche')
})
