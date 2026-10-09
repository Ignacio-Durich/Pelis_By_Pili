import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ createCouple: vi.fn(), acceptInvite: vi.fn() }))
vi.mock('./coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./coupleApi')>()),
  ...api,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { CoupleError, type CoupleErrorKind } from './coupleApi'
import { Onboarding } from './Onboarding'

const onDone = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
})
afterEach(() => window.history.replaceState(null, '', '/'))

test('without a token offers Crear nuestro espacio', async () => {
  api.createCouple.mockResolvedValue('c1')
  render(<Onboarding onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Crear nuestro espacio' }))
  expect(api.createCouple).toHaveBeenCalledTimes(1)
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
})

test('without a token the link can be pasted to join (the home-screen app never sees the link)', async () => {
  api.acceptInvite.mockResolvedValue('c1')
  render(<Onboarding onDone={onDone} />)
  const join = screen.getByRole('button', { name: 'Unirme' })
  expect(join).toBeDisabled()
  fireEvent.change(screen.getByLabelText('¿Te mandaron un enlace de invitación? Pegalo acá'), {
    target: { value: 'https://pelis.example/?invite=abc' },
  })
  fireEvent.click(join)
  expect(api.acceptInvite).toHaveBeenCalledWith('abc')
  expect(api.createCouple).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
})

test('a pasted invalid invite shows its message and keeps the form', async () => {
  api.acceptInvite.mockRejectedValue(new CoupleError('invite_invalid'))
  render(<Onboarding onDone={onDone} />)
  fireEvent.change(screen.getByLabelText('¿Te mandaron un enlace de invitación? Pegalo acá'), {
    target: { value: 'https://pelis.example/?invite=abc' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  expect(await screen.findByText('Esta invitación no es válida o ya se usó')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear nuestro espacio' })).toBeEnabled()
  expect(onDone).not.toHaveBeenCalled()
})

test('two quick taps create a single couple', () => {
  api.createCouple.mockReturnValue(new Promise(() => {}))
  render(<Onboarding onDone={onDone} />)
  const button = screen.getByRole('button', { name: 'Crear nuestro espacio' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(api.createCouple).toHaveBeenCalledTimes(1)
})

test('with ?invite=abc offers Unirme, accepts and cleans the URL', async () => {
  window.history.replaceState(null, '', '/?invite=abc')
  api.acceptInvite.mockResolvedValue('c1')
  render(<Onboarding onDone={onDone} />)
  expect(screen.getByText('Te invitaron a un espacio')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Crear nuestro espacio' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  expect(api.acceptInvite).toHaveBeenCalledWith('abc')
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(window.location.search).toBe('')
})

test.each<[CoupleErrorKind, string]>([
  ['invite_invalid', 'Esta invitación no es válida o ya se usó'],
  ['couple_full', 'Ese espacio ya tiene dos personas'],
  ['network', 'Sin conexión. Probá de nuevo.'],
])('accepting with %s shows its message and does not join', async (kind, text) => {
  window.history.replaceState(null, '', '/?invite=abc')
  api.acceptInvite.mockRejectedValue(new CoupleError(kind))
  render(<Onboarding onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})

test('a rejected invite is dropped so the person can create their own space', async () => {
  window.history.replaceState(null, '', '/?invite=abc')
  api.acceptInvite.mockRejectedValue(new CoupleError('invite_invalid'))
  render(<Onboarding onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  expect(await screen.findByRole('button', { name: 'Crear nuestro espacio' })).toBeInTheDocument()
  expect(window.location.search).toBe('')
})

test('a network error keeps the invite to retry', async () => {
  window.history.replaceState(null, '', '/?invite=abc')
  api.acceptInvite.mockRejectedValue(new CoupleError('network'))
  render(<Onboarding onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  await screen.findByText('Sin conexión. Probá de nuevo.')
  expect(screen.getByRole('button', { name: 'Unirme' })).toBeEnabled()
  expect(window.location.search).toBe('?invite=abc')
})

test('already_in_couple re-reads the couple instead of dead-ending', async () => {
  api.createCouple.mockRejectedValue(new CoupleError('already_in_couple'))
  render(<Onboarding onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Crear nuestro espacio' }))
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
})
