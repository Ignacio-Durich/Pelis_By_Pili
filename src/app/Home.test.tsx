import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { CoupleContext } from '../features/couple/coupleContext'
import { Home } from './Home'

function renderHome(memberCount: number) {
  render(
    <CoupleContext.Provider value={{ coupleId: 'c1', memberCount }}>
      <Home />
    </CoupleContext.Provider>,
  )
}

test('the Lista tab shows the empty list and nothing else', () => {
  renderHome(2)
  expect(screen.getByRole('heading', { name: 'Pelis By Pili' })).toBeInTheDocument()
  expect(screen.getByText('Nuestra lista está vacía')).toBeInTheDocument()
  expect(screen.queryByText('Esperando a tu pareja')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument()
})

test('with one member shows Esperando a tu pareja', () => {
  renderHome(1)
  expect(screen.getByText('Esperando a tu pareja')).toBeInTheDocument()
})

test('the Ajustes tab shows Settings', () => {
  renderHome(2)
  fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  expect(screen.queryByText('Nuestra lista está vacía')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
  expect(screen.getByText('Nuestra lista está vacía')).toBeInTheDocument()
})
