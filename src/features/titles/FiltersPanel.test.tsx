import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { NO_FILTERS, type Filters } from './filters'
import { FiltersPanel } from './FiltersPanel'

const onChange = vi.fn()
const options = { genres: ['Comedia', 'Drama'], platforms: ['Netflix', 'Prime Video'] }

beforeEach(() => vi.resetAllMocks())

function open(value: Filters = NO_FILTERS, opts = options) {
  render(<FiltersPanel value={value} options={opts} count={{ matching: 0, total: 0 }} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }))
}

test('the Filtros button shows how many are active and toggles the panel', () => {
  render(<FiltersPanel value={{ ...NO_FILTERS, type: 'tv', imdb: [7, 10] }} options={options} count={{ matching: 0, total: 0 }} onChange={onChange} />)
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

test('duration and IMDb are range bars with their texts', () => {
  open({ ...NO_FILTERS, runtime: [60, 150] })
  expect(screen.getByText('Entre 1 h y 2 h 30')).toBeInTheDocument()
  expect(screen.getByText('Cualquier puntaje')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  const maxRuntime = screen.getByRole('slider', { name: 'Duración máximo' })
  expect(maxRuntime).toHaveAttribute('step', '30')
  fireEvent.change(maxRuntime, { target: { value: '120' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, runtime: [60, 120] })
  const minImdb = screen.getByRole('slider', { name: 'IMDb mínimo' })
  expect(minImdb).toHaveAttribute('step', '1')
  fireEvent.change(minImdb, { target: { value: '7' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, runtime: [60, 150], imdb: [7, 10] })
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

test('with active filters it says how many titles match, even with the panel closed', () => {
  const { rerender } = render(
    <FiltersPanel value={{ ...NO_FILTERS, type: 'tv' }} options={options} count={{ matching: 3, total: 12 }} onChange={onChange} />,
  )
  expect(screen.getByText('3 de 12 títulos cumplen los filtros')).toBeInTheDocument()
  rerender(<FiltersPanel value={{ ...NO_FILTERS, type: 'tv' }} options={options} count={{ matching: 1, total: 12 }} onChange={onChange} />)
  expect(screen.getByText('1 de 12 títulos cumple los filtros')).toBeInTheDocument()
  rerender(<FiltersPanel value={NO_FILTERS} options={options} count={{ matching: 12, total: 12 }} onChange={onChange} />)
  expect(screen.queryByText(/cumplen? los filtros/)).not.toBeInTheDocument()
})

test('a chosen genre or platform that no longer has titles can still be turned off', () => {
  open({ ...NO_FILTERS, platforms: ['Disney Plus'], genres: ['Western'] })
  const platform = screen.getByRole('button', { name: 'Disney Plus' })
  expect(platform).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(platform)
  expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, platforms: [], genres: ['Western'] })
  expect(screen.getByRole('button', { name: 'Western' })).toHaveAttribute('aria-pressed', 'true')
})
