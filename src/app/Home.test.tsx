import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../features/shared/sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/shared/sharedApi')>()),
  listShared: () => Promise.resolve([]),
  subscribeShared: () => () => {},
}))
vi.mock('../features/titles/titlesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/titles/titlesApi')>()),
  listTitles: vi.fn().mockResolvedValue([]),
  subscribeTitles: vi.fn().mockReturnValue(() => {}),
}))

import { tomas, juli, withCouple } from '../test/providers'
import { Home } from './Home'

function renderHome(memberCount: number) {
  render(withCouple(<Home />, memberCount === 1 ? [tomas] : [tomas, juli]))
}

test('the Lista tab shows the title list', async () => {
  renderHome(2)
  expect(screen.getByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Por ver' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Esperando a tu pareja')).not.toBeInTheDocument()
})

test('with one member shows Esperando a tu pareja', () => {
  renderHome(1)
  expect(screen.getByText('Esperando a tu pareja')).toBeInTheDocument()
})

test('the Ajustes tab shows Settings', async () => {
  renderHome(2)
  fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lista' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
  expect(await screen.findByRole('button', { name: 'Por ver' })).toHaveAttribute('aria-pressed', 'true')
})

test('the tab bar has Lista, Descubrir, Elegir and Ajustes in that order', () => {
  renderHome(2)
  const tabs = screen.getByRole('navigation').querySelectorAll('button')
  expect([...tabs].map((b) => b.textContent)).toEqual(['Lista', 'Descubrir', 'Elegir', 'Ajustes'])
})

test('the bottom bar has Lista, Elegir and Ajustes, and filters are shared', async () => {
  renderHome(2)
  for (const name of ['Lista', 'Elegir', 'Ajustes']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
  fireEvent.click(screen.getByRole('button', { name: 'Series' }))
  fireEvent.click(screen.getByRole('button', { name: 'Elegir' }))
  expect(screen.getByRole('heading', { name: 'Elegir' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Ruleta/ }))
  expect(await screen.findByRole('heading', { name: 'Ruleta' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument()
})

test('tapping Lista while inside Agregar or a detail goes back to the list', async () => {
  renderHome(2)
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
  expect(screen.getByRole('heading', { name: 'Agregar' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
  expect(screen.queryByRole('heading', { name: 'Agregar' })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Por ver' })).toHaveAttribute('aria-pressed', 'true')
})
