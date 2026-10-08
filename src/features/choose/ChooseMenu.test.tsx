import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listTitles: vi.fn(), subscribeTitles: vi.fn() }))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: vi.fn().mockReturnValue(new Promise(() => {})) }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { NO_FILTERS } from '../titles/filters'
import { ChooseMenu } from './ChooseMenu'

beforeEach(() => {
  vi.resetAllMocks()
  api.listTitles.mockResolvedValue([])
  api.subscribeTitles.mockReturnValue(() => {})
})

function renderMenu() {
  render(withCouple(<ChooseMenu filters={NO_FILTERS} onFiltersChange={vi.fn()} />))
}

test('shows the two modes with their help texts', () => {
  renderMenu()
  expect(screen.getByRole('heading', { name: '¿Qué vemos?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ruleta/ })).toHaveTextContent('Gira entre los títulos que cumplen los filtros')
  expect(screen.getByRole('button', { name: /Preguntas rápidas/ })).toHaveTextContent('Respondan tres preguntas y les sugerimos 5')
})

test('each mode opens and Volver a los modos returns to the menu', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /Ruleta/ }))
  expect(await screen.findByRole('heading', { name: 'Ruleta' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los modos' }))
  fireEvent.click(screen.getByRole('button', { name: /Preguntas rápidas/ }))
  expect(await screen.findByRole('heading', { name: 'Preguntas rápidas' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los modos' }))
  expect(screen.getByRole('heading', { name: '¿Qué vemos?' })).toBeInTheDocument()
})
