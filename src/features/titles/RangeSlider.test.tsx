import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { RangeSlider } from './RangeSlider'

const onChange = vi.fn()
beforeEach(() => vi.resetAllMocks())

function renderSlider(value: [number, number] = [60, 150]) {
  render(
    <RangeSlider label="Duración" min={0} max={240} step={30} value={value} text="Entre 1 h y 2 h 30" format={(v) => `${v} min`} onChange={onChange} />,
  )
}

test('shows the label, the text and two thumbs', () => {
  renderSlider()
  expect(screen.getByText('Duración')).toBeInTheDocument()
  expect(screen.getByText('Entre 1 h y 2 h 30')).toBeInTheDocument()
  const low = screen.getByRole('slider', { name: 'Duración desde' })
  const high = screen.getByRole('slider', { name: 'Duración hasta' })
  expect(low).toHaveValue('60')
  expect(high).toHaveValue('150')
  expect(low).toHaveAttribute('aria-valuetext', '60 min')
})

test('moving each thumb reports the new range', () => {
  renderSlider()
  fireEvent.change(screen.getByRole('slider', { name: 'Duración desde' }), { target: { value: '90' } })
  expect(onChange).toHaveBeenLastCalledWith([90, 150])
  fireEvent.change(screen.getByRole('slider', { name: 'Duración hasta' }), { target: { value: '210' } })
  expect(onChange).toHaveBeenLastCalledWith([60, 210])
})

test('when both thumbs meet in the upper half the minimum is on top, so it can be dragged back down', () => {
  const { unmount } = render(
    <RangeSlider label="Duración" min={0} max={240} step={30} value={[240, 240]} text="" format={String} onChange={onChange} />,
  )
  const z = (name: string) => Number(screen.getByRole('slider', { name }).style.zIndex || 1)
  expect(z('Duración desde')).toBeGreaterThan(z('Duración hasta'))
  unmount()
  render(<RangeSlider label="Duración" min={0} max={240} step={30} value={[0, 0]} text="" format={String} onChange={onChange} />)
  expect(z('Duración hasta')).toBeGreaterThanOrEqual(z('Duración desde'))
})

test('the range never closes: each thumb stops one step before the other', () => {
  renderSlider([60, 150])
  fireEvent.change(screen.getByRole('slider', { name: 'Duración desde' }), { target: { value: '240' } })
  expect(onChange).toHaveBeenLastCalledWith([120, 150])
  fireEvent.change(screen.getByRole('slider', { name: 'Duración hasta' }), { target: { value: '0' } })
  expect(onChange).toHaveBeenLastCalledWith([60, 90])
})
