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
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
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
})
afterEach(() => vi.restoreAllMocks())

function renderList() {
  return render(withCouple(<TitleList />))
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
