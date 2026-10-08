import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listTitles: vi.fn(),
  removeTitle: vi.fn(),
  subscribeTitles: vi.fn(),
  addTitle: vi.fn(),
  searchTitles: vi.fn(),
  unsubscribe: vi.fn(),
  fetchTitleDetail: vi.fn(),
  listShared: vi.fn(),
  subscribeShared: vi.fn(),
}))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  listTitles: api.listTitles,
  removeTitle: api.removeTitle,
  subscribeTitles: api.subscribeTitles,
  addTitle: api.addTitle,
}))
vi.mock('./searchApi', () => ({ searchTitles: api.searchTitles }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../shared/sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/sharedApi')>()),
  listShared: api.listShared,
  subscribeShared: api.subscribeShared,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { NO_FILTERS, type Filters } from './filters'
import { TitleList } from './TitleList'
import { TitleError, type Title } from './titlesApi'

const angelito: Title = {
  id: 't1',
  tmdbId: 771,
  mediaType: 'movie',
  title: 'Mi pobre angelito',
  originalTitle: 'Home Alone',
  year: 1990,
  posterPath: '/h.jpg',
  originNote: 'un reel',
  addedBy: 'u2',
  createdAt: '2026-10-07T12:00:00Z',
  imdbRating: '7.7/10',
  rottenTomatoes: '67%',
  metacritic: null,
  tmdbRating: 7.4,
  ratingsUpdatedAt: '2026-10-07T13:00:00Z',
  status: 'to_watch',
  watchedAt: null,
  scores: [],
  runtime: null,
  genres: [],
  streaming: [],
  detailsUpdatedAt: null,
}
const sinDatos: Title = { ...angelito, id: 't2', tmdbId: 5, mediaType: 'tv', title: 'Serie rara', originalTitle: 'Serie rara', year: null, posterPath: null, originNote: null, addedBy: 'u1', imdbRating: null, rottenTomatoes: null }

let notify: () => void

beforeEach(() => {
  vi.resetAllMocks()
  api.listTitles.mockResolvedValue([])
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
  api.subscribeTitles.mockImplementation((_coupleId: string, onChange: () => void) => {
    notify = onChange
    return api.unsubscribe
  })
  api.listShared.mockResolvedValue([])
  api.subscribeShared.mockReturnValue(() => {})
})
afterEach(() => vi.restoreAllMocks())

function renderList(filters: Filters = NO_FILTERS, onFiltersChange = vi.fn()) {
  return render(withCouple(<TitleList filters={filters} onFiltersChange={onFiltersChange} />))
}

test('shows Cargando… and then the empty list', async () => {
  api.listTitles.mockReturnValueOnce(new Promise(() => {}))
  const first = renderList()
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
  first.unmount()
  renderList()
  expect(await screen.findByText('Nuestra lista está vacía')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Por ver' })).toBeInTheDocument()
})

test('shows each title with who added it, the note and the original name', async () => {
  api.listTitles.mockResolvedValue([angelito, sinDatos])
  renderList()
  expect(await screen.findByText('Mi pobre angelito')).toBeInTheDocument()
  expect(screen.getByText('La agregó Pili')).toBeInTheDocument()
  expect(screen.getByText('La agregó Nacho')).toBeInTheDocument()
  expect(screen.getByText('De dónde vino: un reel')).toBeInTheDocument()
  expect(screen.getByText('Original: Home Alone')).toBeInTheDocument()
  expect(screen.getByText('1990 · Película')).toBeInTheDocument()
  expect(screen.getByText('Serie')).toBeInTheDocument()
  expect(screen.queryByText('Original: Serie rara')).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})

test('Quitar asks for confirmation before removing', async () => {
  api.listTitles.mockResolvedValue([angelito])
  api.removeTitle.mockResolvedValue(undefined)
  const confirm = vi.spyOn(window, 'confirm')
  renderList()
  const button = await screen.findByRole('button', { name: 'Quitar Mi pobre angelito' })

  confirm.mockReturnValueOnce(false)
  fireEvent.click(button)
  expect(confirm).toHaveBeenCalledWith('¿Quitar «Mi pobre angelito» de la lista?')
  expect(api.removeTitle).not.toHaveBeenCalled()

  confirm.mockReturnValueOnce(true)
  fireEvent.click(button)
  expect(api.removeTitle).toHaveBeenCalledWith('t1')
})

test('a failed removal shows its message', async () => {
  api.listTitles.mockResolvedValue([angelito])
  api.removeTitle.mockRejectedValue(new TitleError('network'))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar Mi pobre angelito' }))
  expect(await screen.findByText('No se pudo quitar. Probá de nuevo.')).toBeInTheDocument()
})

test('reloads when the subscription reports a change and when the app comes back', async () => {
  renderList()
  await screen.findByText('Nuestra lista está vacía')
  const before = api.listTitles.mock.calls.length
  api.listTitles.mockResolvedValue([angelito])
  await act(async () => notify())
  expect(await screen.findByText('Mi pobre angelito')).toBeInTheDocument()

  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(api.listTitles.mock.calls.length).toBe(before + 2)
})

test('unsubscribes when unmounted', async () => {
  const view = renderList()
  await screen.findByText('Nuestra lista está vacía')
  view.unmount()
  expect(api.unsubscribe).toHaveBeenCalled()
})

test('a network failure offers Reintentar', async () => {
  api.listTitles.mockRejectedValueOnce(new TitleError('network')).mockResolvedValueOnce([angelito])
  renderList()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Mi pobre angelito')).toBeInTheDocument()
})

test('the + button opens Agregar', async () => {
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
  expect(screen.getByRole('heading', { name: 'Agregar' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { name: 'Por ver' })).toBeInTheDocument()
})

test('each card shows the IMDb and Rotten Tomatoes scores, or — when missing', async () => {
  api.listTitles.mockResolvedValue([angelito, sinDatos])
  renderList()
  expect(await screen.findByText('IMDb 7.7 · RT 67%')).toBeInTheDocument()
  expect(screen.getByText('IMDb — · RT —')).toBeInTheDocument()
})

test('tapping a card opens its detail and Volver returns', async () => {
  api.listTitles.mockResolvedValue([angelito])
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Ver Mi pobre angelito' }))
  expect(screen.getByRole('heading', { name: 'Mi pobre angelito' })).toBeInTheDocument()
  expect(screen.getByText('Cargando el detalle…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { name: 'Por ver' })).toBeInTheDocument()
})

test('the detail opens at the top and Volver returns to the same place in the list', async () => {
  api.listTitles.mockResolvedValue([angelito])
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
  renderList()
  const open = await screen.findByRole('button', { name: 'Ver Mi pobre angelito' })
  Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
  fireEvent.click(open)
  expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(scrollTo).toHaveBeenLastCalledWith(0, 640)
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
})

const visto = (id: string, title: string, watchedAt: string, scores: Title['scores'] = []): Title => ({
  ...angelito,
  id,
  tmdbId: Number(id.slice(1)) + 1000,
  title,
  originalTitle: title,
  status: 'watched',
  watchedAt,
  scores,
})

test('Por ver and Vistas tabs split the list, newest watched first', async () => {
  api.listTitles.mockResolvedValue([
    angelito,
    visto('t7', 'Vista antes', '2026-10-01T20:00:00Z'),
    visto('t8', 'Vista después', '2026-10-07T20:00:00Z', [{ userId: 'u1', score: 8.75, note: null, updatedAt: '' }]),
  ])
  renderList()
  expect(await screen.findByText('Mi pobre angelito')).toBeInTheDocument()
  expect(screen.queryByText('Vista antes')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Por ver' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByRole('heading', { name: 'Vistas' })).toBeInTheDocument()
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument()
  const names = screen.getAllByRole('button', { name: /^Ver / }).map((b) => b.getAttribute('aria-label'))
  expect(names).toEqual(['Ver Vista después', 'Ver Vista antes'])
  expect(screen.getByText('Vista el 7/10/2026')).toBeInTheDocument()
  expect(screen.getByText('Nacho 8,75 · Pili —')).toBeInTheDocument()
})

test('an empty Vistas says so', async () => {
  renderList()
  await screen.findByText('Nuestra lista está vacía')
  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByText('Todavía no vieron nada juntos')).toBeInTheDocument()
})

test('the open detail follows the list when it reloads', async () => {
  api.listTitles.mockResolvedValue([angelito])
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Ver Mi pobre angelito' }))
  expect(screen.getByRole('button', { name: 'Marcar como vista' })).toBeInTheDocument()
  api.listTitles.mockResolvedValue([{ ...angelito, status: 'watched', watchedAt: '2026-10-07T20:00:00Z' }])
  await act(async () => notify())
  expect(await screen.findByText('Vista el 7/10/2026')).toBeInTheDocument()
})

test('when everything was watched, Por ver says there is nothing left instead of an empty list', async () => {
  api.listTitles.mockResolvedValue([{ ...angelito, status: 'watched', watchedAt: '2026-10-07T20:00:00Z' }])
  renderList()
  expect(await screen.findByText('No queda nada por ver')).toBeInTheDocument()
  expect(screen.queryByText('Nuestra lista está vacía')).not.toBeInTheDocument()
})

test('Por ver shows the filters and only the titles that match', async () => {
  api.listTitles.mockResolvedValue([
    makeTitle({ id: 'n', tmdbId: 10, title: 'En Netflix', streaming: ['Netflix'] }),
    makeTitle({ id: 'p', tmdbId: 11, title: 'En Prime', streaming: ['Prime Video'] }),
  ])
  renderList({ ...NO_FILTERS, platforms: ['Netflix'] })
  expect(await screen.findByText('En Netflix')).toBeInTheDocument()
  expect(screen.queryByText('En Prime')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument()
})

test('when nothing matches it says so and offers to clear the filters', async () => {
  const onFiltersChange = vi.fn()
  api.listTitles.mockResolvedValue([makeTitle({ streaming: ['Prime Video'] })])
  renderList({ ...NO_FILTERS, platforms: ['Netflix'] }, onFiltersChange)
  expect(await screen.findByText('Ningún título cumple estos filtros')).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
  expect(onFiltersChange).toHaveBeenCalledWith(NO_FILTERS)
})

test('Vistas ignores the filters and has no panel', async () => {
  api.listTitles.mockResolvedValue([makeTitle({ title: 'Vista sin plataforma', status: 'watched', watchedAt: '2026-10-07T20:00:00Z' })])
  renderList({ ...NO_FILTERS, platforms: ['Netflix'] })
  await screen.findByRole('button', { name: 'Vistas' })
  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(await screen.findByText('Vista sin plataforma')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Filtros/ })).not.toBeInTheDocument()
})

test('the list says how many titles match the filters', async () => {
  api.listTitles.mockResolvedValue([
    makeTitle({ id: 'n', tmdbId: 10, title: 'En Netflix', streaming: ['Netflix'] }),
    makeTitle({ id: 'p', tmdbId: 11, title: 'En Prime', streaming: ['Prime Video'] }),
    makeTitle({ id: 'v', tmdbId: 12, title: 'Vista', streaming: ['Netflix'], status: 'watched', watchedAt: '2026-10-07T20:00:00Z' }),
  ])
  renderList({ ...NO_FILTERS, platforms: ['Netflix'] })
  expect(await screen.findByText('1 de 2 títulos cumple los filtros')).toBeInTheDocument()
})

test('Agregar in the inbox opens Agregar with the shared search', async () => {
  api.listShared.mockResolvedValue([
    { id: 'i1', url: 'https://www.instagram.com/reel/abc/', body: null, query: 'Parásitos', source: 'Instagram', sharedBy: 'u2', createdAt: '2026-10-08T12:00:00Z' },
  ])
  renderList()
  expect(await screen.findByText('📥 Compartidos (1)')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar lo compartido' }))
  expect(screen.getByRole('heading', { name: 'Agregar' })).toBeInTheDocument()
  expect(screen.getByLabelText('Buscar película o serie')).toHaveValue('Parásitos')
})
