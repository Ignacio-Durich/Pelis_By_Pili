import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthChange: vi.fn(),
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
}))
vi.mock('./authApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./authApi')>()),
  ...api,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { AuthError } from './authApi'
import { AuthGate } from './AuthGate'
import { useUserId } from './sessionContext'

const session = { user: { id: 'u1' } }
let authListener: (s: unknown) => void

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  api.getSession.mockResolvedValue(null)
  api.onAuthChange.mockImplementation((cb) => {
    authListener = cb
    return () => {}
  })
  api.requestCode.mockResolvedValue(undefined)
  api.verifyCode.mockResolvedValue(undefined)
})

function renderGate() {
  render(
    <AuthGate>
      <p>contenido privado</p>
    </AuthGate>,
  )
}

async function goToCodeStep() {
  renderGate()
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'nacho@gmail.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviarme el código' }))
  return screen.findByLabelText('Ingresá el código de 6 dígitos que te llegó por email')
}

test('shows Cargando… and no form while the session is unknown', () => {
  api.getSession.mockReturnValue(new Promise(() => {}))
  renderGate()
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
})

test('without a session shows the email form', async () => {
  renderGate()
  expect(await screen.findByLabelText('Email')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviarme el código' })).toBeInTheDocument()
  expect(screen.queryByText('contenido privado')).not.toBeInTheDocument()
})

test('after sending the email asks for the 6-digit code', async () => {
  expect(await goToCodeStep()).toBeInTheDocument()
  expect(api.requestCode).toHaveBeenCalledWith('nacho@gmail.com')
})

test('the code field keeps only digits and submits at 6', async () => {
  const field = await goToCodeStep()
  fireEvent.change(field, { target: { value: '12a3' } })
  expect(field).toHaveValue('123')
  expect(api.verifyCode).not.toHaveBeenCalled()
  fireEvent.change(field, { target: { value: '123456' } })
  expect(api.verifyCode).toHaveBeenCalledWith('nacho@gmail.com', '123456')
})

test('a wrong code shows Código incorrecto o vencido', async () => {
  api.verifyCode.mockRejectedValue(new AuthError('wrong_code'))
  const field = await goToCodeStep()
  fireEvent.change(field, { target: { value: '000000' } })
  expect(await screen.findByText('Código incorrecto o vencido')).toBeInTheDocument()
})

test('rate_limited shows the wait message', async () => {
  api.requestCode.mockRejectedValue(new AuthError('rate_limited'))
  renderGate()
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'nacho@gmail.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviarme el código' }))
  expect(await screen.findByText('Pediste muchos códigos, esperá unos minutos')).toBeInTheDocument()
})

test('Usar otro email goes back to the email step', async () => {
  await goToCodeStep()
  fireEvent.click(screen.getByRole('button', { name: 'Usar otro email' }))
  expect(await screen.findByLabelText('Email')).toBeInTheDocument()
})

test('a network failure on startup offers Reintentar', async () => {
  api.getSession.mockRejectedValueOnce(new AuthError('network')).mockResolvedValueOnce(session)
  renderGate()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('contenido privado')).toBeInTheDocument()
  expect(api.getSession).toHaveBeenCalledTimes(2)
})

test('with a session renders the children', async () => {
  api.getSession.mockResolvedValue(session)
  renderGate()
  expect(await screen.findByText('contenido privado')).toBeInTheDocument()
})

test('a sign-in event renders the children', async () => {
  await goToCodeStep()
  authListener(session)
  expect(await screen.findByText('contenido privado')).toBeInTheDocument()
})

function ShowUserId() {
  return <p>{`usuario ${useUserId()}`}</p>
}

test('with a session the children can read the user id', async () => {
  api.getSession.mockResolvedValue(session)
  render(
    <AuthGate>
      <ShowUserId />
    </AuthGate>,
  )
  expect(await screen.findByText('usuario u1')).toBeInTheDocument()
})

function WhoAmI() {
  return <p>{`cuenta ${useUserId()}`}</p>
}

test('offline with an account used before on this phone, it opens with that account', async () => {
  api.getSession.mockResolvedValueOnce(session)
  const first = render(
    <AuthGate>
      <WhoAmI />
    </AuthGate>,
  )
  expect(await screen.findByText('cuenta u1')).toBeInTheDocument()
  first.unmount()
  api.getSession.mockRejectedValueOnce(new AuthError('network'))
  render(
    <AuthGate>
      <WhoAmI />
    </AuthGate>,
  )
  expect(await screen.findByText('cuenta u1')).toBeInTheDocument()
  expect(screen.queryByText('Sin conexión. Probá de nuevo.')).not.toBeInTheDocument()
})

test('after signing out, offline does not open the old account', async () => {
  api.getSession.mockResolvedValueOnce(session)
  const first = render(
    <AuthGate>
      <WhoAmI />
    </AuthGate>,
  )
  await screen.findByText('cuenta u1')
  act(() => authListener(null))
  first.unmount()
  api.getSession.mockRejectedValueOnce(new AuthError('network'))
  renderGate()
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
})

test('with an account saved on this phone it opens at once, before the session answers', async () => {
  api.getSession.mockResolvedValueOnce(session)
  const first = render(
    <AuthGate>
      <WhoAmI />
    </AuthGate>,
  )
  await screen.findByText('cuenta u1')
  first.unmount()
  api.getSession.mockReturnValue(new Promise(() => {}))
  render(
    <AuthGate>
      <WhoAmI />
    </AuthGate>,
  )
  expect(screen.getByText('cuenta u1')).toBeInTheDocument()
})
