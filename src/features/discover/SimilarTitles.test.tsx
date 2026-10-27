import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  addTitle: vi.fn(),
  removeTitle: vi.fn(),
  searchDetails: vi.fn(),
  fetchTitleDetail: vi.fn(),
  fetchSimilar: vi.fn(),
}))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  addTitle: api.addTitle,
  removeTitle: api.removeTitle,
}))
vi.mock('../titles/searchApi', () => ({ searchDetails: api.searchDetails }))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('./discoverApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./discoverApi')>()),
  fetchSimilar: api.fetchSimilar,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import type { Recommendation } from './discoverApi'
import { SimilarTitles } from './SimilarTitles'

const origen = makeTitle({ id: 't7', tmdbId: 99, title: 'El origen', status: 'watched' })
const rec = (tmdbId: number, title: string): Recommendation => ({
  tmdbId,
  mediaType: 'movie',
  title,
  originalTitle: title,
  year: 2010,
  posterPath: null,
  overview: '',
  genres: [],
})

function renderSimilar(titles = [origen]) {
  render(withCouple(<SimilarTitles title={origen} titles={titles} />))
}

beforeEach(() => {
  vi.resetAllMocks()
  api.searchDetails.mockResolvedValue({})
  api.addTitle.mockResolvedValue('new1')
  api.removeTitle.mockResolvedValue(undefined)
})

test('asks for the similar ones of the title and shows them under Parecidas a esta', async () => {
  api.fetchSimilar.mockResolvedValue({ results: [rec(1, 'Interestelar')], more: [] })
  renderSimilar()
  expect(screen.getByRole('heading', { name: 'Parecidas a esta' })).toBeInTheDocument()
  expect(screen.getByText('Buscando parecidas…')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Interestelar/ })).toBeInTheDocument()
  expect(api.fetchSimilar).toHaveBeenCalledWith('t7')
})

test('adding from Parecidas a esta uses the origin note Parecida a <título>', async () => {
  const interestelar = rec(1, 'Interestelar')
  api.fetchSimilar.mockResolvedValue({ results: [interestelar], more: [] })
  renderSimilar()
  fireEvent.click(await screen.findByRole('button', { name: /Interestelar/ }))
  await waitFor(() => expect(api.addTitle).toHaveBeenCalledWith('c1', interestelar, 'Parecida a El origen'))
})

test('says so when TMDB has no similar ones', async () => {
  api.fetchSimilar.mockResolvedValue({ results: [], more: [] })
  renderSimilar()
  expect(await screen.findByText('TMDB no tiene parecidas para este título')).toBeInTheDocument()
})

test('if it fails it says so with Reintentar, which asks again', async () => {
  api.fetchSimilar.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ results: [rec(1, 'Interestelar')], more: [] })
  renderSimilar()
  expect(await screen.findByText('No se pudieron cargar las parecidas')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('button', { name: /Interestelar/ })).toBeInTheDocument()
  expect(api.fetchSimilar).toHaveBeenCalledTimes(2)
})

test('offline it asks for nothing and says so; coming back online it fetches', async () => {
  api.fetchSimilar.mockResolvedValue({ results: [rec(1, 'Interestelar')], more: [] })
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  renderSimilar()
  expect(screen.getByText('Sin conexión: no se pueden buscar parecidas ahora.')).toBeInTheDocument()
  expect(api.fetchSimilar).not.toHaveBeenCalled()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  expect(await screen.findByRole('button', { name: /Interestelar/ })).toBeInTheDocument()
  expect(api.fetchSimilar).toHaveBeenCalledWith('t7')
  expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument()
})

test('the origin note is trimmed to 200 characters for a very long title', async () => {
  const interestelar = rec(1, 'Interestelar')
  api.fetchSimilar.mockResolvedValue({ results: [interestelar], more: [] })
  render(withCouple(<SimilarTitles title={{ ...origen, title: 'Juli '.repeat(100) }} titles={[origen]} />))
  fireEvent.click(await screen.findByRole('button', { name: /Interestelar/ }))
  await waitFor(() => expect(api.addTitle).toHaveBeenCalled())
  const note = api.addTitle.mock.calls[0][2] as string
  expect(note).toHaveLength(200)
  expect(note.startsWith('Parecida a Juli')).toBe(true)
})

test('shows Más de <director> and Con <actor> as their own parts, each adding with its own origin note', async () => {
  const oppenheimer = rec(2, 'Oppenheimer')
  const titanic = rec(3, 'Titanic')
  api.fetchSimilar.mockResolvedValue({
    results: [rec(1, 'Interestelar')],
    more: [
      { kind: 'director', name: 'Christopher Nolan', results: [oppenheimer] },
      { kind: 'cast', name: 'Leonardo DiCaprio', results: [titanic] },
    ],
  })
  renderSimilar()
  expect(await screen.findByRole('heading', { name: 'Más de Christopher Nolan' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Con Leonardo DiCaprio' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Oppenheimer/ }))
  await waitFor(() => expect(api.addTitle).toHaveBeenCalledWith('c1', oppenheimer, 'Más de Christopher Nolan'))
  fireEvent.click(screen.getByRole('button', { name: /Titanic/ }))
  await waitFor(() => expect(api.addTitle).toHaveBeenCalledWith('c1', titanic, 'Con Leonardo DiCaprio'))
})

test('without similar ones from TMDB the parts by person still show', async () => {
  api.fetchSimilar.mockResolvedValue({ results: [], more: [{ kind: 'director', name: 'Christopher Nolan', results: [rec(2, 'Oppenheimer')] }] })
  renderSimilar()
  expect(await screen.findByText('TMDB no tiene parecidas para este título')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Oppenheimer/ })).toBeInTheDocument()
})
