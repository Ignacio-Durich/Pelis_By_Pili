import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { makeTitle } from '../../test/titles'
import { TitlePicker } from './TitlePicker'

const titles = ['a', 'b', 'c', 'd', 'e'].map((id, i) => makeTitle({ id, tmdbId: i, title: `Peli ${id.toUpperCase()}` }))
const press = (letter: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`Peli ${letter.toUpperCase()}`) }))

test('marks up to need and Listo sends them in order', () => {
  const onDone = vi.fn()
  render(<TitlePicker heading="Elegí 4" titles={titles} matching={titles} initial={[]} need={4} onDone={onDone} />)
  expect(screen.getByRole('button', { name: 'Listo (0 de 4)' })).toBeDisabled()
  for (const l of ['e', 'a', 'c', 'b', 'd']) press(l)
  expect(screen.getByRole('button', { name: /Peli D/ })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Listo (4 de 4)' }))
  expect(onDone).toHaveBeenCalledWith(['e', 'a', 'c', 'b'])
})

test('locked titles show who chose them, cannot be picked and do not count', () => {
  const onDone = vi.fn()
  render(<TitlePicker heading="Elegí 4" titles={titles} matching={titles} initial={[]} need={4} locked={{ ids: ['a', 'b'], label: 'La eligió Tomás' }} onDone={onDone} />)
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
  render(<TitlePicker heading="Elegí tus 3" titles={[...toWatch, seen]} matching={toWatch} initial={['a', 'b', 'w']} need={3} onDone={onDone} />)
  expect(screen.queryByRole('button', { name: /Peli W/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Listo (2 de 3)' })).toBeDisabled()
  press('c')
  fireEvent.click(screen.getByRole('button', { name: 'Listo (3 de 3)' }))
  expect(onDone).toHaveBeenCalledWith(['a', 'b', 'c'])
})

test('with nothing to choose Listo stays disabled', () => {
  render(<TitlePicker heading="Elegí tus 3" titles={[]} matching={[]} initial={[]} need={3} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: /^Listo/ })).toBeDisabled()
})
