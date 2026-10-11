import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { tomas, juli, withCouple } from '../../test/providers'
import { useMemberName } from './coupleContext'

function Names({ ids }: { ids: (string | null)[] }) {
  const nameOf = useMemberName()
  return <p>{ids.map(nameOf).join(', ')}</p>
}

test('useMemberName returns the member name, or alguien when unknown', () => {
  render(withCouple(<Names ids={['u2', 'u1', 'u9', null]} />, [tomas, juli]))
  expect(screen.getByText('Juli, Tomás, alguien, alguien')).toBeInTheDocument()
})
