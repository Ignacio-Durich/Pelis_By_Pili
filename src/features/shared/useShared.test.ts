import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ listShared: vi.fn(), subscribeShared: vi.fn() }))
vi.mock('./sharedApi', () => ({ listShared: api.listShared, subscribeShared: api.subscribeShared }))

import { useShared } from './useShared'

const item = { id: 'i1', url: null, body: null, query: 'Zodiac', source: null, sharedBy: 'u1', createdAt: '2026-10-08T22:00:00Z' }

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  api.subscribeShared.mockReturnValue(() => {})
})

test('it reloads when the connection comes back', async () => {
  api.listShared.mockResolvedValueOnce([]).mockResolvedValueOnce([item])
  const { result } = renderHook(() => useShared('c1'))
  await act(async () => {})
  expect(result.current.items).toEqual([])
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(result.current.items).toEqual([item])
})

test('without connection it keeps showing the last inbox of that couple', async () => {
  api.listShared.mockResolvedValueOnce([item])
  const first = renderHook(() => useShared('c1'))
  await act(async () => {})
  first.unmount()
  api.listShared.mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useShared('c1'))
  await act(async () => {})
  expect(result.current.items).toEqual([item])
  const other = renderHook(() => useShared('c9'))
  await act(async () => {})
  expect(other.result.current.items).toBeNull()
})
