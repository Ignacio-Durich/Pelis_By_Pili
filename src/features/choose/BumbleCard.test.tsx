import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchTitleDetail: vi.fn() }))
vi.mock('../titles/detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))

import { makeTitle } from '../../test/titles'
import { BumbleCard } from './BumbleCard'

const dark = makeTitle({
  id: 'd',
  title: 'Dark',
  year: 2017,
  mediaType: 'tv',
  runtime: 60,
  genres: ['Crimen', 'Drama', 'Misterio', 'Sci-Fi & Fantasy'],
  imdbRating: '8.7/10',
  rottenTomatoes: '95%',
  streaming: ['Netflix', 'Prime Video'],
})
const other = makeTitle({ id: 'o', title: 'Otra', streaming: [] })

let onVote: ReturnType<typeof vi.fn<(liked: boolean) => void>>

beforeEach(() => {
  vi.resetAllMocks()
  onVote = vi.fn<(liked: boolean) => void>()
  api.fetchTitleDetail.mockResolvedValue({ overview: 'Un chico desaparece en Winden.', ratings: {}, ratingsStale: false, providers: null })
})

const card = () => screen.getByTestId('bumble-card')
function drag(to: number) {
  fireEvent.pointerDown(card(), { clientX: 0, pointerId: 1 })
  fireEvent.pointerMove(card(), { clientX: to, pointerId: 1 })
  fireEvent.pointerUp(card(), { clientX: to, pointerId: 1 })
}
const tap = () => drag(0)

test('the front shows the title data like a dating app card', () => {
  render(<BumbleCard title={dark} onVote={onVote} />)
  expect(screen.getByText('Dark')).toBeInTheDocument()
  expect(screen.getByText('2017 · Serie · 1 h')).toBeInTheDocument()
  expect(screen.getByText('Crimen · Drama · Misterio')).toBeInTheDocument()
  expect(screen.getByText('IMDb 8.7 · RT 95%')).toBeInTheDocument()
  expect(screen.getByText('Netflix, Prime Video')).toBeInTheDocument()
})

test('without platforms it says so', () => {
  render(<BumbleCard title={other} onVote={onVote} />)
  expect(screen.getByText('Sin información de dónde verla')).toBeInTheDocument()
})

test('the buttons vote', () => {
  render(<BumbleCard title={dark} onVote={onVote} />)
  fireEvent.click(screen.getByRole('button', { name: '👍 Sí' }))
  fireEvent.click(screen.getByRole('button', { name: '👎 No' }))
  expect(onVote.mock.calls).toEqual([[true], [false]])
})

test('dragging far votes, a short drag neither votes nor flips', () => {
  render(<BumbleCard title={dark} onVote={onVote} />)
  drag(150)
  drag(-150)
  expect(onVote.mock.calls).toEqual([[true], [false]])
  drag(50)
  expect(onVote).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Sinopsis')).not.toBeInTheDocument()
  expect(api.fetchTitleDetail).not.toHaveBeenCalled()
})

test('a tap flips the card to the synopsis, loaded once, and another tap flips back', async () => {
  render(<BumbleCard title={dark} onVote={onVote} />)
  tap()
  expect(screen.getByText('Sinopsis')).toBeInTheDocument()
  expect(await screen.findByText('Un chico desaparece en Winden.')).toBeInTheDocument()
  tap()
  expect(screen.queryByText('Sinopsis')).not.toBeInTheDocument()
  tap()
  expect(screen.getByText('Un chico desaparece en Winden.')).toBeInTheDocument()
  expect(api.fetchTitleDetail).toHaveBeenCalledTimes(1)
  expect(api.fetchTitleDetail).toHaveBeenCalledWith('d')
  expect(onVote).not.toHaveBeenCalled()
})

test('if the synopsis fails it says so', async () => {
  api.fetchTitleDetail.mockRejectedValue(new Error('detail_failed'))
  render(<BumbleCard title={dark} onVote={onVote} />)
  tap()
  expect(await screen.findByText('No se pudo cargar la sinopsis')).toBeInTheDocument()
})

test('a new card starts face up', async () => {
  const { rerender } = render(<BumbleCard title={dark} onVote={onVote} />)
  tap()
  await act(async () => {})
  rerender(<BumbleCard title={other} onVote={onVote} />)
  expect(screen.queryByText('Sinopsis')).not.toBeInTheDocument()
  expect(screen.getByText('Otra')).toBeInTheDocument()
})
