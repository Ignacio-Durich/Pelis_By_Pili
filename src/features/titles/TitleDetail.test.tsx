import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  fetchTitleDetail: vi.fn(),
  removeTitle: vi.fn(),
  setWatched: vi.fn(),
  setMyScore: vi.fn(),
  fetchSimilar: vi.fn(),
}))
vi.mock('../discover/discoverApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../discover/discoverApi')>()),
  fetchSimilar: api.fetchSimilar,
}))
vi.mock('./searchApi', () => ({ searchDetails: vi.fn().mockResolvedValue({}) }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  removeTitle: api.removeTitle,
  setWatched: api.setWatched,
  setMyScore: api.setMyScore,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import type { TitleDetail as Detail } from './detailApi'
import { TitleDetail } from './TitleDetail'
import { TitleError } from './titlesApi'
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
  runtime: null,
  genres: [],
  streaming: [],
  detailsUpdatedAt: null,
  director: null,
  seasons: null,
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
  trailer: 'https://www.youtube.com/watch?v=5xH0HfJHsaY',
}

const onClose = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchSimilar.mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())

const onChanged = vi.fn()

function renderDetail(title: Title = parasitos) {
  render(withCouple(<TitleDetail title={title} onClose={onClose} onChanged={onChanged} />))
}

test('shows what is saved right away, while the detail loads', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail()
  expect(screen.getByRole('heading', { name: 'Parásitos' })).toBeInTheDocument()
  expect(screen.getByText('Original: 기생충')).toBeInTheDocument()
  expect(screen.getByText('2019 · Película')).toBeInTheDocument()
  expect(screen.getByText('La agregó Juli')).toBeInTheDocument()
  expect(screen.getByText('De dónde vino: un reel')).toBeInTheDocument()
  expect(screen.getByText('IMDb 8.5')).toBeInTheDocument()
  expect(screen.getByText('Metacritic —')).toBeInTheDocument()
  expect(screen.getByText('Actualizados el 30/9/2026')).toBeInTheDocument()
  expect(screen.getByText('Cargando el detalle…')).toBeInTheDocument()
  expect(document.querySelector('img.poster-large')?.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w342/p.jpg')
})

test('shows who directed it, and for a series how many seasons', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail({ ...parasitos, mediaType: 'tv', director: 'Vince Gilligan', seasons: 5 })
  expect(screen.getByText('2019 · Serie · 5 temporadas')).toBeInTheDocument()
  expect(screen.getByText('Creada por Vince Gilligan')).toBeInTheDocument()
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

test('Ver tráiler opens the YouTube trailer, or a YouTube search when TMDB has none', async () => {
  api.fetchTitleDetail.mockResolvedValue(fresh)
  renderDetail()
  expect(await screen.findByRole('link', { name: '▶ Ver tráiler' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=5xH0HfJHsaY')
  cleanup()
  api.fetchTitleDetail.mockResolvedValue({ ...fresh, trailer: null })
  renderDetail()
  expect(await screen.findByRole('link', { name: '▶ Ver tráiler' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/results?search_query=Par%C3%A1sitos%202019%20tr%C3%A1iler',
  )
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
    trailer: null,
  })
  renderDetail(bare)
  await screen.findByText('Sin información de dónde verla')
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})

test('a title to watch offers Marcar como vista and explains how to score', async () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.setWatched.mockResolvedValue(undefined)
  renderDetail()
  expect(screen.getByText('Márquenla como vista para puntuarla.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Tu puntaje' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Marcar como vista' })))
  expect(api.setWatched).toHaveBeenCalledWith('t1', true)
})

const watched: Title = {
  ...parasitos,
  status: 'watched',
  watchedAt: '2026-10-07T20:00:00Z',
  scores: [{ userId: 'u2', score: 6.5, note: 'Muy buena', updatedAt: '2026-10-07T21:00:00Z' }],
}

test('a watched title shows the date, both scores and my score editor', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail(watched)
  expect(screen.getByText('Vista el 7/10/2026')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Nuestros puntajes' })).toBeInTheDocument()
  expect(screen.getByText('Tomás: todavía no puntuó')).toBeInTheDocument()
  expect(screen.getByText('Juli: 6,5')).toBeInTheDocument()
  expect(screen.getByText('Muy buena')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Tu puntaje' })).toBeInTheDocument()
  expect(screen.queryByText('Márquenla como vista para puntuarla.')).not.toBeInTheDocument()
})

test('my score editor starts with my own score', () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  renderDetail({ ...watched, scores: [...watched.scores, { userId: 'u1', score: 9, note: null, updatedAt: '' }] })
  expect(screen.getByText('Tomás: 9')).toBeInTheDocument()
  expect(screen.getByLabelText('Del 1 al 10')).toHaveValue('9')
})

test('Volver a Por ver unmarks, and a failure says so', async () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  // Un error con motivo se muestra; uno de red queda pendiente (test de TitleList).
  api.setWatched.mockRejectedValueOnce(new TitleError('not_found'))
  renderDetail(watched)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Volver a Por ver' })))
  expect(api.setWatched).toHaveBeenCalledWith('t1', false)
  expect(screen.getByText('No se pudo guardar. Probá de nuevo.')).toBeInTheDocument()
})

test('a double tap on Marcar como vista sends one request, and the list is asked to reload', async () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  let finish!: () => void
  api.setWatched.mockReturnValue(new Promise<void>((r) => (finish = r)))
  renderDetail()
  const button = screen.getByRole('button', { name: 'Marcar como vista' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(api.setWatched).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  expect(onChanged).toHaveBeenCalled()
})

test('removing from the detail asks the list to reload', async () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.removeTitle.mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderDetail()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Quitar' })))
  expect(onClose).toHaveBeenCalled()
  expect(onChanged).toHaveBeenCalled()
})

test('Reintentar shows Cargando el detalle… while it retries', async () => {
  api.fetchTitleDetail.mockRejectedValueOnce(new Error('network')).mockReturnValue(new Promise(() => {}))
  renderDetail()
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  expect(screen.getByText('Cargando el detalle…')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
})

test('a watched title shows Parecidas a esta, a to-watch one does not ask for it', async () => {
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.fetchSimilar.mockResolvedValue([])
  renderDetail()
  expect(screen.queryByRole('heading', { name: 'Parecidas a esta' })).not.toBeInTheDocument()
  expect(api.fetchSimilar).not.toHaveBeenCalled()
  cleanup()
  renderDetail({ ...parasitos, status: 'watched', watchedAt: '2026-10-07T12:00:00Z' })
  expect(screen.getByRole('heading', { name: 'Parecidas a esta' })).toBeInTheDocument()
  await waitFor(() => expect(api.fetchSimilar).toHaveBeenCalledWith('t1'))
})
