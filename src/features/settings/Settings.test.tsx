import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ createInvite: vi.fn(), signOut: vi.fn(), writeText: vi.fn() }))
vi.mock('../couple/coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../couple/coupleApi')>()),
  createInvite: api.createInvite,
}))
vi.mock('../auth/authApi', () => ({ signOut: api.signOut }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { nacho, pili, withCouple } from '../../test/providers'
import { Settings } from './Settings'

function renderSettings(memberCount: number) {
  render(withCouple(<Settings />, memberCount === 1 ? [nacho] : [pili, nacho]))
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: api.writeText }, configurable: true })
  api.writeText.mockResolvedValue(undefined)
})

test('with one member, Invitar a mi pareja shows a copyable link', async () => {
  api.createInvite.mockResolvedValue('tok123')
  renderSettings(1)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a mi pareja' }))
  const link = `${window.location.origin}/?invite=tok123`
  expect(await screen.findByDisplayValue(link)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
  expect(api.writeText).toHaveBeenCalledWith(link)
})

test('a failed invite shows its message', async () => {
  const { CoupleError } = await import('../couple/coupleApi')
  api.createInvite.mockRejectedValue(new CoupleError('network'))
  renderSettings(1)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a mi pareja' }))
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
})

test('with two members there is no invite button', () => {
  renderSettings(2)
  expect(screen.queryByRole('button', { name: 'Invitar a mi pareja' })).not.toBeInTheDocument()
  expect(screen.getByText(/^Son dos personas en este espacio/)).toBeInTheDocument()
})

test('Cerrar sesión calls signOut', () => {
  renderSettings(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(api.signOut).toHaveBeenCalled()
})

test('with two members names both, mine first', () => {
  renderSettings(2)
  expect(screen.getByText('Son dos personas en este espacio: Nacho y Pili')).toBeInTheDocument()
})

test('a missing name is left out', () => {
  render(withCouple(<Settings />, [nacho, { userId: 'u2', displayName: null }]))
  expect(screen.getByText('Son dos personas en este espacio')).toBeInTheDocument()
})

test('shows the TMDB attribution', () => {
  renderSettings(2)
  expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeInTheDocument()
})
