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
  const low = screen.getByRole('slider', { name: 'Duración mínimo' })
  const high = screen.getByRole('slider', { name: 'Duración máximo' })
  expect(low).toHaveValue('60')
  expect(high).toHaveValue('150')
  expect(low).toHaveAttribute('aria-valuetext', '60 min')
})

test('moving each thumb reports the new range', () => {
  renderSlider()
  fireEvent.change(screen.getByRole('slider', { name: 'Duración mínimo' }), { target: { value: '90' } })
  expect(onChange).toHaveBeenLastCalledWith([90, 150])
  fireEvent.change(screen.getByRole('slider', { name: 'Duración máximo' }), { target: { value: '210' } })
  expect(onChange).toHaveBeenLastCalledWith([60, 210])
})

test('a thumb cannot cross the other one', () => {
  renderSlider()
  fireEvent.change(screen.getByRole('slider', { name: 'Duración mínimo' }), { target: { value: '210' } })
  expect(onChange).toHaveBeenLastCalledWith([150, 150])
  fireEvent.change(screen.getByRole('slider', { name: 'Duración máximo' }), { target: { value: '30' } })
  expect(onChange).toHaveBeenLastCalledWith([60, 60])
})
