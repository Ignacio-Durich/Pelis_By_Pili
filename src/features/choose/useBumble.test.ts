import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ loadOpenBumble: vi.fn(), subscribeBumble: vi.fn() }))
vi.mock('./bumbleApi', () => ({ loadOpenBumble: api.loadOpenBumble, subscribeBumble: api.subscribeBumble }))

import { useBumble } from './useBumble'

beforeEach(() => {
  vi.resetAllMocks()
  api.subscribeBumble.mockReturnValue(() => {})
})

test('an older answer arriving last does not overwrite a newer one', async () => {
  let answerOld: (s: unknown) => void = () => {}
  api.loadOpenBumble.mockReturnValueOnce(new Promise((r) => (answerOld = r)))
  const fresh = { id: 's1', deck: ['a', 'b'], votes: [{ userId: 'u2', round: 1, titleId: 'a', liked: true }] }
  api.loadOpenBumble.mockResolvedValueOnce(fresh)
  const { result } = renderHook(() => useBumble('c1'))
  await act(async () => result.current.load())
  expect(result.current.session).toEqual(fresh)
  await act(async () => answerOld({ id: 's1', deck: ['a', 'b'], votes: [] }))
  expect(result.current.session).toEqual(fresh)
})
