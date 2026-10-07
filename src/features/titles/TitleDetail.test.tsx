import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchTitleDetail: vi.fn(), removeTitle: vi.fn() }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  removeTitle: api.removeTitle,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import type { TitleDetail as Detail } from './detailApi'
import { TitleDetail } from './TitleDetail'
import type { Title } from './titlesApi'

const parasitos: Title = {
  id: 't1',
  tmdbId: 496243,
  mediaType: 'movie',
  title: 'Parásitos',
  originalTitle: '기생충',
  year: 2019,
  posterPath: '/p.jpg',
  originNote: 'un reel',
  addedBy: 'u2',
  createdAt: '2026-10-07T12:00:00Z',
  imdbRating: '8.5/10',
  rottenTomatoes: '99%',
  metacritic: null,
  tmdbRating: 8.5,
  ratingsUpdatedAt: '2026-09-30T15:00:00Z',
  status: 'to_watch',
  watchedAt: null,
  scores: [],
}
const fresh: Detail = {
  overview: 'Una familia pobre se infiltra en una casa rica.',
  ratings: { imdb: '8.5/10', rottenTomatoes: '99%', metacritic: '97/100', tmdb: 8.5, updatedAt: '2026-10-07T15:00:00Z' },
  ratingsStale: false,
  providers: {
    link: 'https://www.themoviedb.org/movie/496243/watch?locale=AR',
    subscription: [{ name: 'Netflix', logoPath: '/n.jpg' }],
    rent: [{ name: 'Apple TV', logoPath: null }],
    buy: [],
    free: [],
  },
}

const onClose = vi.fn()

beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.restoreAllMocks())

function renderDetail(title: Title = parasitos) {
  render(withCouple(<TitleDetail title={title} onClose={onClose} />))
}

test('shows what is saved right away, while the detail loads', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail()
  expect(screen.getByRole('heading', { name: 'Parásitos' })).toBeInTheDocument()
  expect(screen.getByText('Original: 기생충')).toBeInTheDocument()
  expect(screen.getByText('2019 · Película')).toBeInTheDocument()
  expect(screen.getByText('La agregó Pili')).toBeInTheDocument()
  expect(screen.getByText('De dónde vino: un reel')).toBeInTheDocument()
  expect(screen.getByText('IMDb 8.5')).toBeInTheDocument()
  expect(screen.getByText('Metacritic —')).toBeInTheDocument()
  expect(screen.getByText('Actualizados el 30/9/2026')).toBeInTheDocument()
  expect(screen.getByText('Cargando el detalle…')).toBeInTheDocument()
  expect(document.querySelector('img.poster-large')?.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/p.jpg')
})

test('shows the synopsis, the four scores and their date', async () => {
  api.fetchTitleDetail.mockResolvedValue(fresh)
  renderDetail()
  expect(await screen.findByText('Una familia pobre se infiltra en una casa rica.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Sinopsis' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Puntajes' })).toBeInTheDocument()
  for (const text of ['IMDb 8.5', 'Rotten Tomatoes 99%', 'Metacritic 97', 'TMDB 8.5', 'Actualizados el 7/10/2026']) {
    expect(screen.getByText(text)).toBeInTheDocument()
  }
  expect(screen.queryByText('Cargando el detalle…')).not.toBeInTheDocument()
})

test('an empty synopsis says so and stale ratings show the notice', async () => {
  api.fetchTitleDetail.mockResolvedValue({ ...fresh, overview: '', ratingsStale: true })
  renderDetail()
  expect(await screen.findByText('Sin sinopsis')).toBeInTheDocument()
  expect(screen.getByText('Hoy no se pudieron actualizar los puntajes')).toBeInTheDocument()
})

test('shows where to watch it in Argentina, by group, with JustWatch as source', async () => {
  api.fetchTitleDetail.mockResolvedValue(fresh)
  renderDetail()
  expect(await screen.findByRole('heading', { name: 'Dónde verla en Argentina' })).toBeInTheDocument()
  expect(screen.getByText('Suscripción')).toBeInTheDocument()
  expect(screen.getByText('Alquiler')).toBeInTheDocument()
  expect(screen.queryByText('Compra')).not.toBeInTheDocument()
  expect(screen.getByAltText('Netflix')).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w92/n.jpg')
  expect(screen.getByText('Apple TV')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'Ver opciones en TMDB' })
  expect(link).toHaveAttribute('href', fresh.providers!.link)
  expect(link).toHaveAttribute('target', '_blank')
  expect(screen.getByText('Fuente: JustWatch')).toBeInTheDocument()
})

test('without providers says there is no information', async () => {
  api.fetchTitleDetail.mockResolvedValue({ ...fresh, providers: null })
  renderDetail()
  expect(await screen.findByText('Sin información de dónde verla')).toBeInTheDocument()
})

test('a failing detail keeps what is saved and offers Reintentar', async () => {
  api.fetchTitleDetail.mockRejectedValueOnce(new Error('502')).mockResolvedValueOnce(fresh)
  renderDetail()
  expect(await screen.findByText('No se pudo cargar el detalle. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('IMDb 8.5')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Metacritic 97')).toBeInTheDocument()
  expect(api.fetchTitleDetail).toHaveBeenCalledTimes(2)
})

test('Quitar confirms, removes and closes', async () => {
  api.fetchTitleDetail.mockResolvedValue(fresh)
  api.removeTitle.mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderDetail()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Quitar' })))
  expect(window.confirm).toHaveBeenCalledWith('¿Quitar «Parásitos» de la lista?')
  expect(api.removeTitle).toHaveBeenCalledWith('t1')
  expect(onClose).toHaveBeenCalled()
})

test('Volver closes', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(onClose).toHaveBeenCalled()
})

test('never shows null or undefined, even with nothing saved', async () => {
  const bare: Title = {
    ...parasitos,
    originalTitle: null,
    year: null,
    posterPath: null,
    originNote: null,
    imdbRating: null,
    rottenTomatoes: null,
    tmdbRating: null,
    ratingsUpdatedAt: null,
  }
  api.fetchTitleDetail.mockResolvedValue({
    overview: '',
    ratings: { imdb: null, rottenTomatoes: null, metacritic: null, tmdb: null, updatedAt: null },
    ratingsStale: false,
    providers: null,
  })
  renderDetail(bare)
  await screen.findByText('Sin información de dónde verla')
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})
