import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { NO_FILTERS, type Filters } from './filters'
import { FiltersPanel } from './FiltersPanel'

const onChange = vi.fn()
const options = { genres: ['Comedia', 'Drama'], platforms: ['Netflix', 'Prime Video'] }

beforeEach(() => vi.resetAllMocks())

function open(value: Filters = NO_FILTERS, opts = options) {
  render(<FiltersPanel value={value} options={opts} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }))
}

test('the Filtros button shows how many are active and toggles the panel', () => {
  render(<FiltersPanel value={{ ...NO_FILTERS, type: 'tv', minImdb: 7 }} options={options} onChange={onChange} />)
  const toggle = screen.getByRole('button', { name: 'Filtros (2)' })
  expect(screen.queryByText('Tipo')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.getByText('Tipo')).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.queryByText('Tipo')).not.toBeInTheDocument()
})

test('type buttons', () => {
  open()
  expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Series' }))
  expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, type: 'tv' })
})

test('duration and IMDb selects', () => {
  open()
  const duration = screen.getByLabelText('Duración')
  expect([...duration.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Cualquiera', 'Hasta 1 h 30', 'Hasta 2 h', 'Hasta 2 h 30'])
  fireEvent.change(duration, { target: { value: '120' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, maxRuntime: 120 })
  const imdb = screen.getByLabelText('Puntaje IMDb')
  expect([...imdb.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Cualquiera', '6 o más', '7 o más', '8 o más'])
  fireEvent.change(imdb, { target: { value: '7' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, minImdb: 7 })
  fireEvent.change(imdb, { target: { value: '' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, minImdb: null })
})

test('genre and platform chips toggle', () => {
  open({ ...NO_FILTERS, platforms: ['Netflix'] })
  expect(screen.getByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Netflix' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, platforms: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Drama' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, platforms: ['Netflix'], genres: ['Drama'] })
})

test('without options each group says there is no data yet', () => {
  open(NO_FILTERS, { genres: [], platforms: [] })
  expect(screen.getAllByText('Todavía no hay datos')).toHaveLength(2)
})

test('Limpiar filtros resets everything', () => {
  open({ ...NO_FILTERS, type: 'movie' })
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS)
})
