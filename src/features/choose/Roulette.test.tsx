import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listTitles: vi.fn(), subscribeTitles: vi.fn(), fetchTitleDetail: vi.fn() }))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { nacho, withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS, type Filters } from '../titles/filters'
import { Roulette } from './Roulette'

const a = makeTitle({ id: 'a', tmdbId: 1, title: 'Primera', streaming: ['Netflix'] })
const b = makeTitle({ id: 'b', tmdbId: 2, title: 'Segunda', streaming: ['Netflix'] })
const c = makeTitle({ id: 'c', tmdbId: 3, title: 'Tercera', streaming: ['Prime Video'] })
const watched = makeTitle({ id: 'w', tmdbId: 4, title: 'Ya vista', status: 'watched', watchedAt: '2026-10-07T20:00:00Z' })

let notify: () => void
const first = () => 0

function reducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  vi.resetAllMocks()
  reducedMotion(true)
  api.listTitles.mockResolvedValue([a, b, c, watched])
  api.subscribeTitles.mockImplementation((_id: string, onChange: () => void) => {
    notify = onChange
    return () => {}
  })
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
})
afterEach(() => vi.useRealTimers())

function Harness({ initial = NO_FILTERS }: { initial?: Filters }) {
  const [filters, setFilters] = useState(initial)
  return <Roulette filters={filters} onFiltersChange={setFilters} random={first} />
}

function renderRoulette(initial?: Filters, members?: Parameters<typeof withCouple>[1]) {
  return render(withCouple(<Harness initial={initial} />, members))
}

const spin = () => fireEvent.click(screen.getByRole('button', { name: 'Girar' }))
const resultName = () => screen.getByTestId('roulette-result').querySelector('strong')?.textContent

test('shows how many titles match and lets you spin', async () => {
  renderRoulette()
  expect(screen.getByRole('heading', { name: 'Ruleta' })).toBeInTheDocument()
  expect(await screen.findByText('Hay 3 títulos que cumplen los filtros')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Filtros/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Girar' })).toBeEnabled()
})

test('one match is said in singular, and no match disables Girar', async () => {
  const { unmount } = renderRoulette({ ...NO_FILTERS, platforms: ['Prime Video'] })
  expect(await screen.findByText('Hay 1 título que cumple los filtros')).toBeInTheDocument()
  unmount()
  renderRoulette({ ...NO_FILTERS, platforms: ['Disney Plus'] })
  expect(await screen.findByText('Ningún título cumple estos filtros')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Girar' })).toBeDisabled()
})

test('spinning shows a result that matches the filters, with a veto button per person', async () => {
  renderRoulette({ ...NO_FILTERS, platforms: ['Netflix'] })
  await screen.findByText('Hay 2 títulos que cumplen los filtros')
  spin()
  expect(screen.getByRole('heading', { name: 'Les tocó' })).toBeInTheDocument()
  expect(resultName()).toBe('Primera')
  expect(screen.queryByRole('button', { name: 'Girar' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Veto de Nacho' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Veto de Pili' })).toBeEnabled()
})

test('with one member there is one veto button', async () => {
  renderRoulette(NO_FILTERS, [nacho])
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  expect(screen.getAllByRole('button', { name: /^Veto de/ })).toHaveLength(1)
})

test('each person vetoes once, the vetoed title never returns, and then the result is final', async () => {
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Nacho' }))
  expect(resultName()).toBe('Segunda')
  expect(screen.getByRole('button', { name: 'Nacho ya vetó' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Pili' }))
  expect(resultName()).toBe('Tercera')
  expect(screen.getByRole('button', { name: 'Pili ya vetó' })).toBeDisabled()
  expect(screen.getByText('No quedan vetos: ¡a ver esta!')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Girar' })).not.toBeInTheDocument()
})

test('a veto that leaves no candidates says so', async () => {
  renderRoulette({ ...NO_FILTERS, platforms: ['Prime Video'] })
  await screen.findByText('Hay 1 título que cumple los filtros')
  spin()
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Nacho' }))
  expect(screen.getByText('No quedan títulos con estos filtros')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Les tocó' })).not.toBeInTheDocument()
})

test('changing a filter starts a new session', async () => {
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Nacho' }))
  fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Películas' }))
  expect(screen.queryByRole('heading', { name: 'Les tocó' })).not.toBeInTheDocument()
  spin()
  expect(screen.getByRole('button', { name: 'Veto de Nacho' })).toBeEnabled()
})

test('if the partner removes the result, it is cleared without spending vetoes', async () => {
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Nacho' }))
  expect(resultName()).toBe('Segunda')
  api.listTitles.mockResolvedValue([a, c, watched])
  await act(async () => notify())
  expect(screen.getByText('Ese título ya no está en Por ver. Giren de nuevo.')).toBeInTheDocument()
  spin()
  expect(resultName()).toBe('Tercera')
  expect(screen.getByRole('button', { name: 'Nacho ya vetó' })).toBeDisabled()
})

test('Ver detalle opens the detail and Volver comes back to the same result', async () => {
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(screen.getByRole('heading', { name: 'Primera' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(resultName()).toBe('Primera')
})

test('the wheel is there from the start with the candidates', async () => {
  renderRoulette({ ...NO_FILTERS, platforms: ['Netflix'] })
  expect(await screen.findByRole('img', { name: 'Ruleta con 2 títulos' })).toBeInTheDocument()
})

test('without reduced motion the wheel spins and the result appears when it stops', async () => {
  reducedMotion(false)
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  expect(screen.getByText('Girando…')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Les tocó' })).not.toBeInTheDocument()
  const rotor = screen.getByTestId('wheel-rotor')
  expect(rotor.style.transform).not.toBe('rotate(0deg)')
  fireEvent.transitionEnd(rotor)
  expect(screen.getByRole('heading', { name: 'Les tocó' })).toBeInTheDocument()
  expect(resultName()).toBe('Primera')
})

test('if the wheel never reports the end, the result still appears', async () => {
  reducedMotion(false)
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  vi.useFakeTimers()
  spin()
  await act(async () => vi.advanceTimersByTime(4500))
  expect(screen.getByRole('heading', { name: 'Les tocó' })).toBeInTheDocument()
})

test('vetoing spins the same wheel again, animated', async () => {
  reducedMotion(false)
  renderRoulette()
  await screen.findByText('Hay 3 títulos que cumplen los filtros')
  spin()
  const rotor = screen.getByTestId('wheel-rotor')
  fireEvent.transitionEnd(rotor)
  const landed = rotor.style.transform
  fireEvent.click(screen.getByRole('button', { name: 'Veto de Nacho' }))
  expect(screen.getByText('Girando…')).toBeInTheDocument()
  // La misma rueda (no una nueva): si se recreara, aparecería ya en su posición final, sin animar.
  expect(screen.getByTestId('wheel-rotor')).toBe(rotor)
  expect(rotor.style.transform).not.toBe(landed)
  expect(rotor.style.transition).toContain('4s')
  fireEvent.transitionEnd(rotor)
  expect(resultName()).toBe('Segunda')
})

test('the roulette filters say how many titles match', async () => {
  renderRoulette({ ...NO_FILTERS, platforms: ['Netflix'] })
  expect(await screen.findByText('2 de 3 títulos cumplen los filtros')).toBeInTheDocument()
})
