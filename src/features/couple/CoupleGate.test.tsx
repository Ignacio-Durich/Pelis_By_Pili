import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ getMyCouple: vi.fn(), acceptInvite: vi.fn(), createCouple: vi.fn() }))
vi.mock('./coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./coupleApi')>()),
  ...api,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { CoupleError } from './coupleApi'
import { CoupleGate } from './CoupleGate'
import { useCouple } from './coupleContext'

function Child() {
  const { coupleId, memberCount } = useCouple()
  return <p>{`espacio ${coupleId} con ${memberCount}`}</p>
}

function renderGate() {
  render(
    <CoupleGate>
      <Child />
    </CoupleGate>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
})
afterEach(() => window.history.replaceState(null, '', '/'))

test('shows Cargando… while loading', () => {
  api.getMyCouple.mockReturnValue(new Promise(() => {}))
  renderGate()
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
})

test('without a couple shows Onboarding', async () => {
  api.getMyCouple.mockResolvedValue(null)
  renderGate()
  expect(await screen.findByRole('button', { name: 'Crear nuestro espacio' })).toBeInTheDocument()
})

test('with a couple renders the children with useCouple', async () => {
  api.getMyCouple.mockResolvedValue({ coupleId: 'c1', memberCount: 2 })
  renderGate()
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
})

test('after creating the couple shows the children', async () => {
  api.getMyCouple.mockResolvedValueOnce(null).mockResolvedValueOnce({ coupleId: 'c1', memberCount: 1 })
  api.createCouple.mockResolvedValue('c1')
  renderGate()
  fireEvent.click(await screen.findByRole('button', { name: 'Crear nuestro espacio' }))
  expect(await screen.findByText('espacio c1 con 1')).toBeInTheDocument()
})

test('someone already in a couple who opens an invite stays in their space', async () => {
  window.history.replaceState(null, '', '/?invite=otro')
  api.getMyCouple.mockResolvedValue({ coupleId: 'c1', memberCount: 2 })
  renderGate()
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
  expect(api.acceptInvite).not.toHaveBeenCalled()
})

test('a network failure offers Reintentar', async () => {
  api.getMyCouple
    .mockRejectedValueOnce(new CoupleError('network'))
    .mockResolvedValueOnce({ coupleId: 'c1', memberCount: 2 })
  renderGate()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
})
