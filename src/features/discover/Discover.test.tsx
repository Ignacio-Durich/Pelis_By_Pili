import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listTitles: vi.fn(),
  subscribeTitles: vi.fn(),
  fetchTitleDetail: vi.fn(),
  searchDetails: vi.fn(),
  invoke: vi.fn(),
  dismissTitle: vi.fn(),
  undismissTitle: vi.fn(),
}))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../titles/searchApi', () => ({ searchDetails: api.searchDetails }))
// fetchDiscover es el de verdad (para probar la memoria); solo la red y los descartes son falsos.
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: api.invoke } } }))
vi.mock('./discoverApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./discoverApi')>()),
  dismissTitle: api.dismissTitle,
  undismissTitle: api.undismissTitle,
}))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { forgetDiscover, type Discover as DiscoverData, type Recommendation } from './discoverApi'
import { Discover } from './Discover'

const rec = (tmdbId: number, title: string, extra: Partial<Recommendation> = {}): Recommendation => ({
  tmdbId,
  mediaType: 'movie',
  title,
  originalTitle: title,
  year: 2023,
  posterPath: null,
  overview: '',
  genres: [],
  ...extra,
})

const relatos = rec(1, 'Relatos salvajes')
const cines = rec(2, 'Peli en cines')
const netflix = rec(3, 'Peli en Netflix')
const serie = rec(4, 'Serie con temporada nueva', { mediaType: 'tv', newSeason: true, watchedTitleId: 't9' })

const data: DiscoverData = {
  forBoth: [relatos],
  forEach: [
    { userId: 'u1', name: 'Tomás', results: [rec(5, 'Para Tomás')] },
    { userId: 'u2', name: 'Juli', results: [rec(6, 'Para Juli')] },
  ],
  inTheaters: [cines],
  onPlatforms: [netflix, serie],
  platformNames: ['Netflix', 'Max'],
}

const watched = makeTitle({ id: 't9', tmdbId: 4, mediaType: 'tv', title: 'Serie con temporada nueva', status: 'watched', scores: [{ userId: 'u1', score: 8, note: null, updatedAt: '2026-10-07T12:00:00Z' }] })

function renderDiscover(members?: Parameters<typeof withCouple>[1]) {
  return render(withCouple(<Discover />, members))
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  forgetDiscover()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  api.listTitles.mockResolvedValue([watched])
  api.subscribeTitles.mockReturnValue(() => {})
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.searchDetails.mockResolvedValue({})
  api.invoke.mockResolvedValue({ data, error: null })
  api.dismissTitle.mockResolvedValue(undefined)
})

test('shows Para los dos first, then each member by name and Novedades', async () => {
  renderDiscover()
  expect(await screen.findByRole('heading', { name: 'Descubrir' })).toBeInTheDocument()
  const options = (await screen.findAllByRole('button')).filter((b) => b.hasAttribute('aria-pressed'))
  expect(options.map((b) => b.textContent)).toEqual(['Para los dos', 'Tomás', 'Juli', 'Novedades'])
  expect(screen.getByRole('button', { name: 'Para los dos' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Relatos salvajes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Juli' }))
  expect(screen.getByRole('button', { name: 'Juli' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Para Juli')).toBeInTheDocument()
  expect(screen.queryByText('Relatos salvajes')).not.toBeInTheDocument()
})

test('a member without scores has no option', async () => {
  api.invoke.mockResolvedValue({ data: { ...data, forEach: [data.forEach[0]] }, error: null })
  renderDiscover()
  expect(await screen.findByRole('button', { name: 'Tomás' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Juli' })).not.toBeInTheDocument()
})

test('Novedades shows En cines and En sus plataformas, with the chosen platforms under the subtitle', async () => {
  renderDiscover()
  fireEvent.click(await screen.findByRole('button', { name: 'Novedades' }))
  expect(screen.getByRole('heading', { name: 'En cines' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'En sus plataformas' })).toBeInTheDocument()
  expect(screen.getByText('Netflix · Max')).toBeInTheDocument()
  expect(screen.getByText('Peli en cines')).toBeInTheDocument()
  expect(screen.getByText('Peli en Netflix')).toBeInTheDocument()
})

test('without platforms Novedades invites to choose them in Ajustes', async () => {
  api.invoke.mockResolvedValue({ data: { ...data, onPlatforms: null, platformNames: [] }, error: null })
  renderDiscover()
  fireEvent.click(await screen.findByRole('button', { name: 'Novedades' }))
  expect(screen.getByText('Elijan sus plataformas en Ajustes para ver lo nuevo que tienen')).toBeInTheDocument()
  expect(screen.getByText('Peli en cines')).toBeInTheDocument()
})

test('nothing watched with scores shows the empty text', async () => {
  api.invoke.mockResolvedValue({ data: { ...data, forBoth: [], forEach: [] }, error: null })
  renderDiscover()
  expect(await screen.findByText('Cuando marquen títulos como vistos y les pongan puntaje, acá van a aparecer recomendaciones')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Novedades' })).not.toBeInTheDocument()
})

test('shows loading while it searches', async () => {
  api.invoke.mockReturnValue(new Promise(() => {}))
  renderDiscover()
  expect(await screen.findByText('Buscando recomendaciones…')).toBeInTheDocument()
})

test('offline does not search and says so; coming back online searches', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  renderDiscover()
  expect(await screen.findByText('Sin conexión: no se pueden buscar recomendaciones ahora.')).toBeInTheDocument()
  expect(api.invoke).not.toHaveBeenCalled()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  expect(await screen.findByText('Relatos salvajes')).toBeInTheDocument()
  expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument()
})

test('an error offers Reintentar, which asks again', async () => {
  api.invoke.mockResolvedValueOnce({ data: null, error: new Error('boom') })
  renderDiscover()
  expect(await screen.findByText('No se pudieron cargar las recomendaciones')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Relatos salvajes')).toBeInTheDocument()
  expect(api.invoke).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('No se pudieron cargar las recomendaciones')).not.toBeInTheDocument()
})

test('the same key comes from memory: coming back to the tab does not call again', async () => {
  const first = renderDiscover()
  expect(await screen.findByText('Relatos salvajes')).toBeInTheDocument()
  first.unmount()
  renderDiscover()
  expect(await screen.findByText('Relatos salvajes')).toBeInTheDocument()
  expect(api.invoke).toHaveBeenCalledTimes(1)
})

test('dismissing in one section hides the same title in the others', async () => {
  api.invoke.mockResolvedValue({ data: { ...data, onPlatforms: [relatos, netflix] }, error: null })
  renderDiscover()
  expect(await screen.findByText('Relatos salvajes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'No me interesa' }))
  await waitFor(() => expect(api.dismissTitle).toHaveBeenCalledWith('movie', 1))
  fireEvent.click(await screen.findByRole('button', { name: 'Novedades' }))
  expect(screen.getByText('Peli en Netflix')).toBeInTheDocument()
  expect(screen.queryByText('Relatos salvajes')).not.toBeInTheDocument()
})

test('a watched series with a new season opens its detail inside Descubrir', async () => {
  renderDiscover()
  fireEvent.click(await screen.findByRole('button', { name: 'Novedades' }))
  fireEvent.click(screen.getByRole('button', { name: /Serie con temporada nueva/ }))
  expect(await screen.findByRole('button', { name: 'Volver' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Descubrir' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { name: 'Descubrir' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Novedades' })).toHaveAttribute('aria-pressed', 'true')
})
