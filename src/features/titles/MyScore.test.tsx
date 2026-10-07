import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ setMyScore: vi.fn() }))
vi.mock('./titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./titlesApi')>()),
  setMyScore: api.setMyScore,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { MyScore } from './MyScore'
import { TitleError, type TitleErrorKind } from './titlesApi'

beforeEach(() => vi.resetAllMocks())

const scoreField = () => screen.getByLabelText('Del 1 al 10')
const save = () => screen.getByRole('button', { name: 'Guardar' })

test('shows the score and note fields', () => {
  render(<MyScore titleId="t1" current={null} />)
  expect(screen.getByRole('heading', { name: 'Tu puntaje' })).toBeInTheDocument()
  expect(scoreField()).toHaveAttribute('inputMode', 'decimal')
  expect(scoreField()).toHaveAttribute('placeholder', 'Ej.: 8,75')
  expect(screen.getByLabelText('Una nota (opcional)')).toHaveAttribute('maxLength', '200')
  expect(save()).toBeDisabled()
})

test('an invalid score shows a hint and cannot be saved', () => {
  render(<MyScore titleId="t1" current={null} />)
  fireEvent.change(scoreField(), { target: { value: '10,5' } })
  expect(screen.getByText('Poné un número del 1 al 10, con hasta 2 decimales')).toBeInTheDocument()
  expect(save()).toBeDisabled()
})

test('saves the parsed score and the note', async () => {
  api.setMyScore.mockResolvedValue(undefined)
  render(<MyScore titleId="t1" current={null} />)
  fireEvent.change(scoreField(), { target: { value: '8,75' } })
  fireEvent.change(screen.getByLabelText('Una nota (opcional)'), { target: { value: 'Buenísima' } })
  fireEvent.click(save())
  expect(api.setMyScore).toHaveBeenCalledWith('t1', 8.75, 'Buenísima')
  expect(await screen.findByText('Guardado')).toBeInTheDocument()
})

test('starts with the current score formatted', () => {
  render(<MyScore titleId="t1" current={{ userId: 'u1', score: 8.75, note: 'Linda', updatedAt: '2026-10-07T21:00:00Z' }} />)
  expect(scoreField()).toHaveValue('8,75')
  expect(screen.getByLabelText('Una nota (opcional)')).toHaveValue('Linda')
})

test.each<[TitleErrorKind, string]>([
  ['network', 'No se pudo guardar. Probá de nuevo.'],
  ['not_found', 'Este título ya no está en la lista'],
  ['not_watched', 'Márquenla como vista para puntuarla.'],
])('a %s error shows its message and keeps what was typed', async (kind, text) => {
  api.setMyScore.mockRejectedValue(new TitleError(kind))
  render(<MyScore titleId="t1" current={null} />)
  fireEvent.change(scoreField(), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Una nota (opcional)'), { target: { value: 'ok' } })
  fireEvent.click(save())
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(scoreField()).toHaveValue('7')
  expect(screen.getByLabelText('Una nota (opcional)')).toHaveValue('ok')
})
