import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listTitles: vi.fn(),
  subscribeTitles: vi.fn(),
  loadOpenReveal: vi.fn(),
  subscribeReveal: vi.fn(),
  startReveal: vi.fn(),
  submitReveal: vi.fn(),
  finishReveal: vi.fn(),
}))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('./revealApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./revealApi')>()),
  loadOpenReveal: api.loadOpenReveal,
  subscribeReveal: api.subscribeReveal,
  startReveal: api.startReveal,
  submitReveal: api.submitReveal,
  finishReveal: api.finishReveal,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { nacho, withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS } from '../titles/filters'
import { seededIndex } from './bumbleLogic'
import { Reveal } from './Reveal'
import type { RevealSession } from './revealApi'

const titles = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => makeTitle({ id, tmdbId: i, title: `Peli ${id.toUpperCase()}` }))
let notify: () => void

function reducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: on }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  reducedMotion(true)
  api.listTitles.mockResolvedValue(titles)
  api.subscribeTitles.mockReturnValue(() => {})
  api.loadOpenReveal.mockResolvedValue(null)
  api.subscribeReveal.mockImplementation((_id: string, onChange: () => void) => {
    notify = onChange
    return () => {}
  })
  api.startReveal.mockResolvedValue('s1')
  api.submitReveal.mockResolvedValue(undefined)
  api.finishReveal.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const pick = (...letters: string[]) => letters.forEach((l) => press(new RegExp(`Peli ${l.toUpperCase()}`)))
const game = (over: Partial<RevealSession>): RevealSession => ({ id: 's1', ready: [], revealed: false, picks: [], ...over })

function renderReveal(members?: Parameters<typeof withCouple>[1]) {
  return render(withCouple(<Reveal filters={NO_FILTERS} onFiltersChange={vi.fn()} onBack={vi.fn()} />, members))
}

async function renderGame(session: RevealSession) {
  api.loadOpenReveal.mockResolvedValue(session)
  renderReveal()
  await screen.findAllByText(/Elegí tus 3|Esperando|Coinciden|Eligió|ruleta|^3$/)
}

async function changeGame(session: RevealSession) {
  api.loadOpenReveal.mockResolvedValue(session)
  await act(async () => notify())
}

test('asks how many phones; two phones need the partner and one needs a title', async () => {
  const { unmount } = renderReveal([nacho])
  expect(await screen.findByRole('heading', { name: 'Top 3 secreto' })).toBeInTheDocument()
  expect(screen.getByText('Cada uno elige 3 en secreto y se muestran a la vez.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '📱📱 Dos' })).toBeDisabled()
  expect(screen.getByText('Para usar dos celulares, tu pareja tiene que unirse')).toBeInTheDocument()
  unmount()
  api.listTitles.mockResolvedValue([])
  renderReveal()
  expect(await screen.findByText('Hace falta al menos 1 título')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '📱 Uno' })).toBeDisabled()
})

test('Dos starts a game', async () => {
  renderReveal()
  await screen.findByText('¿Cuántos celulares van a usar?')
  await act(async () => press('📱📱 Dos'))
  expect(api.startReveal).toHaveBeenCalled()
})

test('picking: up to three, then Listo sends them', async () => {
  await renderGame(game({}))
  expect(screen.getByText('Elegí tus 3')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Listo (0 de 3)' })).toBeDisabled()
  pick('a', 'c', 'e', 'f')
  expect(screen.getByRole('button', { name: /Peli F/ })).toHaveAttribute('aria-pressed', 'false')
  pick('c')
  expect(screen.getByRole('button', { name: /Peli C/ })).toHaveAttribute('aria-pressed', 'false')
  pick('b')
  await act(async () => press('Listo (3 de 3)'))
  expect(api.submitReveal).toHaveBeenCalledWith('s1', ['a', 'e', 'b'])
})

test('after choosing it waits, and the choice can be changed', async () => {
  await renderGame(game({ ready: ['u1'], picks: [{ userId: 'u1', titleIds: ['a', 'b', 'c'] }] }))
  expect(screen.getByText('Listo. Esperando a Pili…')).toBeInTheDocument()
  press('Cambiar mi elección')
  expect(screen.getByRole('button', { name: /Peli B/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Listo (3 de 3)' })).toBeEnabled()
})

test('it shows when the partner already chose, never what', async () => {
  await renderGame(game({ ready: ['u2'] }))
  expect(screen.getByText('Pili ya eligió')).toBeInTheDocument()
})

test('the reveal shows the matches first and one match wins', async () => {
  await renderGame(game({ ready: ['u1'], picks: [{ userId: 'u1', titleIds: ['a', 'b', 'c'] }] }))
  await changeGame(game({ ready: ['u1', 'u2'], revealed: true, picks: [{ userId: 'u2', titleIds: ['c', 'd', 'e'] }, { userId: 'u1', titleIds: ['a', 'b', 'c'] }] }))
  expect(screen.getByRole('heading', { name: 'Coinciden' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Eligió Nacho' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Eligió Pili' })).toBeInTheDocument()
  expect(screen.getByText('¡Ganó Peli C!')).toBeInTheDocument()
  await act(async () => press('Listo'))
  expect(api.finishReveal).toHaveBeenCalledWith('s1', 'c')
})

test('without matches the roulette decides among the six, the same on both phones', async () => {
  await renderGame(game({ ready: ['u1', 'u2'], revealed: true, picks: [{ userId: 'u1', titleIds: ['a', 'b', 'c'] }, { userId: 'u2', titleIds: ['d', 'e', 'f'] }] }))
  expect(screen.queryByRole('heading', { name: 'Coinciden' })).not.toBeInTheDocument()
  expect(screen.getByText('Que decida la ruleta')).toBeInTheDocument()
  press('Girar')
  expect(screen.getByText(`¡Ganó ${titles[seededIndex('s1:reveal', 6)].title}!`)).toBeInTheDocument()
})

test('the reveal counts 3, 2, 1 first', async () => {
  reducedMotion(false)
  vi.useFakeTimers({ shouldAdvanceTime: true })
  await renderGame(game({ ready: ['u1', 'u2'], revealed: true, picks: [{ userId: 'u1', titleIds: ['a'] }, { userId: 'u2', titleIds: ['a'] }] }))
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.queryByText('¡Ganó Peli A!')).not.toBeInTheDocument()
  for (const next of ['2', '1']) {
    await act(async () => vi.advanceTimersByTime(1000))
    expect(screen.getByText(next)).toBeInTheDocument()
  }
  await act(async () => vi.advanceTimersByTime(1000))
  expect(screen.getByText('¡Ganó Peli A!')).toBeInTheDocument()
})

test('one phone: the first chooses, passes the phone without showing, the second chooses, and Revelar', async () => {
  const first = renderReveal()
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  expect(screen.getByText('Turno de Nacho: elegí tus 3')).toBeInTheDocument()
  pick('a', 'b', 'c')
  press('Listo (3 de 3)')
  expect(screen.getByText('Pasale el celu a Pili')).toBeInTheDocument()
  expect(screen.queryByText('Peli A')).not.toBeInTheDocument()
  first.unmount()
  renderReveal()
  expect(await screen.findByText('Pasale el celu a Pili')).toBeInTheDocument()
  press('Listo, soy Pili')
  expect(screen.getByText('Turno de Pili: elegí tus 3')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Peli A/ })).toHaveAttribute('aria-pressed', 'false')
  pick('c', 'd', 'e')
  press('Listo (3 de 3)')
  press('Revelar')
  expect(screen.getByText('¡Ganó Peli C!')).toBeInTheDocument()
  expect(api.submitReveal).not.toHaveBeenCalled()
  press('Listo')
  expect(screen.getByText('¿Cuántos celulares van a usar?')).toBeInTheDocument()
})
