import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ dismissShared: vi.fn() }))
vi.mock('./sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sharedApi')>()),
  dismissShared: api.dismissShared,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { withCouple } from '../../test/providers'
import type { SharedItem } from './sharedApi'
import { SharedInbox } from './SharedInbox'

const reel: SharedItem = {
  id: 'i1',
  url: 'https://www.instagram.com/reel/abc/',
  body: null,
  query: 'Parásitos',
  source: 'Instagram',
  sharedBy: 'u2',
  createdAt: '2026-10-08T12:00:00Z',
}
const note: SharedItem = { ...reel, id: 'i2', url: null, source: null, query: null, body: 'La que dijo Juan', sharedBy: 'u1' }

let onSearch: ReturnType<typeof vi.fn<(item: SharedItem) => void>>

beforeEach(() => {
  vi.resetAllMocks()
  onSearch = vi.fn<(item: SharedItem) => void>()
  api.dismissShared.mockResolvedValue(undefined)
})

const renderInbox = (items: SharedItem[]) => render(withCouple(<SharedInbox items={items} onSearch={onSearch} />))

test('an empty inbox shows nothing', () => {
  const { container } = renderInbox([])
  expect(container).toBeEmptyDOMElement()
})

test('it shows how many there are and each item with its name, source, who and link', () => {
  renderInbox([reel, note])
  expect(screen.getByText('📥 Compartidos (2)')).toBeInTheDocument()
  expect(screen.getByText('Parásitos')).toBeInTheDocument()
  expect(screen.getByText('Reel de Instagram · lo compartió Pili')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ver el link' })).toHaveAttribute('href', reel.url)
  expect(screen.getByText('La que dijo Juan')).toBeInTheDocument()
  expect(screen.getByText('lo compartió Nacho')).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
})

test('Agregar hands the item over', () => {
  renderInbox([reel])
  fireEvent.click(screen.getByRole('button', { name: 'Agregar lo compartido' }))
  expect(onSearch).toHaveBeenCalledWith(reel)
  expect(screen.getByRole('button', { name: 'Agregar lo compartido' })).toHaveTextContent('Agregar')
})

test('Descartar removes it, and says so if it fails', async () => {
  renderInbox([reel])
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Descartar' })))
  expect(api.dismissShared).toHaveBeenCalledWith('i1')
  api.dismissShared.mockRejectedValue(new Error('network'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Descartar' })))
  expect(screen.getByText('No se pudo descartar. Probá de nuevo.')).toBeInTheDocument()
})
