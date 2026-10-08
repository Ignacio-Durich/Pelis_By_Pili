import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listTitles: vi.fn(), subscribeTitles: vi.fn(), fetchTitleDetail: vi.fn() }))
vi.mock('../titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../titles/titlesApi')>()),
  listTitles: api.listTitles,
  subscribeTitles: api.subscribeTitles,
}))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import { makeTitle } from '../../test/titles'
import { TitleError } from '../titles/titlesApi'
import { QuickQuestions } from './QuickQuestions'

const comedy = makeTitle({ id: 'c', tmdbId: 1, title: 'Comedia buena', genres: ['Comedia'], runtime: 100, streaming: ['Netflix'], imdbRating: '9.0/10' })
const horror = makeTitle({ id: 'h', tmdbId: 2, title: 'De terror', genres: ['Terror'], runtime: 132, streaming: ['Netflix'], imdbRating: '6.0/10' })
const drama = makeTitle({ id: 'd', tmdbId: 3, title: 'Un drama', genres: ['Drama'], runtime: 85, streaming: ['Prime Video'], imdbRating: '8.0/10' })
const doc = makeTitle({ id: 'o', tmdbId: 4, title: 'Documental', genres: ['Documental'], runtime: 90, streaming: ['Prime Video'], imdbRating: '7.0/10' })

let notify: () => void

beforeEach(() => {
  vi.resetAllMocks()
  api.listTitles.mockResolvedValue([comedy, horror, drama, doc])
  api.subscribeTitles.mockImplementation((_id: string, onChange: () => void) => {
    notify = onChange
    return () => {}
  })
  api.fetchTitleDetail.mockReturnValue(new Promise(() => {}))
})

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const suggested = () => [...document.querySelectorAll('[data-testid=suggestion] strong')].map((s) => s.textContent)

async function renderQuick() {
  render(withCouple(<QuickQuestions />))
  await screen.findByRole('heading', { name: 'Les sugerimos' })
}

test('shows the three questions with Sin apuro and Cualquiera chosen', async () => {
  await renderQuick()
  for (const q of ['¿Cuánto tiempo tienen?', '¿Qué ánimo tienen?', '¿Dónde lo ven?']) expect(screen.getByText(q)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sin apuro' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Cualquiera' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '😌 Relax' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Prime Video' })).toBeInTheDocument()
})

test('without answers it suggests the best 3 by score', async () => {
  await renderQuick()
  expect(suggested()).toEqual(['Comedia buena', 'Un drama', 'Documental'])
  expect(screen.getAllByText(/^IMDb /)[0]).toHaveTextContent('IMDb 9.0 · RT —')
})

test('choosing a mood reorders, and moods toggle', async () => {
  await renderQuick()
  press('👻 Miedo')
  expect(suggested()[0]).toBe('De terror')
  press('🧠 Aprender algo')
  expect(screen.getByRole('button', { name: '👻 Miedo' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '🧠 Aprender algo' })).toHaveAttribute('aria-pressed', 'true')
  press('👻 Miedo')
  expect(screen.getByRole('button', { name: '👻 Miedo' })).toHaveAttribute('aria-pressed', 'false')
  expect(suggested()[0]).toBe('Documental')
})

test('time and platform narrow the suggestions', async () => {
  await renderQuick()
  press('Hasta 1 h 30')
  expect(suggested()).not.toContain('Comedia buena')
  expect(suggested()).toEqual(['Un drama', 'Documental'])
  press('Netflix')
  expect(screen.getByText('Ningún título entra en ese tiempo y plataforma')).toBeInTheDocument()
})

test('several platforms can be chosen, and Cualquiera clears them', async () => {
  await renderQuick()
  const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
  press('Hasta 1 h 30')
  press('Netflix')
  press('Prime Video')
  expect([pressed('Netflix'), pressed('Prime Video'), pressed('Cualquiera')]).toEqual(['true', 'true', 'false'])
  expect(suggested()).toEqual(['Un drama', 'Documental'])
  press('Prime Video')
  expect(pressed('Prime Video')).toBe('false')
  expect(screen.getByText('Ningún título entra en ese tiempo y plataforma')).toBeInTheDocument()
  press('Cualquiera')
  expect([pressed('Netflix'), pressed('Cualquiera')]).toEqual(['false', 'true'])
  expect(suggested()).toEqual(['Un drama', 'Documental'])
})

test('with a single mood match it fills and says so', async () => {
  await renderQuick()
  press('👻 Miedo')
  expect(screen.getByText('No encontramos 3 con ese ánimo; sumamos estas')).toBeInTheDocument()
  expect(suggested()).toHaveLength(3)
})

test('a title the partner marks as watched disappears', async () => {
  await renderQuick()
  api.listTitles.mockResolvedValue([{ ...comedy, status: 'watched', watchedAt: '2026-10-07T20:00:00Z' }, horror, drama, doc])
  await act(async () => notify())
  expect(suggested()).not.toContain('Comedia buena')
})

test('Ver detalle opens the detail at the top and Volver comes back to the same answers', async () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
  await renderQuick()
  press('👻 Miedo')
  press('Ver detalle de De terror')
  expect(screen.getByRole('heading', { name: 'De terror' })).toBeInTheDocument()
  expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
  press('Volver')
  expect(screen.getByRole('button', { name: '👻 Miedo' })).toHaveAttribute('aria-pressed', 'true')
  expect(suggested()[0]).toBe('De terror')
  vi.restoreAllMocks()
})

test('offline shows Reintentar', async () => {
  api.listTitles.mockRejectedValueOnce(new TitleError('network')).mockResolvedValueOnce([comedy])
  render(withCouple(<QuickQuestions />))
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  press('Reintentar')
  expect(await screen.findByText('Comedia buena')).toBeInTheDocument()
})
