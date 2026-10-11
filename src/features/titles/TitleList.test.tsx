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
  setWatched: vi.fn(),
  setMyScore: vi.fn(),
  addSharedItem: vi.fn(),
}))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  listTitles: api.listTitles,
  removeTitle: api.removeTitle,
  subscribeTitles: api.subscribeTitles,
  addTitle: api.addTitle,
  setWatched: api.setWatched,
  setMyScore: api.setMyScore,
}))
vi.mock('./searchApi', () => ({ searchTitles: api.searchTitles }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../shared/sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/sharedApi')>()),
  listShared: api.listShared,
  subscribeShared: api.subscribeShared,
  addSharedItem: api.addSharedItem,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { clearDropped, enqueue, flushPending, pendingFor, saveCache } from '../../lib/offline'
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
  director: null,
  seasons: null,
}
const sinDatos: Title = { ...angelito, id: 't2', tmdbId: 5, mediaType: 'tv', title: 'Serie rara', originalTitle: 'Serie rara', year: null, posterPath: null, originNote: null, addedBy: 'u1', imdbRating: null, rottenTomatoes: null }

let notify: () => void

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  clearDropped('u1:c1')
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
  expect(screen.getByText('La agregó Juli')).toBeInTheDocument()
  expect(screen.getByText('La agregó Tomás')).toBeInTheDocument()
  expect(screen.getByText('De dónde vino: un reel')).toBeInTheDocument()
  expect(screen.getByText('Original: Home Alone')).toBeInTheDocument()
  expect(screen.getByText('1990 · Película')).toBeInTheDocument()
  expect(screen.getByText('Serie')).toBeInTheDocument()
  expect(screen.queryByText('Original: Serie rara')).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})

test('the card shows who directed it, and for a series how many seasons', async () => {
  api.listTitles.mockResolvedValue([
    { ...angelito, director: 'Chris Columbus' },
    { ...sinDatos, year: 2008, director: 'Vince Gilligan', seasons: 5 },
    { ...sinDatos, id: 't3', tmdbId: 6, title: 'Miniserie', year: 2020, seasons: 1 },
  ])
  renderList()
  expect(await screen.findByText('Dirigida por Chris Columbus')).toBeInTheDocument()
  expect(screen.getByText('2008 · Serie · 5 temporadas')).toBeInTheDocument()
  expect(screen.getByText('Creada por Vince Gilligan')).toBeInTheDocument()
  expect(screen.getByText('2020 · Serie · 1 temporada')).toBeInTheDocument()
})

test('in Por ver the card shows how long it lasts, and Vistas does not', async () => {
  api.listTitles.mockResolvedValue([
    { ...angelito, runtime: 103 },
    { ...visto('t7', 'Vista antes', '2026-10-01T20:00:00Z'), year: 2001, runtime: 90 },
  ])
  renderList()
  expect(await screen.findByText('1990 · Película · 1 h 43')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByText('2001 · Película')).toBeInTheDocument()
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
  fireEvent.click(await screen.findByRole('button', { name: /^Ver Mi pobre angelito/ }))
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
  const open = await screen.findByRole('button', { name: /^Ver Mi pobre angelito/ })
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
  const names = [...document.querySelectorAll('.title-list strong')].map((n) => n.textContent)
  expect(names).toEqual(['Vista después', 'Vista antes'])
  expect(screen.getByText('Vista el 7/10/2026')).toBeInTheDocument()
  expect(screen.getByText('Tomás 8,75 · Juli —')).toBeInTheDocument()
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
  fireEvent.click(await screen.findByRole('button', { name: /^Ver Mi pobre angelito/ }))
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

const toWatch: Title = { ...sinDatos, id: 't3', title: 'Una por ver', status: 'to_watch', watchedAt: null, scores: [] }

async function goOffline() {
  api.listTitles.mockResolvedValue([angelito, toWatch])
  const view = renderList()
  await screen.findByText('Una por ver')
  view.unmount()
  api.listTitles.mockRejectedValue(new TitleError('network'))
  renderList()
  await screen.findByText('Una por ver')
}

test('without connection it shows the saved list and says changes wait', async () => {
  await goOffline()
  expect(screen.getByText('Sin conexión. Lo que hagas se guarda cuando vuelva la conexión')).toBeInTheDocument()
  expect(screen.queryByText('Sin conexión. Probá de nuevo.')).not.toBeInTheDocument()
})

test('a list saved for another couple is not shown', async () => {
  saveCache('titles', 'c9', [toWatch])
  api.listTitles.mockRejectedValue(new TitleError('network'))
  renderList()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.queryByText('Una por ver')).not.toBeInTheDocument()
})

test('marking as watched offline moves it to Vistas with ⏳, and it is sent when the connection is back', async () => {
  await goOffline()
  api.setWatched.mockRejectedValue(new TitleError('network'))
  fireEvent.click(screen.getByRole('button', { name: /^Ver Una por ver/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Marcar como vista' })))
  expect(screen.getByText('⏳ Se guarda cuando vuelva la conexión')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByText(/1 pendiente/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByRole('button', { name: /^Ver Una por ver/ })).toHaveTextContent('⏳')

  api.setWatched.mockResolvedValue(undefined)
  api.listTitles.mockResolvedValue([angelito, { ...toWatch, status: 'watched', watchedAt: '2026-10-08T21:00:00Z' }])
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(api.setWatched).toHaveBeenLastCalledWith('t3', true)
  expect(pendingFor('u1:c1')).toEqual([])
  expect(screen.queryByText(/pendiente/)).not.toBeInTheDocument()
  expect(screen.queryByText('Sin conexión. Lo que hagas se guarda cuando vuelva la conexión')).not.toBeInTheDocument()
})

test('watched and score made offline are sent in that order', async () => {
  enqueue('u1:c1', { kind: 'watched', titleId: 't3', watched: true })
  enqueue('u1:c1', { kind: 'score', titleId: 't3', score: 9, note: '' })
  const order: string[] = []
  api.setWatched.mockImplementation(async () => void order.push('watched'))
  api.setMyScore.mockImplementation(async () => void order.push('score'))
  api.listTitles.mockResolvedValue([toWatch])
  renderList()
  await act(async () => {})
  expect(order).toEqual(['watched', 'score'])
})

test('a change that no longer applies is dropped with a notice', async () => {
  enqueue('u1:c1', { kind: 'watched', titleId: 'gone', watched: true })
  api.setWatched.mockRejectedValue(new TitleError('not_found'))
  api.listTitles.mockResolvedValue([toWatch])
  renderList()
  expect(await screen.findByText('No se pudo guardar un cambio: ese título ya no está en la lista')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
  expect(screen.queryByText(/No se pudo guardar un cambio/)).not.toBeInTheDocument()
  expect(pendingFor('u1:c1')).toEqual([])
})

test('names saved for later go to Compartidos when the connection is back', async () => {
  enqueue('u1:c1', { kind: 'later', query: 'Dark', note: 'la dijo Juan' })
  api.addSharedItem.mockResolvedValue(undefined)
  api.listTitles.mockResolvedValue([toWatch])
  renderList()
  await act(async () => {})
  expect(api.addSharedItem).toHaveBeenCalledWith('Dark', 'la dijo Juan')
  expect(pendingFor('u1:c1')).toEqual([])
})

test('a saved list shows at once while the server answers (sin red tarda en rendirse)', () => {
  saveCache('titles', 'c1', [toWatch])
  api.listTitles.mockReturnValue(new Promise(() => {}))
  renderList()
  expect(screen.getByText('Una por ver')).toBeInTheDocument()
})

test('something added to the queue is tried right away, without waiting for an online event', async () => {
  api.listTitles.mockResolvedValue([toWatch])
  api.setWatched.mockResolvedValue(undefined)
  renderList()
  await screen.findByText('Una por ver')
  await act(async () => {
    enqueue('u1:c1', { kind: 'watched', titleId: 't3', watched: true })
  })
  expect(api.setWatched).toHaveBeenCalledWith('t3', true)
  expect(pendingFor('u1:c1')).toEqual([])
})

test('a change dropped while another screen was syncing is still announced in the list', async () => {
  enqueue('u1:c1', { kind: 'watched', titleId: 'gone', watched: true })
  await flushPending('u1:c1', async () => {
    throw new TitleError('not_found')
  }, () => false)
  api.listTitles.mockResolvedValue([toWatch])
  renderList()
  expect(await screen.findByText('No se pudo guardar un cambio: ese título ya no está en la lista')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
  expect(screen.queryByText(/No se pudo guardar un cambio/)).not.toBeInTheDocument()
})

test('going offline with the app open says so at once', async () => {
  api.listTitles.mockResolvedValue([toWatch])
  renderList()
  await screen.findByText('Una por ver')
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  try {
    await act(async () => window.dispatchEvent(new Event('offline')))
    expect(screen.getByText('Sin conexión. Lo que hagas se guarda cuando vuelva la conexión')).toBeInTheDocument()
  } finally {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  }
})

const nolanPorVer = makeTitle({ id: 'n1', tmdbId: 21, title: 'Interestelar', director: 'Christopher Nolan', streaming: ['Prime Video'] })
const nolanVista = makeTitle({ id: 'n2', tmdbId: 22, title: 'El origen', director: 'Christopher Nolan', status: 'watched', watchedAt: '2026-10-07T20:00:00Z' })
const otra = makeTitle({ id: 'o', tmdbId: 23, title: 'Amélie', director: 'Jean-Pierre Jeunet' })

test('the list search looks only in the open tab', async () => {
  api.listTitles.mockResolvedValue([nolanPorVer, nolanVista, otra])
  renderList()
  await screen.findByText('Interestelar')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en la lista' }), { target: { value: 'nolan' } })
  expect(screen.getByText('Interestelar')).toBeInTheDocument()
  expect(screen.queryByText('Amélie')).not.toBeInTheDocument()
  expect(screen.queryByText('El origen')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByText('El origen')).toBeInTheDocument()
  expect(screen.queryByText('Interestelar')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Buscar en la lista' })).toHaveValue('nolan')
})

test('in Por ver the list search adds to the filters', async () => {
  api.listTitles.mockResolvedValue([nolanPorVer, otra])
  renderList({ ...NO_FILTERS, platforms: ['Netflix'] })
  await screen.findByRole('searchbox', { name: 'Buscar en la lista' })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en la lista' }), { target: { value: 'nolan' } })
  expect(screen.queryByText('Interestelar')).not.toBeInTheDocument()
})

test('a list search with no match says so', async () => {
  api.listTitles.mockResolvedValue([nolanPorVer, otra])
  renderList()
  await screen.findByText('Interestelar')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en la lista' }), { target: { value: 'zzz' } })
  expect(screen.getByText('Ningún título coincide con «zzz»')).toBeInTheDocument()
  expect(screen.queryByText('Ningún título cumple estos filtros')).not.toBeInTheDocument()
})

test('opening a result and coming back keeps the list search', async () => {
  api.listTitles.mockResolvedValue([nolanPorVer, otra])
  renderList()
  await screen.findByText('Interestelar')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en la lista' }), { target: { value: 'nolan' } })
  fireEvent.click(screen.getByRole('button', { name: /Ver Interestelar/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(await screen.findByRole('searchbox', { name: 'Buscar en la lista' })).toHaveValue('nolan')
  expect(screen.queryByText('Amélie')).not.toBeInTheDocument()
})

test('Quitar reloads the list by itself, without waiting for realtime', async () => {
  api.listTitles.mockResolvedValue([angelito])
  api.removeTitle.mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderList()
  await screen.findByText('Mi pobre angelito')
  api.listTitles.mockResolvedValue([])
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Quitar Mi pobre angelito' })))
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
})

test('an older load that answers last does not bring back a removed title', async () => {
  let answerOld!: (list: Title[]) => void
  api.listTitles.mockReturnValueOnce(new Promise((r) => (answerOld = r))).mockResolvedValue([])
  renderList()
  await act(async () => notify())
  await act(async () => answerOld([angelito]))
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
  expect(screen.getByText('Nuestra lista está vacía')).toBeInTheDocument()
})

test('if the open title is removed elsewhere, the list comes back with a notice', async () => {
  api.listTitles.mockResolvedValue([angelito])
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: /^Ver Mi pobre angelito/ }))
  api.listTitles.mockResolvedValue([])
  await act(async () => notify())
  expect(screen.getByRole('alert')).toHaveTextContent('«Mi pobre angelito» ya no está en la lista')
  expect(screen.getByRole('button', { name: 'Por ver' })).toBeInTheDocument()
})

test('the card is announced with its scores and who added it', async () => {
  api.listTitles.mockResolvedValue([angelito])
  renderList()
  const card = await screen.findByRole('button', { name: /^Ver Mi pobre angelito/ })
  expect(card).not.toHaveAttribute('aria-label')
  expect(card).toHaveAccessibleName(expect.stringContaining('IMDb 7.7'))
  expect(card).toHaveAccessibleName(expect.stringContaining('La agregó Juli'))
})

test('after a change is sent, the card keeps it until the new list arrives', async () => {
  enqueue('u1:c1', { kind: 'watched', titleId: 't1', watched: true })
  api.listTitles.mockResolvedValueOnce([angelito]).mockReturnValue(new Promise(() => {}))
  api.setWatched.mockResolvedValue(undefined)
  renderList()
  await screen.findByRole('button', { name: 'Vistas' })
  await act(async () => {})
  expect(api.setWatched).toHaveBeenCalled()
  expect(pendingFor('u1:c1')).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
  expect(screen.getByText('Mi pobre angelito')).toBeInTheDocument()
})
