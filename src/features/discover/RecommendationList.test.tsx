import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  addTitle: vi.fn(),
  removeTitle: vi.fn(),
  searchDetails: vi.fn(),
  fetchTitleDetail: vi.fn(),
  dismissTitle: vi.fn(),
  undismissTitle: vi.fn(),
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
  dismissTitle: api.dismissTitle,
  undismissTitle: api.undismissTitle,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { TitleError } from '../titles/titlesApi'
import { recKey, type Recommendation } from './discoverApi'
import { RecommendationList } from './RecommendationList'

const argentina: Recommendation = {
  tmdbId: 935,
  mediaType: 'movie',
  title: 'Argentina, 1985',
  originalTitle: 'Argentina, 1985',
  year: 2023,
  posterPath: '/a.jpg',
  overview: 'El juicio a las juntas militares, contado desde adentro.',
  genres: ['Drama', 'Historia'],
  because: ['Relatos salvajes', 'Argentina, 1985'],
}
const many = (n: number): Recommendation[] =>
  Array.from({ length: n }, (_, i) => ({ ...argentina, tmdbId: 1000 + i, title: `Peli ${i + 1}`, originalTitle: `Peli ${i + 1}`, because: undefined }))

const onHide = vi.fn()
const onOpenWatched = vi.fn()

function renderList(items: Recommendation[], extra: { titles?: ReturnType<typeof makeTitle>[]; hidden?: Set<string> } = {}) {
  render(
    withCouple(
      <RecommendationList
        coupleId="c1"
        items={items}
        titles={extra.titles ?? []}
        originNote={() => 'Descubrir'}
        hidden={extra.hidden ?? new Set()}
        onHide={onHide}
        onOpenWatched={onOpenWatched}
      />,
    ),
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  api.searchDetails.mockResolvedValue({})
  api.fetchTitleDetail.mockResolvedValue({})
  api.addTitle.mockResolvedValue('new1')
  api.removeTitle.mockResolvedValue(undefined)
  api.dismissTitle.mockResolvedValue(undefined)
  api.undismissTitle.mockResolvedValue(undefined)
})

test('shows 10, Ver más adds 10, and asks details only for the visible ones', async () => {
  renderList(many(25))
  expect(screen.getAllByRole('listitem')).toHaveLength(10)
  await waitFor(() => expect(api.searchDetails).toHaveBeenCalledTimes(1))
  expect(api.searchDetails.mock.calls[0][0]).toHaveLength(10)
  fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(20)
  await waitFor(() => expect(api.searchDetails).toHaveBeenCalledTimes(2))
  expect(api.searchDetails.mock.calls[1][0]).toHaveLength(20)
  fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(25)
  expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
})

test('a card shows runtime, IMDb, why and genres only when its detail is open', async () => {
  api.searchDetails.mockResolvedValue({ [recKey(argentina)]: { director: null, seasons: null, runtime: 144, imdb: '7.8/10' } })
  renderList([argentina])
  expect(await screen.findByText('2023 · Película · 2 h 24')).toBeInTheDocument()
  expect(screen.getByText('IMDb 7.8')).toBeInTheDocument()
  expect(screen.getByText('Porque vieron Relatos salvajes y Argentina, 1985')).toBeInTheDocument()
  expect(screen.queryByText('Drama · Historia')).not.toBeInTheDocument()
  expect(screen.queryByText(argentina.overview)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(screen.getByText(argentina.overview)).toBeInTheDocument()
  expect(screen.getByText('Drama · Historia')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ocultar detalle' })).toBeInTheDocument()
})

test('a single seed reads Porque vieron A and platforms show under the card', () => {
  renderList([{ ...argentina, because: ['Relatos salvajes'], platforms: ['Netflix', 'Disney+'] }])
  expect(screen.getByText('Porque vieron Relatos salvajes')).toBeInTheDocument()
  expect(screen.getByText('En Netflix · Disney+')).toBeInTheDocument()
})

test('tapping adds it with the origin note and tapping again takes it out', async () => {
  renderList([argentina])
  fireEvent.click(screen.getByRole('button', { name: /Argentina, 1985/ }))
  expect(await screen.findByText('✓ Agregada · tocala de nuevo para quitarla')).toBeInTheDocument()
  expect(api.addTitle).toHaveBeenCalledWith('c1', argentina, 'Descubrir')
  expect(onHide).toHaveBeenLastCalledWith(recKey(argentina), true)
  fireEvent.click(screen.getByRole('button', { name: /Argentina, 1985/ }))
  await waitFor(() => expect(screen.queryByText('✓ Agregada · tocala de nuevo para quitarla')).not.toBeInTheDocument())
  expect(api.removeTitle).toHaveBeenCalledWith('new1')
  expect(onHide).toHaveBeenLastCalledWith(recKey(argentina), false)
})

test('if the other one added it a moment ago it says Ya está en la lista', async () => {
  api.addTitle.mockRejectedValue(new TitleError('duplicate'))
  renderList([argentina])
  fireEvent.click(screen.getByRole('button', { name: /Argentina, 1985/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya está en la lista')
  expect(screen.queryByText('✓ Agregada · tocala de nuevo para quitarla')).not.toBeInTheDocument()
  expect(onHide).not.toHaveBeenCalled()
})

test('if adding fails for another reason it says to try again', async () => {
  api.addTitle.mockRejectedValue(new TitleError('network'))
  renderList([argentina])
  fireEvent.click(screen.getByRole('button', { name: /Argentina, 1985/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo agregar. Probá de nuevo.')
})

test('a title already in the list is not offered', () => {
  renderList([argentina], { titles: [makeTitle({ id: 't2', tmdbId: 935, title: 'Argentina, 1985' })] })
  expect(screen.queryByRole('button', { name: /Argentina, 1985/ })).not.toBeInTheDocument()
})

test('No me interesa replaces the card with Deshacer, and Deshacer brings it back', async () => {
  renderList([argentina])
  fireEvent.click(screen.getByRole('button', { name: 'No me interesa' }))
  expect(await screen.findByText(/Descartada ·/)).toBeInTheDocument()
  expect(api.dismissTitle).toHaveBeenCalledWith('movie', 935)
  expect(onHide).toHaveBeenLastCalledWith(recKey(argentina), true)
  expect(screen.queryByRole('button', { name: /Argentina, 1985/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(await screen.findByRole('button', { name: /Argentina, 1985/ })).toBeInTheDocument()
  expect(api.undismissTitle).toHaveBeenCalledWith('movie', 935)
  expect(onHide).toHaveBeenLastCalledWith(recKey(argentina), false)
})

test('a dismissed card keeps showing Deshacer even after the parent hides it', async () => {
  const props = { coupleId: 'c1', items: [argentina], titles: [], originNote: () => 'x', onHide }
  const { rerender } = render(withCouple(<RecommendationList {...props} hidden={new Set()} />))
  fireEvent.click(screen.getByRole('button', { name: 'No me interesa' }))
  await screen.findByText(/Descartada ·/)
  rerender(withCouple(<RecommendationList {...props} hidden={new Set([recKey(argentina)])} />))
  expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
})

test('if dismissing fails the card stays and an alert says so', async () => {
  api.dismissTitle.mockRejectedValue(new Error('x'))
  renderList([argentina])
  fireEvent.click(screen.getByRole('button', { name: 'No me interesa' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descartar. Probá de nuevo.')
  expect(screen.getByRole('button', { name: /Argentina, 1985/ })).toBeInTheDocument()
  expect(onHide).not.toHaveBeenCalled()
})

test('a watched series with a new season opens its detail instead of adding, without No me interesa', () => {
  const serie: Recommendation = { ...argentina, tmdbId: 7, mediaType: 'tv', title: 'Serie vista', originalTitle: 'Serie vista', newSeason: true, watchedTitleId: 't9' }
  renderList([serie])
  expect(screen.getByText('Ya la vieron · salió una temporada nueva')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'No me interesa' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Serie vista/ }))
  expect(onOpenWatched).toHaveBeenCalledWith('t9')
  expect(api.addTitle).not.toHaveBeenCalled()
})

test('a new season of something not watched gets the Temporada nueva tag', () => {
  renderList([{ ...argentina, mediaType: 'tv', newSeason: true }])
  expect(screen.getByText('Temporada nueva')).toBeInTheDocument()
})

test('items in hidden do not show', () => {
  renderList([argentina, { ...argentina, tmdbId: 5, title: 'Otra' }], { hidden: new Set([recKey(argentina)]) })
  expect(screen.queryByText('Argentina, 1985')).not.toBeInTheDocument()
  expect(screen.getByText('Otra')).toBeInTheDocument()
})
