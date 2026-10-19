import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  api.fetchSimilar.mockResolvedValue([rec(1, 'Interestelar')])
  renderSimilar()
  expect(screen.getByRole('heading', { name: 'Parecidas a esta' })).toBeInTheDocument()
  expect(screen.getByText('Buscando parecidas…')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Interestelar/ })).toBeInTheDocument()
  expect(api.fetchSimilar).toHaveBeenCalledWith('t7')
})

test('adding from Parecidas a esta uses the origin note Parecida a <título>', async () => {
  const interestelar = rec(1, 'Interestelar')
  api.fetchSimilar.mockResolvedValue([interestelar])
  renderSimilar()
  fireEvent.click(await screen.findByRole('button', { name: /Interestelar/ }))
  await waitFor(() => expect(api.addTitle).toHaveBeenCalledWith('c1', interestelar, 'Parecida a El origen'))
})

test('says so when TMDB has no similar ones', async () => {
  api.fetchSimilar.mockResolvedValue([])
  renderSimilar()
  expect(await screen.findByText('TMDB no tiene parecidas para este título')).toBeInTheDocument()
})

test('if it fails it says so with Reintentar, which asks again', async () => {
  api.fetchSimilar.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([rec(1, 'Interestelar')])
  renderSimilar()
  expect(await screen.findByText('No se pudieron cargar las parecidas')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('button', { name: /Interestelar/ })).toBeInTheDocument()
  expect(api.fetchSimilar).toHaveBeenCalledTimes(2)
})
