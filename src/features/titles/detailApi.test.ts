import { beforeEach, expect, test, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { fetchTitleDetail } from './detailApi'

beforeEach(() => vi.resetAllMocks())

test('calls title-detail and returns the detail', async () => {
  const detail = { overview: 'x', ratings: {}, ratingsStale: false, providers: null }
  invoke.mockResolvedValue({ data: detail, error: null })
  expect(await fetchTitleDetail('t1')).toEqual(detail)
  expect(invoke).toHaveBeenCalledWith('title-detail', { body: { titleId: 't1' } })
})

test('rejects when the function fails', async () => {
  invoke.mockResolvedValue({ data: null, error: new Error('502') })
  await expect(fetchTitleDetail('t1')).rejects.toThrow()
})
