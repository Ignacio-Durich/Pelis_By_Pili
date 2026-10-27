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
  localStorage.clear()
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
  render(withCouple(<QuickQuestions onBack={() => {}} />))
  await screen.findByRole('heading', { name: 'Les sugerimos' })
}

test('shows the three questions with Sin apuro and Cualquiera chosen', async () => {
  await renderQuick()
  for (const q of ['¿Cuánto tiempo tienen?', '¿Qué género?', '¿Dónde lo ven?']) expect(screen.getByText(q)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sin apuro' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Cualquiera' })).toHaveAttribute('aria-pressed', 'true')
  // Solo los géneros de lo que tienen por ver, por su nombre.
  for (const g of ['Comedia', 'Documental', 'Drama', 'Terror']) expect(screen.getByRole('button', { name: g })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Western' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prime Video' })).toBeInTheDocument()
})

test('without answers it suggests up to 5 by score', async () => {
  await renderQuick()
  expect(suggested()).toEqual(['Comedia buena', 'Un drama', 'Documental', 'De terror'])
  expect(screen.getAllByText(/^IMDb /)[0]).toHaveTextContent(/^IMDb 9\.0$/)
})

test('choosing a genre reorders, and genres toggle', async () => {
  await renderQuick()
  press('Terror')
  expect(suggested()[0]).toBe('De terror')
  press('Documental')
  expect(screen.getByRole('button', { name: 'Terror' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Documental' })).toHaveAttribute('aria-pressed', 'true')
  press('Terror')
  expect(screen.getByRole('button', { name: 'Terror' })).toHaveAttribute('aria-pressed', 'false')
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

test('with a single genre match it fills and says so', async () => {
  await renderQuick()
  press('Terror')
  expect(screen.getByText('No encontramos 5 de esos géneros; sumamos estas')).toBeInTheDocument()
  expect(suggested()).toHaveLength(4)
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
  press('Terror')
  press('Ver detalle de De terror')
  expect(screen.getByRole('heading', { name: 'De terror' })).toBeInTheDocument()
  expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
  press('Volver')
  expect(screen.getByRole('button', { name: 'Terror' })).toHaveAttribute('aria-pressed', 'true')
  expect(suggested()[0]).toBe('De terror')
  vi.restoreAllMocks()
})

test('offline shows Reintentar', async () => {
  api.listTitles.mockRejectedValueOnce(new TitleError('network')).mockResolvedValueOnce([comedy])
  render(withCouple(<QuickQuestions onBack={() => {}} />))
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
  press('Reintentar')
  expect(await screen.findByText('Comedia buena')).toBeInTheDocument()
})

test('a chosen platform whose titles are gone keeps its chip pressed', async () => {
  await renderQuick()
  press('Prime Video')
  api.listTitles.mockResolvedValue([comedy, horror])
  await act(async () => notify())
  expect(screen.getByRole('button', { name: 'Prime Video' })).toHaveAttribute('aria-pressed', 'true')
  press('Prime Video')
  expect(screen.queryByRole('button', { name: 'Prime Video' })).not.toBeInTheDocument()
  expect(suggested()).toEqual(['Comedia buena', 'De terror'])
})

test('with Por ver empty it says so, not that nothing fits', async () => {
  api.listTitles.mockResolvedValue([])
  await renderQuick()
  expect(screen.getByText('No hay títulos en "Por ver". Agreguen alguno desde la lista.')).toBeInTheDocument()
  expect(screen.queryByText('Ningún título entra en ese tiempo y plataforma')).not.toBeInTheDocument()
})

test('each question groups its chips under its name', async () => {
  await renderQuick()
  for (const name of ['¿Cuánto tiempo tienen?', '¿Qué género?', '¿Dónde lo ven?']) expect(screen.getByRole('group', { name })).toBeInTheDocument()
})
