import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchProviders: vi.fn(), fetchPlatforms: vi.fn(), setPlatforms: vi.fn() }))
vi.mock('../discover/discoverApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../discover/discoverApi')>()),
  fetchProviders: api.fetchProviders,
  fetchPlatforms: api.fetchPlatforms,
  setPlatforms: api.setPlatforms,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { Platforms } from './Platforms'

const providers = [
  { id: 8, name: 'Netflix', logoPath: '/netflix.jpg' },
  { id: 337, name: 'Disney Plus', logoPath: '/disney.jpg' },
  { id: 119, name: 'Amazon Prime Video', logoPath: null },
]

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchProviders.mockResolvedValue(providers)
  api.fetchPlatforms.mockResolvedValue([8])
  api.setPlatforms.mockResolvedValue(undefined)
})

const renderPlatforms = () => render(withCouple(<Platforms />))

test('lists the Argentine platforms with logo and marks the chosen ones', async () => {
  renderPlatforms()
  expect(screen.getByRole('heading', { name: 'Nuestras plataformas' })).toBeInTheDocument()
  expect(screen.getByText('Las que pagan. Se usan en Novedades.')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Disney Plus' })).toHaveAttribute('aria-pressed', 'false')
  expect(api.fetchPlatforms).toHaveBeenCalledWith('c1')
  expect(document.querySelector('img[src="https://image.tmdb.org/t/p/w92/netflix.jpg"]')).toBeInTheDocument()
  // Sin logo: solo el nombre, sin imagen.
  expect(screen.getByRole('button', { name: 'Amazon Prime Video' }).querySelector('img')).toBeNull()
})

test('tapping one saves the new list right away, keeping the order', async () => {
  renderPlatforms()
  fireEvent.click(await screen.findByRole('button', { name: 'Disney Plus' }))
  expect(screen.getByRole('button', { name: 'Disney Plus' })).toHaveAttribute('aria-pressed', 'true')
  expect(api.setPlatforms).toHaveBeenCalledWith([8, 337])
  await waitFor(() => expect(screen.getByRole('button', { name: 'Disney Plus' })).toBeEnabled())
})

test('tapping a chosen one takes it out of the list', async () => {
  renderPlatforms()
  fireEvent.click(await screen.findByRole('button', { name: 'Netflix' }))
  expect(api.setPlatforms).toHaveBeenCalledWith([])
  await waitFor(() => expect(screen.getByRole('button', { name: 'Netflix' })).toBeEnabled())
})

test('the buttons are disabled while saving', async () => {
  let done!: () => void
  api.setPlatforms.mockReturnValue(new Promise<void>((r) => (done = r)))
  renderPlatforms()
  fireEvent.click(await screen.findByRole('button', { name: 'Disney Plus' }))
  expect(screen.getByRole('button', { name: 'Netflix' })).toBeDisabled()
  done()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Netflix' })).toBeEnabled())
})

test('if saving fails it goes back to how it was and says so', async () => {
  api.setPlatforms.mockRejectedValue(new Error('network'))
  renderPlatforms()
  fireEvent.click(await screen.findByRole('button', { name: 'Disney Plus' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar. Probá de nuevo.')
  expect(screen.getByRole('button', { name: 'Disney Plus' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
})

test('if the platforms do not load it says so', async () => {
  api.fetchProviders.mockRejectedValue(new Error('network'))
  renderPlatforms()
  expect(await screen.findByText('No se pudieron cargar las plataformas')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('if the chosen ones do not load it says so', async () => {
  api.fetchPlatforms.mockRejectedValue(new Error('network'))
  renderPlatforms()
  expect(await screen.findByText('No se pudieron cargar las plataformas')).toBeInTheDocument()
})
