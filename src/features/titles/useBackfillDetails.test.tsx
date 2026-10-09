import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchTitleDetail: vi.fn() }))
vi.mock('./detailApi', () => ({ fetchTitleDetail: api.fetchTitleDetail }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import type { Title } from './titlesApi'
import { useBackfillDetails } from './useBackfillDetails'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const title = (id: string, detailsUpdatedAt: string | null) => ({ id, detailsUpdatedAt }) as Title

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchTitleDetail.mockResolvedValue({})
})

test('asks only for titles without data or with data 7 days old or more', async () => {
  renderHook(() => useBackfillDetails([title('a', null), title('b', daysAgo(2)), title('c', daysAgo(8))]))
  await waitFor(() => expect(api.fetchTitleDetail).toHaveBeenCalledTimes(2))
  expect(api.fetchTitleDetail.mock.calls.map(([id]) => id)).toEqual(['a', 'c'])
})

test('goes one at a time', async () => {
  let finish: () => void = () => {}
  api.fetchTitleDetail.mockReturnValueOnce(new Promise<void>((r) => (finish = r)))
  renderHook(() => useBackfillDetails([title('a', null), title('b', null)]))
  await waitFor(() => expect(api.fetchTitleDetail).toHaveBeenCalledTimes(1))
  finish()
  await waitFor(() => expect(api.fetchTitleDetail).toHaveBeenCalledTimes(2))
})

test('asks for at most 30 per mount', async () => {
  const titles = Array.from({ length: 35 }, (_, i) => title(`t${i}`, null))
  renderHook(() => useBackfillDetails(titles))
  await waitFor(() => expect(api.fetchTitleDetail).toHaveBeenCalledTimes(30))
  await new Promise((r) => setTimeout(r, 20))
  expect(api.fetchTitleDetail).toHaveBeenCalledTimes(30)
})

test('does not repeat ids on rerender, and a failure does not stop the rest', async () => {
  api.fetchTitleDetail.mockRejectedValueOnce(new Error('502'))
  const titles = [title('a', null), title('b', null)]
  const { rerender } = renderHook(({ list }) => useBackfillDetails(list), { initialProps: { list: titles } })
  await waitFor(() => expect(api.fetchTitleDetail).toHaveBeenCalledTimes(2))
  rerender({ list: [...titles] })
  await new Promise((r) => setTimeout(r, 20))
  expect(api.fetchTitleDetail).toHaveBeenCalledTimes(2)
})
