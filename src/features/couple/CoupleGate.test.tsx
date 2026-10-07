import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ getMyCouple: vi.fn(), acceptInvite: vi.fn(), createCouple: vi.fn(), setDisplayName: vi.fn() }))
vi.mock('./coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./coupleApi')>()),
  ...api,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import type { Session } from '@supabase/supabase-js'
import { SessionContext } from '../auth/sessionContext'
import { CoupleError } from './coupleApi'
import { CoupleGate } from './CoupleGate'
import { useCouple } from './coupleContext'

function Child() {
  const { coupleId, memberCount } = useCouple()
  return <p>{`espacio ${coupleId} con ${memberCount}`}</p>
}

function renderGate() {
  render(
    <SessionContext.Provider value={{ user: { id: 'u1' } } as Session}>
      <CoupleGate>
        <Child />
      </CoupleGate>
    </SessionContext.Provider>,
  )
}

const nacho = { userId: 'u1', displayName: 'Nacho' }
const pili = { userId: 'u2', displayName: 'Pili' }

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
  api.getMyCouple.mockResolvedValue({ coupleId: 'c1', memberCount: 2, members: [nacho, pili] })
  renderGate()
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
})

test('after creating the couple shows the children', async () => {
  api.getMyCouple.mockResolvedValueOnce(null).mockResolvedValueOnce({ coupleId: 'c1', memberCount: 1, members: [nacho] })
  api.createCouple.mockResolvedValue('c1')
  renderGate()
  fireEvent.click(await screen.findByRole('button', { name: 'Crear nuestro espacio' }))
  expect(await screen.findByText('espacio c1 con 1')).toBeInTheDocument()
})

test('someone already in a couple who opens an invite stays in their space', async () => {
  window.history.replaceState(null, '', '/?invite=otro')
  api.getMyCouple.mockResolvedValue({ coupleId: 'c1', memberCount: 2, members: [nacho, pili] })
  renderGate()
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
  expect(api.acceptInvite).not.toHaveBeenCalled()
})

test('a network failure offers Reintentar', async () => {
  api.getMyCouple
    .mockRejectedValueOnce(new CoupleError('network'))
    .mockResolvedValueOnce({ coupleId: 'c1', memberCount: 2, members: [nacho, pili] })
  renderGate()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
})

test('without my name asks for it before showing the children', async () => {
  api.getMyCouple
    .mockResolvedValueOnce({ coupleId: 'c1', memberCount: 1, members: [{ userId: 'u1', displayName: null }] })
    .mockResolvedValueOnce({ coupleId: 'c1', memberCount: 1, members: [nacho] })
  api.setDisplayName.mockResolvedValue(undefined)
  renderGate()
  fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Nacho' } })
  expect(screen.queryByText(/espacio c1/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('espacio c1 con 1')).toBeInTheDocument()
})

test("a partner without a name does not block me", async () => {
  api.getMyCouple.mockResolvedValue({ coupleId: 'c1', memberCount: 2, members: [nacho, { userId: 'u2', displayName: null }] })
  renderGate()
  expect(await screen.findByText('espacio c1 con 2')).toBeInTheDocument()
})
