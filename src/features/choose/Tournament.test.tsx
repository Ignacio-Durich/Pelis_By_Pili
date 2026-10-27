import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listTitles: vi.fn(), subscribeTitles: vi.fn(), fetchTitleDetail: vi.fn() }))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { tomas, withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS } from '../titles/filters'
import { Tournament } from './Tournament'

const titles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) =>
  makeTitle({ id, tmdbId: i, title: `Peli ${id.toUpperCase()}`, year: 2000 + i, runtime: 100, genres: ['Drama'], imdbRating: '7.0/10' }),
)
const keep = () => 0.999
let notify: () => void
let now = 0

beforeEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  localStorage.clear()
  api.listTitles.mockResolvedValue(titles)
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  reducedMotion(true)
  api.subscribeTitles.mockImplementation((_id: string, onChange: () => void) => {
    notify = onChange
    return () => {}
  })
  // Cada consulta del reloj avanza un segundo: los toques del test no cuentan como doble toque.
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000))
})

afterEach(() => vi.useRealTimers())

function reducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: on }) as unknown as typeof window.matchMedia
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const pick = (...letters: string[]) => letters.forEach((l) => press(new RegExp(`^Peli ${l.toUpperCase()}`)))
const duel = () => [...document.querySelectorAll('.duel-card strong')].map((s) => s.textContent)

function renderTournament(members?: Parameters<typeof withCouple>[1]) {
  return render(withCouple(<Tournament filters={NO_FILTERS} onFiltersChange={vi.fn()} onBack={vi.fn()} random={keep} />, members))
}

async function startDuels() {
  const view = renderTournament()
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
  pick('a', 'b', 'c', 'd')
  press('Listo (4 de 4)')
  press('Listo, soy Juli')
  pick('e', 'f', 'g', 'h')
  press('Listo (4 de 4)')
  return view
}

test('the start screen needs at least two titles', async () => {
  api.listTitles.mockResolvedValue([titles[0]])
  renderTournament()
  expect(await screen.findByRole('heading', { name: 'Torneo' })).toBeInTheDocument()
  expect(screen.getByText('Elijan 4 cada uno y que se enfrenten de a dos.')).toBeInTheDocument()
  expect(screen.getByText('Hacen falta al menos 2 títulos')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled()
})

test('each one chooses 4, passing the phone; the first one choices are locked for the second', async () => {
  renderTournament()
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
  expect(screen.getByText('Turno de Tomás: elegí 4')).toBeInTheDocument()
  pick('a', 'b', 'c', 'd')
  press('Listo (4 de 4)')
  expect(screen.getByText('Pasale el celu a Juli')).toBeInTheDocument()
  press('Listo, soy Juli')
  expect(screen.getByText('Turno de Juli: elegí 4')).toBeInTheDocument()
  expect(screen.getAllByText('La eligió Tomás')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /^Peli A/ })).toBeDisabled()
  pick('e', 'f', 'g', 'h')
  press('Listo (4 de 4)')
  expect(screen.getByText('Cuartos de final · duelo 1 de 4')).toBeInTheDocument()
  expect(duel()).toEqual(['Peli A', 'Peli E'])
})

test('with 8 each the bracket starts at the round of 16', async () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => makeTitle({ id: `m${i}`, tmdbId: 100 + i, title: `Otra ${String.fromCharCode(65 + i)}` }))
  api.listTitles.mockResolvedValue(sixteen)
  renderTournament()
  await screen.findByRole('button', { name: 'Empezar' })
  expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true')
  press('8')
  expect(screen.getByText('Elijan 8 cada uno y que se enfrenten de a dos.')).toBeInTheDocument()
  press('Empezar')
  expect(screen.getByText('Turno de Tomás: elegí 8')).toBeInTheDocument()
  for (let i = 0; i < 8; i++) press(new RegExp(`^Otra ${String.fromCharCode(65 + i)}`))
  press('Listo (8 de 8)')
  press('Listo, soy Juli')
  for (let i = 8; i < 16; i++) press(new RegExp(`^Otra ${String.fromCharCode(65 + i)}`))
  press('Listo (8 de 8)')
  expect(screen.getByText('Octavos de final · duelo 1 de 8')).toBeInTheDocument()
})

test('Ver detalle opens a duel title and Volver comes back to the same duel', async () => {
  await startDuels()
  press('Ver detalle de Peli E')
  expect(screen.getByRole('heading', { name: 'Peli E' })).toBeInTheDocument()
  press('Volver')
  expect(screen.getByText('Cuartos de final · duelo 1 de 4')).toBeInTheDocument()
  expect(duel()).toEqual(['Peli A', 'Peli E'])
})

test('Que decida la suerte picks one of the two and moves on', async () => {
  await startDuels()
  // Con random casi 1 gana la segunda: Peli E.
  press('Que decida la suerte')
  expect(screen.getByText('Cuartos de final · duelo 2 de 4')).toBeInTheDocument()
  for (const card of ['B', 'C', 'D']) press(new RegExp(`^Peli ${card}`))
  expect(duel()).toEqual(['Peli E', 'Peli B'])
})

test('with motion the border goes back and forth, then stays on the winner and moves on', async () => {
  reducedMotion(false)
  await startDuels()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  press('Que decida la suerte')
  expect(screen.getByRole('button', { name: /^Peli A/ })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Que decida la suerte' })).toBeDisabled()
  const lit = () => document.querySelector('.duel-card.lit strong')?.textContent
  const seen = new Set<string | undefined>()
  for (let i = 0; i < 20; i++) {
    act(() => vi.advanceTimersByTime(150))
    seen.add(lit())
  }
  expect(seen).toEqual(new Set(['Peli A', 'Peli E']))
  act(() => vi.advanceTimersByTime(10_000))
  expect(screen.getByText('Cuartos de final · duelo 2 de 4')).toBeInTheDocument()
  press('Deshacer')
  expect(duel()).toEqual(['Peli A', 'Peli E'])
})

test('a duel card shows the title data', async () => {
  await startDuels()
  const card = screen.getByRole('button', { name: /^Peli A/ })
  expect(card).toHaveTextContent('2000 · Película · 1 h 40')
  expect(card).toHaveTextContent('Drama')
  expect(card).toHaveTextContent('IMDb 7.0')
  expect(card).not.toHaveTextContent('RT')
})

test('tapping a card moves on; a double tap decides one duel only', async () => {
  await startDuels()
  vi.spyOn(Date, 'now').mockReturnValue(50_000)
  press(/^Peli A/)
  expect(screen.getByText('Cuartos de final · duelo 2 de 4')).toBeInTheDocument()
  fireEvent.click(document.querySelector('.duel-card')!)
  expect(screen.getByText('Cuartos de final · duelo 2 de 4')).toBeInTheDocument()
})

test('Deshacer goes back to the previous duel', async () => {
  await startDuels()
  expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
  press(/^Peli E/)
  press('Deshacer')
  expect(screen.getByText('Cuartos de final · duelo 1 de 4')).toBeInTheDocument()
})

test('three rounds leave one winner, and Listo goes back to the start', async () => {
  await startDuels()
  for (const card of ['A', 'B', 'C', 'D']) press(new RegExp(`^Peli ${card}`))
  expect(screen.getByText('Semifinal · duelo 1 de 2')).toBeInTheDocument()
  press(/^Peli A/)
  press(/^Peli C/)
  expect(screen.getByText('Final · duelo 1 de 1')).toBeInTheDocument()
  press(/^Peli C/)
  expect(screen.getByText('¡Ganó Peli C!')).toBeInTheDocument()
  // La carta ganadora no es un botón (VoiceOver no dice "botón atenuado").
  expect(screen.queryByRole('button', { name: /^Peli C/ })).not.toBeInTheDocument()
  press('Listo')
  expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument()
})

test('with a short list there are holes and it still ends', async () => {
  api.listTitles.mockResolvedValue(titles.slice(0, 3))
  renderTournament([tomas])
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
  pick('a', 'b', 'c')
  press('Listo (3 de 3)')
  expect(screen.getByText('Pasale el celu a tu pareja')).toBeInTheDocument()
  press('Listo, soy tu pareja')
  press('Listo (0 de 0)')
  expect(screen.getByText('Semifinal · duelo 1 de 1')).toBeInTheDocument()
  press(/^Peli A/)
  press(/^Peli C/)
  expect(screen.getByText('¡Ganó Peli C!')).toBeInTheDocument()
})

test('a title marked as watched in the middle becomes a hole', async () => {
  await startDuels()
  api.listTitles.mockResolvedValue(titles.map((t) => (t.id === 'e' ? { ...t, status: 'watched' as const, watchedAt: '2026-10-08T20:00:00Z' } : t)))
  await act(async () => notify())
  expect(screen.getByText('Cuartos de final · duelo 1 de 3')).toBeInTheDocument()
  expect(duel()).toEqual(['Peli B', 'Peli F'])
})

test('the tournament survives the app reloading', async () => {
  const view = await startDuels()
  press(/^Peli A/)
  view.unmount()
  renderTournament()
  expect(await screen.findByText('Cuartos de final · duelo 2 de 4')).toBeInTheDocument()
  expect(duel()).toEqual(['Peli B', 'Peli F'])
})

test('while the list loads after a reload it says Cargando…, never that nothing is left', async () => {
  const view = await startDuels()
  view.unmount()
  // Sin lista guardada en el celular (con lista, el duelo aparece enseguida).
  localStorage.removeItem('pelis-cache:titles')
  api.listTitles.mockReturnValue(new Promise(() => {}))
  renderTournament()
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
  expect(screen.queryByText('No quedó ninguna candidata en la lista')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
})

test('a double tap on the final card does not hit Listo or Deshacer', async () => {
  await startDuels()
  for (const card of ['A', 'B', 'C', 'D', 'A', 'C']) press(new RegExp(`^Peli ${card}`))
  expect(screen.getByText('Final · duelo 1 de 1')).toBeInTheDocument()
  vi.spyOn(Date, 'now').mockReturnValue(900_000)
  press(/^Peli C/)
  press('Listo')
  press('Deshacer')
  expect(screen.getByText('¡Ganó Peli C!')).toBeInTheDocument()
})
