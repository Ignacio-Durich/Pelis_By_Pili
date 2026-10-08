import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listTitles: vi.fn(), subscribeTitles: vi.fn(), fetchTitleDetail: vi.fn() }))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('./bumbleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bumbleApi')>()),
  loadOpenBumble: () => Promise.resolve(null),
  subscribeBumble: () => () => {},
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS } from '../titles/filters'
import { ChooseMenu } from './ChooseMenu'

beforeEach(() => {
  vi.resetAllMocks()
  api.listTitles.mockResolvedValue([])
  api.subscribeTitles.mockReturnValue(() => {})
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
})

function renderMenu() {
  render(withCouple(<ChooseMenu filters={NO_FILTERS} onFiltersChange={vi.fn()} />))
}

test('shows the three modes with their help texts, Bumble first', () => {
  renderMenu()
  expect(screen.getByRole('heading', { name: '¿Qué vemos?' })).toBeInTheDocument()
  const modes = screen.getAllByRole('button')
  expect(modes[0]).toHaveTextContent('Bumble')
  expect(modes[0]).toHaveTextContent('Deslicen y gana la que les guste a los dos')
  expect(screen.getByRole('button', { name: /Ruleta/ })).toHaveTextContent('Gira entre los títulos que cumplen los filtros')
  expect(screen.getByRole('button', { name: /Preguntas rápidas/ })).toHaveTextContent('Respondan tres preguntas y les sugerimos 5')
})

test('each mode opens and Volver a los modos returns to the menu', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /Bumble/ }))
  expect(await screen.findByRole('heading', { name: 'Bumble' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los modos' }))
  fireEvent.click(screen.getByRole('button', { name: /Ruleta/ }))
  expect(await screen.findByRole('heading', { name: 'Ruleta' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los modos' }))
  fireEvent.click(screen.getByRole('button', { name: /Preguntas rápidas/ }))
  expect(await screen.findByRole('heading', { name: 'Preguntas rápidas' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los modos' }))
  expect(screen.getByRole('heading', { name: '¿Qué vemos?' })).toBeInTheDocument()
})

test('with a detail open there is only the detail Volver, and the answers stay', async () => {
  api.listTitles.mockResolvedValue([makeTitle({ id: 'x', title: 'Una', genres: ['Terror'] })])
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /Preguntas rápidas/ }))
  fireEvent.click(await screen.findByRole('button', { name: '👻 Miedo' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle de Una' }))
  expect(screen.queryByRole('button', { name: 'Volver a los modos' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('button', { name: '👻 Miedo' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Volver a los modos' })).toBeInTheDocument()
})
