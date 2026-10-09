import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ sendFeedback: vi.fn() }))
vi.mock('./feedbackApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./feedbackApi')>()), sendFeedback: api.sendFeedback }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { Feedback } from './Feedback'
import { FeedbackError } from './feedbackApi'

beforeEach(() => vi.resetAllMocks())

const box = () => screen.getByRole('textbox', { name: 'Comentario' })
const mandar = () => screen.getByRole('button', { name: 'Mandar' })

test('Mandar is disabled while the box is empty', () => {
  render(<Feedback />)
  expect(mandar()).toBeDisabled()
  fireEvent.change(box(), { target: { value: '   ' } })
  expect(mandar()).toBeDisabled()
})

test('sending thanks and empties the box', async () => {
  api.sendFeedback.mockResolvedValue(undefined)
  render(<Feedback />)
  fireEvent.change(box(), { target: { value: 'La ruleta tarda' } })
  fireEvent.click(mandar())
  expect(await screen.findByText('¡Gracias! Nacho lo va a leer.')).toHaveAttribute('role', 'status')
  expect(api.sendFeedback).toHaveBeenCalledWith('La ruleta tarda')
  expect(box()).toHaveValue('')
})

test('too many in a day says so', async () => {
  api.sendFeedback.mockRejectedValue(new FeedbackError('too_many'))
  render(<Feedback />)
  fireEvent.change(box(), { target: { value: 'otra' } })
  fireEvent.click(mandar())
  expect(await screen.findByText('Mandaste muchos hoy. Probá mañana.')).toBeInTheDocument()
})

test('a network failure keeps the text', async () => {
  api.sendFeedback.mockRejectedValue(new FeedbackError('network'))
  render(<Feedback />)
  fireEvent.change(box(), { target: { value: 'sin red' } })
  fireEvent.click(mandar())
  expect(await screen.findByText('No se pudo mandar. Probá de nuevo.')).toBeInTheDocument()
  expect(box()).toHaveValue('sin red')
})
