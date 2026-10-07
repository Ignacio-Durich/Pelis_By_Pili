import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Wheel } from './Wheel'

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `Título ${i}` }))

test('draws one slice per item with its name, up to 12', () => {
  const { container } = render(<Wheel items={items(5)} rotation={0} animate={false} onEnd={vi.fn()} />)
  expect(container.querySelectorAll('[data-slice]')).toHaveLength(5)
  expect(screen.getByText('Título 3')).toBeInTheDocument()
})

test('with more than 12 items it draws only colors', () => {
  const { container } = render(<Wheel items={items(13)} rotation={0} animate={false} onEnd={vi.fn()} />)
  expect(container.querySelectorAll('[data-slice]')).toHaveLength(13)
  expect(screen.queryByText('Título 3')).not.toBeInTheDocument()
})

test('applies the rotation, animates only when asked, and reports the end of the spin', () => {
  const onEnd = vi.fn()
  const { rerender } = render(<Wheel items={items(3)} rotation={0} animate={false} onEnd={onEnd} />)
  const rotor = screen.getByTestId('wheel-rotor')
  expect(rotor.style.transition).toBe('none')
  rerender(<Wheel items={items(3)} rotation={1860} animate onEnd={onEnd} />)
  expect(rotor.style.transform).toBe('rotate(1860deg)')
  expect(rotor.style.transition).toContain('4s')
  fireEvent.transitionEnd(rotor)
  expect(onEnd).toHaveBeenCalledTimes(1)
})

test('has a pointer and an accessible description', () => {
  render(<Wheel items={items(3)} rotation={0} animate={false} onEnd={vi.fn()} />)
  expect(screen.getByRole('img', { name: 'Ruleta con 3 títulos' })).toBeInTheDocument()
})
