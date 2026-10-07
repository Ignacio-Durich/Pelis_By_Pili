import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../features/auth/authApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/auth/authApi')>()),
  getSession: vi.fn().mockResolvedValue({ user: { id: 'u1' } }),
  onAuthChange: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('../features/couple/coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/couple/coupleApi')>()),
  getMyCouple: vi.fn().mockResolvedValue({
    coupleId: 'c1',
    memberCount: 2,
    members: [
      { userId: 'u1', displayName: 'Nacho' },
      { userId: 'u2', displayName: 'Pili' },
    ],
  }),
}))

import { App } from './App'

test('with a session and a couple shows the home', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Pelis By Pili' })).toBeInTheDocument()
  expect(screen.getByText('Nuestra lista está vacía')).toBeInTheDocument()
})
