import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useOnline } from './useOnline'

const setOnLine = (value: boolean) => Object.defineProperty(navigator, 'onLine', { value, configurable: true })

test('follows the browser connection and stops listening on unmount', () => {
  setOnLine(true)
  const { result, unmount } = renderHook(() => useOnline())
  expect(result.current).toBe(true)
  setOnLine(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
  expect(result.current).toBe(false)
  unmount()
  setOnLine(true)
  window.dispatchEvent(new Event('online'))
  expect(result.current).toBe(false)
})
