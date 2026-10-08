import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listTitles: vi.fn(),
  subscribeTitles: vi.fn(),
  fetchTitleDetail: vi.fn(),
  loadOpenBumble: vi.fn(),
  subscribeBumble: vi.fn(),
  startBumble: vi.fn(),
  bumbleVote: vi.fn(),
  bumbleUndo: vi.fn(),
  finishBumble: vi.fn(),
}))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('./bumbleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bumbleApi')>()),
  loadOpenBumble: api.loadOpenBumble,
  subscribeBumble: api.subscribeBumble,
  startBumble: api.startBumble,
  bumbleVote: api.bumbleVote,
  bumbleUndo: api.bumbleUndo,
  finishBumble: api.finishBumble,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { nacho, withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS, type Filters } from '../titles/filters'
import { Bumble } from './Bumble'
import type { BumbleSession } from './bumbleApi'
import { seededIndex, type Vote } from './bumbleLogic'

const [a, b, c] = ['a', 'b', 'c'].map((id, i) => makeTitle({ id, tmdbId: i, title: `Peli ${id.toUpperCase()}`, genres: [i === 2 ? 'Drama' : 'Comedia'] }))
// Con random casi 1, buildDeck deja el orden de la lista.
const keepOrder = () => 0.999
let notifyBumble: () => void

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
  api.listTitles.mockResolvedValue([a, b, c])
  api.subscribeTitles.mockReturnValue(() => {})
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.loadOpenBumble.mockResolvedValue(null)
  api.subscribeBumble.mockImplementation((_id: string, onChange: () => void) => {
    notifyBumble = onChange
    return () => {}
  })
  api.startBumble.mockResolvedValue('s1')
  api.bumbleVote.mockResolvedValue(undefined)
  api.bumbleUndo.mockResolvedValue(undefined)
  api.finishBumble.mockResolvedValue(undefined)
})

const v = (userId: string, titleId: string, liked: boolean, round = 1): Vote => ({ userId, round, titleId, liked })
const game = (votes: Vote[], deck = ['a', 'b', 'c']): BumbleSession => ({ id: 's1', deck, votes })
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const cardTitle = () => screen.getByTestId('bumble-card').querySelector('strong')?.textContent

function renderBumble(members?: Parameters<typeof withCouple>[1], filters: Filters = NO_FILTERS) {
  return render(withCouple(<Bumble filters={filters} onFiltersChange={vi.fn()} onBack={vi.fn()} random={keepOrder} />, members))
}

async function renderGame(votes: Vote[], deck?: string[]) {
  api.loadOpenBumble.mockResolvedValue(game(votes, deck))
  renderBumble()
  await screen.findAllByText(/Vos: |Esperando|Ganó|No hubo|ruleta/)
}

async function changeGame(votes: Vote[], deck?: string[]) {
  api.loadOpenBumble.mockResolvedValue(game(votes, deck))
  await act(async () => notifyBumble())
}

test('asks how many phones; two phones need the partner', async () => {
  renderBumble([nacho])
  expect(await screen.findByText('¿Cuántos celulares van a usar?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '📱📱 Dos' })).toBeDisabled()
  expect(screen.getByText('Para usar dos celulares, tu pareja tiene que unirse')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '📱 Uno' })).toBeEnabled()
})

test('with fewer than 2 titles neither option is available', async () => {
  api.listTitles.mockResolvedValue([a])
  renderBumble()
  expect(await screen.findByText('Hacen falta al menos 2 títulos')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '📱 Uno' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '📱📱 Dos' })).toBeDisabled()
})

test('Dos starts a game with the titles that match the filters', async () => {
  renderBumble(undefined, { ...NO_FILTERS, genres: ['Comedia'] })
  await screen.findByText('¿Cuántos celulares van a usar?')
  await act(async () => press('📱📱 Dos'))
  expect(api.startBumble).toHaveBeenCalledWith(['a', 'b'])
})

test('an open game is entered directly, with both progresses', async () => {
  await renderGame([v('u2', 'a', true)])
  expect(screen.queryByText('¿Cuántos celulares van a usar?')).not.toBeInTheDocument()
  expect(cardTitle()).toBe('Peli A')
  expect(screen.getByText('Vos: 0 de 3 · Pili: 1 de 3')).toBeInTheDocument()
})

test('voting saves and moves on without waiting', async () => {
  api.bumbleVote.mockReturnValue(new Promise(() => {}))
  await renderGame([])
  press('👍 Sí')
  expect(api.bumbleVote).toHaveBeenCalledWith('s1', 1, 'a', true)
  expect(cardTitle()).toBe('Peli B')
})

test('a vote that fails brings the card back with a notice', async () => {
  api.bumbleVote.mockRejectedValue(new Error('network'))
  await renderGame([])
  await act(async () => press('👎 No'))
  expect(cardTitle()).toBe('Peli A')
  expect(screen.getByText('No se pudo guardar. Probá de nuevo.')).toBeInTheDocument()
})

test('a partner vote that completes a match shows it, and undoing it takes it away', async () => {
  await renderGame([v('u1', 'a', true)])
  expect(screen.getByText('Matches: 0')).toBeInTheDocument()
  await changeGame([v('u1', 'a', true), v('u2', 'a', true)])
  expect(screen.getByRole('status')).toHaveTextContent('¡Match! Peli A')
  expect(screen.getByText('Matches: 1')).toBeInTheDocument()
  await changeGame([v('u1', 'a', true)])
  expect(screen.getByText('Matches: 0')).toBeInTheDocument()
})

test('when I finish and Pili did not, it waits for her', async () => {
  await renderGame(['a', 'b', 'c'].map((id) => v('u1', id, true)).concat(v('u2', 'a', true)))
  expect(screen.getByText('Esperando a Pili (1 de 3)')).toBeInTheDocument()
})

test('one match wins and Listo saves it', async () => {
  const votes = ['a', 'b', 'c'].flatMap((id) => [v('u1', id, id === 'b'), v('u2', id, true)])
  await renderGame(votes)
  expect(screen.getByText('¡Ganó Peli B!')).toBeInTheDocument()
  await act(async () => press('Listo'))
  expect(api.finishBumble).toHaveBeenCalledWith('s1', 'b')
})

test('several matches go to round 2', async () => {
  const votes = ['a', 'b', 'c'].flatMap((id) => [v('u1', id, id !== 'c'), v('u2', id, true)])
  await renderGame(votes)
  expect(screen.getByText('Vuelta 2')).toBeInTheDocument()
  expect(screen.getByText('Vos: 0 de 2 · Pili: 0 de 2')).toBeInTheDocument()
})

test('no match says so and Otra partida closes the game', async () => {
  await renderGame(['a', 'b', 'c'].flatMap((id) => [v('u1', id, false), v('u2', id, true)]))
  expect(screen.getByText('No hubo match esta vez')).toBeInTheDocument()
  await act(async () => press('Otra partida'))
  expect(api.finishBumble).toHaveBeenCalledWith('s1', null)
})

test('Deshacer removes my last vote and Terminar cancels', async () => {
  await renderGame([v('u1', 'a', true)])
  expect(cardTitle()).toBe('Peli B')
  api.loadOpenBumble.mockResolvedValue(game([]))
  await act(async () => press('↩️ Deshacer'))
  expect(api.bumbleUndo).toHaveBeenCalledWith('s1')
  expect(cardTitle()).toBe('Peli A')
  expect(screen.queryByRole('button', { name: '↩️ Deshacer' })).not.toBeInTheDocument()
  await act(async () => press('Terminar'))
  expect(api.finishBumble).toHaveBeenCalledWith('s1', null)
})

test('still tied, the roulette decides the same winner on both phones', async () => {
  const r1 = ['a', 'b', 'c'].flatMap((id) => [v('u1', id, true), v('u2', id, true)])
  const r2 = ['a', 'b', 'c'].flatMap((id) => [v('u1', id, id === 'a', 2), v('u2', id, id === 'b', 2)])
  await renderGame([...r1, ...r2])
  expect(screen.getByText('Siguen empatados: decide la ruleta')).toBeInTheDocument()
  press('Girar')
  const winner = [a, b, c][seededIndex('s1:2', 3)]
  expect(screen.getByText(`¡Ganó ${winner.title}!`)).toBeInTheDocument()
})

test('a title removed from the list is skipped and does not block the end', async () => {
  const votes = ['a', 'b'].flatMap((id) => [v('u1', id, id === 'a'), v('u2', id, true)])
  await renderGame(votes, ['a', 'gone', 'b'])
  expect(screen.getByText('¡Ganó Peli A!')).toBeInTheDocument()
})

test('one phone: each one swipes the whole deck, passing the phone', async () => {
  renderBumble()
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  expect(screen.getByText('Turno de Nacho · 0 de 3')).toBeInTheDocument()
  expect(cardTitle()).toBe('Peli A')
  press('👍 Sí')
  press('👍 Sí')
  press('👎 No')
  expect(screen.getByText('Pasale el celu a Pili')).toBeInTheDocument()
  expect(screen.queryByTestId('bumble-card')).not.toBeInTheDocument()
  press('Listo, soy Pili')
  expect(screen.getByText('Turno de Pili · 0 de 3')).toBeInTheDocument()
  expect(cardTitle()).toBe('Peli A')
  press('👍 Sí')
  press('👎 No')
  press('👍 Sí')
  expect(screen.getByText('¡Ganó Peli A!')).toBeInTheDocument()
  expect(api.startBumble).not.toHaveBeenCalled()
  expect(api.bumbleVote).not.toHaveBeenCalled()
  press('Listo')
  expect(screen.getByText('¿Cuántos celulares van a usar?')).toBeInTheDocument()
})

test('one phone alone in the space calls the other one tu pareja', async () => {
  renderBumble([nacho])
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  for (let i = 0; i < 3; i++) press('👍 Sí')
  expect(screen.getByText('Pasale el celu a tu pareja')).toBeInTheDocument()
  press('Listo, soy tu pareja')
  expect(screen.getByText('Turno de tu pareja · 0 de 3')).toBeInTheDocument()
})

test('one phone: undo works in the turn and before passing the phone', async () => {
  renderBumble()
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  press('👍 Sí')
  press('↩️ Deshacer')
  expect(cardTitle()).toBe('Peli A')
  for (let i = 0; i < 3; i++) press('👍 Sí')
  press('↩️ Deshacer')
  expect(cardTitle()).toBe('Peli C')
  expect(screen.getByText('Turno de Nacho · 2 de 3')).toBeInTheDocument()
})

test('one phone: the game survives the app reloading', async () => {
  const first = renderBumble()
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  press('👍 Sí')
  first.unmount()
  renderBumble()
  expect(await screen.findByText('Turno de Nacho · 1 de 3')).toBeInTheDocument()
  expect(cardTitle()).toBe('Peli B')
})

test('one phone: several matches announce a second round', async () => {
  renderBumble()
  await screen.findByText('¿Cuántos celulares van a usar?')
  press('📱 Uno')
  for (let i = 0; i < 3; i++) press('👍 Sí')
  press('Listo, soy Pili')
  for (let i = 0; i < 3; i++) press('👍 Sí')
  expect(screen.getByText('¡3 matches! Vuelven a deslizar solo esos')).toBeInTheDocument()
  press('Seguir')
  expect(screen.getByText('Vuelta 2')).toBeInTheDocument()
  expect(screen.getByText('Turno de Nacho · 0 de 3')).toBeInTheDocument()
})
