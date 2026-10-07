import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ addTitle: vi.fn(), searchTitles: vi.fn(), fetchTitleDetail: vi.fn() }))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  addTitle: api.addTitle,
}))
vi.mock('./searchApi', () => ({ searchTitles: api.searchTitles }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { AddTitle } from './AddTitle'
import type { SearchResult } from './searchApi'
import { TitleError, type Title } from './titlesApi'

const angelito: SearchResult = {
  tmdbId: 771,
  mediaType: 'movie',
  title: 'Mi pobre angelito',
  originalTitle: 'Home Alone',
  year: 1990,
  posterPath: '/h.jpg',
  overview: 'Un chico se queda solo.',
}
const parasitos: SearchResult = { ...angelito, tmdbId: 496243, title: 'Parásitos', originalTitle: '기생충', year: 2019 }
const sinDatos: SearchResult = { ...angelito, tmdbId: 9, mediaType: 'tv', title: 'Serie rara', originalTitle: 'Serie rara', year: null, posterPath: null, overview: '' }

const onClose = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  api.fetchTitleDetail.mockResolvedValue({})
})
afterEach(() => vi.useRealTimers())

function renderAdd(titles: Title[] = []) {
  render(withCouple(<AddTitle coupleId="c1" titles={titles} onClose={onClose} />))
}

async function typeQuery(value: string) {
  fireEvent.change(screen.getByLabelText('Buscar película o serie'), { target: { value } })
  await act(async () => vi.advanceTimersByTime(400))
}

test('shows the search and note fields and Volver', () => {
  renderAdd()
  expect(screen.getByRole('heading', { name: 'Agregar' })).toBeInTheDocument()
  const search = screen.getByLabelText('Buscar película o serie')
  expect(search).toHaveAttribute('type', 'search')
  expect(search).toHaveAttribute('maxLength', '100')
  expect(search).toHaveAttribute('placeholder', 'En español o en inglés')
  const note = screen.getByLabelText('¿De dónde vino? (opcional)')
  expect(note).toHaveAttribute('maxLength', '200')
  expect(note).toHaveAttribute('placeholder', 'Ej.: un reel, una recomendación')
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(onClose).toHaveBeenCalled()
})

test('searches once, 400 ms after the last key, and not with one letter', async () => {
  api.searchTitles.mockResolvedValue([angelito])
  renderAdd()
  await typeQuery('m')
  expect(api.searchTitles).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Buscar película o serie'), { target: { value: 'mi' } })
  await act(async () => vi.advanceTimersByTime(200))
  await typeQuery('mi pobre')
  expect(api.searchTitles).toHaveBeenCalledTimes(1)
  expect(api.searchTitles).toHaveBeenCalledWith('mi pobre')
  expect(screen.getByText('Mi pobre angelito')).toBeInTheDocument()
  expect(screen.getByText('Original: Home Alone')).toBeInTheDocument()
})

test('shows Buscando…, no results and search errors', async () => {
  let finish: (r: SearchResult[]) => void = () => {}
  api.searchTitles.mockReturnValueOnce(new Promise((r) => (finish = r)))
  renderAdd()
  await typeQuery('nada')
  expect(screen.getByText('Buscando…')).toBeInTheDocument()
  await act(async () => finish([]))
  expect(screen.getByText('No encontramos nada con ese nombre')).toBeInTheDocument()

  api.searchTitles.mockRejectedValueOnce(new Error('502'))
  await typeQuery('otra cosa')
  expect(screen.getByText('No se pudo buscar. Probá de nuevo.')).toBeInTheDocument()
})

test('a late answer for an old query does not replace the current results', async () => {
  const answers: Record<string, (r: SearchResult[]) => void> = {}
  api.searchTitles.mockImplementation((q: string) => new Promise((r) => (answers[q] = r)))
  renderAdd()
  await typeQuery('par')
  await typeQuery('parásitos')
  await act(async () => answers['parásitos']([parasitos]))
  await act(async () => answers['par']([angelito]))
  expect(screen.getByText('Parásitos')).toBeInTheDocument()
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
})

test('a result without poster, year or overview shows no null or undefined', async () => {
  api.searchTitles.mockResolvedValue([sinDatos])
  renderAdd()
  await typeQuery('serie rara')
  expect(screen.getByText('Serie')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})

test('tapping a result adds it once with the note, then marks it and clears the note', async () => {
  let finish: () => void = () => {}
  api.addTitle.mockReturnValue(new Promise<string>((r) => (finish = () => r('t9'))))
  api.searchTitles.mockResolvedValue([angelito])
  renderAdd()
  fireEvent.change(screen.getByLabelText('¿De dónde vino? (opcional)'), { target: { value: 'un reel' } })
  await typeQuery('mi pobre')
  const result = screen.getByRole('button', { name: /Mi pobre angelito/ })
  fireEvent.click(result)
  fireEvent.click(result)
  expect(api.addTitle).toHaveBeenCalledTimes(1)
  expect(api.addTitle).toHaveBeenCalledWith('c1', angelito, 'un reel')
  await act(async () => finish())
  expect(screen.getByText('✓ Agregada')).toBeInTheDocument()
  expect(screen.getByLabelText('¿De dónde vino? (opcional)')).toHaveValue('')
})

test('a result already in the list says who added it and cannot be added', async () => {
  api.searchTitles.mockResolvedValue([angelito])
  const existing: Title = {
    ...angelito,
    id: 't1',
    originNote: null,
    addedBy: 'u2',
    createdAt: '2026-10-07T12:00:00Z',
    imdbRating: null,
    rottenTomatoes: null,
    metacritic: null,
    tmdbRating: null,
    ratingsUpdatedAt: null,
  }
  renderAdd([existing])
  await typeQuery('mi pobre')
  expect(screen.getByText('Ya está en la lista (la agregó Pili)')).toBeInTheDocument()
  const result = screen.getByRole('button', { name: /Mi pobre angelito/ })
  expect(result).toBeDisabled()
  fireEvent.click(result)
  expect(api.addTitle).not.toHaveBeenCalled()
})

test.each([
  ['duplicate', 'Ya está en la lista'],
  ['network', 'No se pudo agregar. Probá de nuevo.'],
] as const)('an add failing with %s shows its message', async (kind, text) => {
  api.addTitle.mockRejectedValue(new TitleError(kind))
  api.searchTitles.mockResolvedValue([angelito])
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(screen.getByRole('alert')).toHaveTextContent(text)
})

test('clearing the search while it is in flight does not leave Buscando… on screen', async () => {
  api.searchTitles.mockImplementation(() => new Promise(() => {}))
  renderAdd()
  await typeQuery('parasite')
  expect(screen.getByText('Buscando…')).toBeInTheDocument()
  await typeQuery('')
  expect(screen.queryByText('Buscando…')).not.toBeInTheDocument()
})

test('adding a title asks for its detail in the background', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.searchTitles.mockResolvedValue([angelito])
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(api.fetchTitleDetail).toHaveBeenCalledWith('t9')
})

test('a failing background detail does not show an error', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.fetchTitleDetail.mockRejectedValue(new Error('502'))
  api.searchTitles.mockResolvedValue([angelito])
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(screen.getByText('✓ Agregada')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
