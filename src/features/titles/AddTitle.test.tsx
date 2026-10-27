import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ addTitle: vi.fn(), removeTitle: vi.fn(), searchTitles: vi.fn(), searchDetails: vi.fn(), fetchTitleDetail: vi.fn(), dismissShared: vi.fn() }))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  addTitle: api.addTitle,
  removeTitle: api.removeTitle,
}))
vi.mock('./searchApi', () => ({ searchTitles: api.searchTitles, searchDetails: api.searchDetails }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../shared/sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/sharedApi')>()),
  dismissShared: api.dismissShared,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { pendingFor } from '../../lib/offline'
import { withCouple } from '../../test/providers'
import type { SharedItem } from '../shared/sharedApi'
import { AddTitle } from './AddTitle'
import type { SearchResponse, SearchResult } from './searchApi'
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
const found = (results: SearchResult[], person: SearchResponse['person'] = null): SearchResponse => ({ results, person })

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  api.fetchTitleDetail.mockResolvedValue({})
  api.dismissShared.mockResolvedValue(undefined)
  api.searchDetails.mockResolvedValue({})
})
afterEach(() => vi.useRealTimers())

function renderAdd(titles: Title[] = [], shared?: SharedItem) {
  render(withCouple(<AddTitle coupleId="c1" titles={titles} onClose={onClose} shared={shared} />))
}

async function typeQuery(value: string) {
  fireEvent.change(screen.getByLabelText('Buscar película o serie'), { target: { value } })
  await act(async () => vi.advanceTimersByTime(300))
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

test('the ✕ empties the search and leaves the cursor there for the next one', async () => {
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd()
  expect(screen.queryByRole('button', { name: 'Borrar lo escrito' })).not.toBeInTheDocument()
  await typeQuery('angelito')
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo escrito' }))
  const search = screen.getByLabelText('Buscar película o serie')
  expect(search).toHaveValue('')
  expect(search).toHaveFocus()
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Borrar lo escrito' })).not.toBeInTheDocument()
})

test('searches once, 300 ms after the last key, and not with one letter', async () => {
  api.searchTitles.mockResolvedValue(found([angelito]))
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
  let finish: (r: SearchResponse) => void = () => {}
  api.searchTitles.mockReturnValueOnce(new Promise((r) => (finish = r)))
  renderAdd()
  await typeQuery('nada')
  expect(screen.getByText('Buscando…')).toBeInTheDocument()
  await act(async () => finish(found([])))
  expect(screen.getByText('No encontramos nada con ese nombre')).toBeInTheDocument()

  api.searchTitles.mockRejectedValueOnce(new Error('502'))
  await typeQuery('otra cosa')
  expect(screen.getByText('No se pudo buscar. Probá de nuevo.')).toBeInTheDocument()
})

test('a late answer for an old query does not replace the current results', async () => {
  const answers: Record<string, (r: SearchResponse) => void> = {}
  api.searchTitles.mockImplementation((q: string) => new Promise((r) => (answers[q] = r)))
  renderAdd()
  await typeQuery('par')
  await typeQuery('parásitos')
  await act(async () => answers['parásitos'](found([parasitos])))
  await act(async () => answers['par'](found([angelito])))
  expect(screen.getByText('Parásitos')).toBeInTheDocument()
  expect(screen.queryByText('Mi pobre angelito')).not.toBeInTheDocument()
})

test('a director or actor name shows what they made in its own section, first', async () => {
  const nolan = { name: 'Christopher Nolan', role: 'director' as const, results: [parasitos] }
  api.searchTitles.mockResolvedValue(found([angelito], nolan))
  renderAdd()
  await typeQuery('nolan')
  const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
  expect(headings).toEqual(['De Christopher Nolan', 'Títulos'])
  expect(screen.getByRole('button', { name: /Parásitos/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mi pobre angelito/ })).toBeInTheDocument()
  api.searchTitles.mockResolvedValue(found([angelito], { ...nolan, name: 'Ricardo Darín', role: 'actor' }))
  await typeQuery('darin')
  expect(screen.getByRole('heading', { name: 'Con Ricardo Darín' })).toBeInTheDocument()
})

test('results fill in who directed them and the seasons a moment later', async () => {
  api.searchTitles.mockResolvedValue(found([angelito, sinDatos]))
  api.searchDetails.mockResolvedValue({ 'movie:771': { director: 'Chris Columbus', seasons: null }, 'tv:9': { director: 'Alguien', seasons: 2 } })
  renderAdd()
  await typeQuery('algo')
  expect(api.searchDetails).toHaveBeenCalledWith([
    { mediaType: 'movie', tmdbId: 771 },
    { mediaType: 'tv', tmdbId: 9 },
  ])
  expect(screen.getByText('Dirigida por Chris Columbus')).toBeInTheDocument()
  expect(screen.getByText('Serie · 2 temporadas')).toBeInTheDocument()
  expect(screen.getByText('Creada por Alguien')).toBeInTheDocument()
})

test('results also show how long they last and the IMDb score', async () => {
  api.searchTitles.mockResolvedValue(found([angelito, sinDatos]))
  api.searchDetails.mockResolvedValue({
    'movie:771': { director: 'Chris Columbus', seasons: null, runtime: 103, imdb: '7.7/10' },
    'tv:9': { director: null, seasons: 2, runtime: 45, imdb: null },
  })
  renderAdd()
  await typeQuery('algo')
  expect(screen.getByText('1990 · Película · 1 h 43')).toBeInTheDocument()
  expect(screen.getByText('IMDb 7.7')).toBeInTheDocument()
  expect(screen.getByText('Serie · 2 temporadas · 45 min por episodio')).toBeInTheDocument()
  expect(screen.getAllByText(/^IMDb/)).toHaveLength(1)
})

test('a director or actor with many titles shows 20 and Ver más adds 20 more', async () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ ...angelito, tmdbId: 1000 + i, title: `Obra ${i}` }))
  api.searchTitles.mockResolvedValue(found([angelito], { name: 'Ricardo Darín', role: 'actor', results: many }))
  renderAdd()
  await typeQuery('darin')
  expect(screen.getAllByRole('button', { name: /^Obra/ })).toHaveLength(20)
  expect(api.searchDetails).toHaveBeenLastCalledWith([...many.slice(0, 20), angelito].map(({ mediaType, tmdbId }) => ({ mediaType, tmdbId })))
  fireEvent.click(screen.getByRole('button', { name: 'Ver más de Ricardo Darín' }))
  expect(screen.getAllByRole('button', { name: /^Obra/ })).toHaveLength(40)
  await act(async () => {})
  expect(api.searchDetails).toHaveBeenLastCalledWith([...many.slice(0, 40), angelito].map(({ mediaType, tmdbId }) => ({ mediaType, tmdbId })))
  fireEvent.click(screen.getByRole('button', { name: 'Ver más de Ricardo Darín' }))
  expect(screen.getAllByRole('button', { name: /^Obra/ })).toHaveLength(45)
  expect(screen.queryByRole('button', { name: /^Ver más/ })).not.toBeInTheDocument()
  await typeQuery('nolan')
  await typeQuery('darin')
  expect(screen.getAllByRole('button', { name: /^Obra/ })).toHaveLength(20)
})

test('if the details fail, the results stay as they are', async () => {
  api.searchTitles.mockResolvedValue(found([angelito]))
  api.searchDetails.mockRejectedValue(new Error('502'))
  renderAdd()
  await typeQuery('mi pobre')
  expect(screen.getByText('1990 · Película')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a result without poster, year or overview shows no null or undefined', async () => {
  api.searchTitles.mockResolvedValue(found([sinDatos]))
  renderAdd()
  await typeQuery('serie rara')
  expect(screen.getByText('Serie')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/null|undefined/)
})

test('tapping a result adds it once with the note, then marks it and clears the note', async () => {
  let finish: () => void = () => {}
  api.addTitle.mockReturnValue(new Promise<string>((r) => (finish = () => r('t9'))))
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd()
  fireEvent.change(screen.getByLabelText('¿De dónde vino? (opcional)'), { target: { value: 'un reel' } })
  await typeQuery('mi pobre')
  const result = screen.getByRole('button', { name: /Mi pobre angelito/ })
  fireEvent.click(result)
  fireEvent.click(result)
  expect(api.addTitle).toHaveBeenCalledTimes(1)
  expect(api.addTitle).toHaveBeenCalledWith('c1', angelito, 'un reel')
  await act(async () => finish())
  expect(screen.getByText('✓ Agregada · tocala de nuevo para quitarla')).toBeInTheDocument()
  expect(screen.getByLabelText('¿De dónde vino? (opcional)')).toHaveValue('')
})

test('tapping a just-added result again takes it out of the list', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.removeTitle.mockResolvedValue(undefined)
  api.searchTitles.mockResolvedValue(found([angelito]))
  const { rerender } = render(withCouple(<AddTitle coupleId="c1" titles={[]} onClose={onClose} />))
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  // Realtime ya trajo el título a la lista: igual se puede sacar desde acá.
  rerender(withCouple(<AddTitle coupleId="c1" titles={[{ id: 't9', mediaType: 'movie', tmdbId: 771, addedBy: 'u1' } as Title]} onClose={onClose} />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(api.removeTitle).toHaveBeenCalledWith('t9')
  rerender(withCouple(<AddTitle coupleId="c1" titles={[]} onClose={onClose} />))
  expect(screen.queryByText(/Agregada/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mi pobre angelito/ })).toBeEnabled()
})

test('a failed take-out keeps it marked as added and says so', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.removeTitle.mockRejectedValue(new TitleError('network'))
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo quitar. Probá de nuevo.')
  expect(screen.getByText('✓ Agregada · tocala de nuevo para quitarla')).toBeInTheDocument()
})

test('a result already in the list says who added it and cannot be added', async () => {
  api.searchTitles.mockResolvedValue(found([angelito]))
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
  renderAdd([existing])
  await typeQuery('mi pobre')
  expect(screen.getByText('Ya está en la lista (la agregó Juli)')).toBeInTheDocument()
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
  api.searchTitles.mockResolvedValue(found([angelito]))
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
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(api.fetchTitleDetail).toHaveBeenCalledWith('t9')
})

test('a failing background detail does not show an error', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.fetchTitleDetail.mockRejectedValue(new Error('502'))
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd()
  await typeQuery('mi pobre')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  expect(screen.getByText('✓ Agregada · tocala de nuevo para quitarla')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

const reel: SharedItem = {
  id: 'i1',
  url: 'https://www.instagram.com/reel/abc/',
  body: null,
  query: 'Mi pobre',
  source: 'Instagram',
  sharedBy: 'u2',
  createdAt: '2026-10-08T12:00:00Z',
}

test('from a shared item it starts with the search and the note already filled in', async () => {
  api.searchTitles.mockResolvedValue(found([angelito]))
  renderAdd([], reel)
  expect(screen.getByLabelText('Buscar película o serie')).toHaveValue('Mi pobre')
  expect(screen.getByLabelText('¿De dónde vino? (opcional)')).toHaveValue('Reel de Instagram · https://www.instagram.com/reel/abc/')
  await act(async () => vi.advanceTimersByTime(300))
  expect(api.searchTitles).toHaveBeenCalledWith('Mi pobre')
})

test('a shared item without a name starts with an empty search', () => {
  renderAdd([], { ...reel, query: null })
  expect(screen.getByLabelText('Buscar película o serie')).toHaveValue('')
})

test('adding from a shared item takes it out of the inbox once and keeps the note', async () => {
  api.addTitle.mockResolvedValue('t9')
  api.searchTitles.mockResolvedValue(found([angelito, parasitos]))
  renderAdd([], reel)
  await act(async () => vi.advanceTimersByTime(300))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Mi pobre angelito/ })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Parásitos/ })))
  expect(api.dismissShared).toHaveBeenCalledTimes(1)
  expect(api.dismissShared).toHaveBeenCalledWith('i1')
  expect(api.addTitle).toHaveBeenLastCalledWith('c1', parasitos, 'Reel de Instagram · https://www.instagram.com/reel/abc/')
  expect(screen.getByLabelText('¿De dónde vino? (opcional)')).toHaveValue('Reel de Instagram · https://www.instagram.com/reel/abc/')
})

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

test('without connection it offers to save the name for later, into Compartidos', () => {
  localStorage.clear()
  setOnline(false)
  try {
    renderAdd()
    expect(screen.getByText('Sin conexión: no se puede buscar ahora.')).toBeInTheDocument()
    const later = screen.getByRole('button', { name: 'Guardar para agregar después' })
    expect(later).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Buscar película o serie'), { target: { value: ' Dark ' } })
    fireEvent.change(screen.getByLabelText('¿De dónde vino? (opcional)'), { target: { value: 'la dijo Juan' } })
    fireEvent.click(later)
    expect(pendingFor('u1:c1')).toMatchObject([{ kind: 'later', query: 'Dark', note: 'la dijo Juan' }])
    expect(screen.getByText('⏳ Guardado. Va a aparecer en Compartidos cuando vuelva la conexión')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar película o serie')).toHaveValue('')
    expect(screen.getByLabelText('¿De dónde vino? (opcional)')).toHaveValue('')
  } finally {
    setOnline(true)
  }
})

test('a failed search also offers to save it for later', async () => {
  localStorage.clear()
  api.searchTitles.mockRejectedValue(new Error('502'))
  renderAdd()
  await typeQuery('Oldboy')
  expect(screen.getByRole('button', { name: 'Guardar para agregar después' })).toBeEnabled()
})
