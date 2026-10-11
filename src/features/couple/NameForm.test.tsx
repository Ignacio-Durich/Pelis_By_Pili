import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ setDisplayName: vi.fn() }))
vi.mock('./coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./coupleApi')>()),
  ...api,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { CoupleError } from './coupleApi'
import { NameForm } from './NameForm'

const onDone = vi.fn()

beforeEach(() => vi.resetAllMocks())

function type(value: string) {
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value } })
}

test('asks for the name', () => {
  render(<NameForm onDone={onDone} />)
  expect(screen.getByRole('heading', { name: '¿Cómo te llamás?' })).toBeInTheDocument()
  expect(screen.getByText('Así te va a ver tu pareja en la lista.')).toBeInTheDocument()
  expect(screen.getByLabelText('Tu nombre')).toHaveAttribute('maxLength', '30')
})

test('Guardar is disabled while the name is empty or blank', () => {
  render(<NameForm onDone={onDone} />)
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  type('   ')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
})

test('saves the name and finishes', async () => {
  api.setDisplayName.mockResolvedValue(undefined)
  render(<NameForm onDone={onDone} />)
  type('Juli')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(api.setDisplayName).toHaveBeenCalledWith('Juli')
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
})

test.each([
  ['invalid_name', 'Escribí un nombre de hasta 30 letras'],
  ['network', 'Sin conexión. Probá de nuevo.'],
] as const)('a %s error shows its message', async (kind, text) => {
  api.setDisplayName.mockRejectedValue(new CoupleError(kind))
  render(<NameForm onDone={onDone} />)
  type('Juli')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})
