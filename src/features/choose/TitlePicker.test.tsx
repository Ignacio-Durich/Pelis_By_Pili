import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchTitleDetail: vi.fn() }))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))

import { makeTitle } from '../../test/titles'
import { TitlePicker } from './TitlePicker'

const titles = ['a', 'b', 'c', 'd', 'e'].map((id, i) => makeTitle({ id, tmdbId: i, title: `Peli ${id.toUpperCase()}` }))
const press = (letter: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`Peli ${letter.toUpperCase()}`) }))

test('marks up to need and Listo sends them in order', () => {
  const onDone = vi.fn()
  render(<TitlePicker titles={titles} matching={titles} initial={[]} need={4} onDone={onDone} />)
  expect(screen.getByRole('button', { name: 'Listo (0 de 4)' })).toBeDisabled()
  for (const l of ['e', 'a', 'c', 'b', 'd']) press(l)
  expect(screen.getByRole('button', { name: /Peli D/ })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Listo (4 de 4)' }))
  expect(onDone).toHaveBeenCalledWith(['e', 'a', 'c', 'b'])
})

test('locked titles show who chose them, cannot be picked and do not count', () => {
  const onDone = vi.fn()
  render(<TitlePicker titles={titles} matching={titles} initial={[]} need={4} locked={{ ids: ['a', 'b'], label: 'La eligió Tomás' }} onDone={onDone} />)
  expect(screen.getAllByText('La eligió Tomás')).toHaveLength(2)
  expect(screen.getByRole('button', { name: /Peli A/ })).toBeDisabled()
  for (const l of ['c', 'd', 'e']) press(l)
  fireEvent.click(screen.getByRole('button', { name: 'Listo (3 de 3)' }))
  expect(onDone).toHaveBeenCalledWith(['c', 'd', 'e'])
})

test('a chosen title that was watched meanwhile shows up no more and does not count', () => {
  const onDone = vi.fn()
  const seen = makeTitle({ id: 'w', tmdbId: 99, title: 'Peli W', status: 'watched', watchedAt: '2026-10-07T20:00:00Z' })
  const toWatch = titles.slice(0, 3)
  render(<TitlePicker titles={[...toWatch, seen]} matching={toWatch} initial={['a', 'b', 'w']} need={3} onDone={onDone} />)
  expect(screen.queryByRole('button', { name: /Peli W/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Listo (2 de 3)' })).toBeDisabled()
  press('c')
  fireEvent.click(screen.getByRole('button', { name: 'Listo (3 de 3)' }))
  expect(onDone).toHaveBeenCalledWith(['a', 'b', 'c'])
})

test('with nothing to choose Listo stays disabled', () => {
  render(<TitlePicker titles={[]} matching={[]} initial={[]} need={3} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: /^Listo/ })).toBeDisabled()
})

test('each option shows how long it lasts', () => {
  const long = makeTitle({ id: 'l', tmdbId: 50, title: 'Peli L', runtime: 135 })
  render(<TitlePicker titles={[long]} matching={[long]} initial={[]} need={4} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Peli L/ })).toHaveTextContent('2 h 15')
})

test('the heading asks for as many as can be chosen, saying whose turn it is', () => {
  const two = titles.slice(0, 2)
  const { unmount } = render(<TitlePicker titles={two} matching={two} initial={[]} need={4} onDone={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Elegí 2' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Listo (0 de 2)' })).toBeInTheDocument()
  unmount()
  render(<TitlePicker turnOf="Juli" titles={titles} matching={titles} initial={[]} need={4} onDone={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Turno de Juli: elegí 4' })).toBeInTheDocument()
})

test('each card shows director and IMDb, and the i button brings the synopsis without picking it', async () => {
  api.fetchTitleDetail.mockResolvedValue({ overview: 'Un juicio histórico.' })
  const one = makeTitle({ id: 'a', tmdbId: 1, title: 'Peli A', director: 'Santiago Mitre', imdbRating: '7.8/10', genres: ['Drama'] })
  render(<TitlePicker titles={[one]} matching={[one]} initial={[]} need={3} onDone={vi.fn()} />)
  expect(screen.getByText('Dirigida por Santiago Mitre')).toBeInTheDocument()
  expect(screen.getByText('IMDb 7.8')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(await screen.findByText('Un juicio histórico.')).toBeInTheDocument()
  expect(screen.getByText('Drama')).toBeInTheDocument()
  expect(api.fetchTitleDetail).toHaveBeenCalledWith('a')
  expect(screen.getByRole('button', { name: /Peli A/ })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle' }))
  expect(screen.queryByText('Un juicio histórico.')).not.toBeInTheDocument()
})

test('if the synopsis cannot load it says so', async () => {
  api.fetchTitleDetail.mockRejectedValue(new Error('x'))
  const one = makeTitle({ id: 'a', tmdbId: 1, title: 'Peli A' })
  render(<TitlePicker titles={[one]} matching={[one]} initial={[]} need={3} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(await screen.findByText('No se pudo cargar la sinopsis.')).toBeInTheDocument()
})
