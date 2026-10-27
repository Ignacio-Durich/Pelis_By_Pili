import { beforeEach, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  return { query, channel, from: vi.fn(), channelFn: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({
  supabase: { from: db.from, channel: db.channelFn, removeChannel: db.removeChannel, rpc: db.rpc },
}))

import { finishReveal, loadOpenReveal, RevealError, startReveal, submitReveal, subscribeReveal } from './revealApi'

beforeEach(() => {
  vi.resetAllMocks()
  db.from.mockReturnValue(db.query)
  db.query.select.mockReturnValue(db.query)
  db.query.eq.mockReturnValue(db.query)
  db.channelFn.mockReturnValue(db.channel)
  db.channel.on.mockReturnValue(db.channel)
  db.channel.subscribe.mockReturnValue(db.channel)
})

const kindOf = (p: Promise<unknown>) => p.then(() => 'ok', (e: RevealError) => e.kind)

test('loadOpenReveal reads the open game of the couple with the picks it is allowed to see', async () => {
  db.query.maybeSingle.mockResolvedValue({
    data: { id: 's1', ready: ['u1'], revealed_at: null, pick_count: 5, reveal_picks: [{ user_id: 'u1', title_ids: ['a', 'b', 'c'] }] },
    error: null,
  })
  expect(await loadOpenReveal('c1')).toEqual({ id: 's1', ready: ['u1'], revealed: false, pickCount: 5, picks: [{ userId: 'u1', titleIds: ['a', 'b', 'c'] }] })
  expect(db.from).toHaveBeenCalledWith('reveal_sessions')
  expect(db.query.eq).toHaveBeenCalledWith('couple_id', 'c1')
  expect(db.query.eq).toHaveBeenCalledWith('status', 'open')
  db.query.maybeSingle.mockResolvedValue({ data: { id: 's1', ready: ['u1', 'u2'], revealed_at: '2026-10-08T20:00:00Z', reveal_picks: [] }, error: null })
  expect((await loadOpenReveal('c1'))?.revealed).toBe(true)
})

test('loadOpenReveal gives null without a game and network on errors', async () => {
  db.query.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect(await loadOpenReveal('c1')).toBeNull()
  db.query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  expect(await kindOf(loadOpenReveal('c1'))).toBe('network')
})

test('each action calls its function with the exact parameters', async () => {
  db.rpc.mockResolvedValue({ data: 's9', error: null })
  expect(await startReveal(5)).toBe('s9')
  expect(db.rpc).toHaveBeenLastCalledWith('start_reveal', { p_pick_count: 5 })
  await submitReveal('s9', ['a', 'b', 'c'])
  expect(db.rpc).toHaveBeenLastCalledWith('submit_reveal', { p_session_id: 's9', p_title_ids: ['a', 'b', 'c'] })
  await finishReveal('s9', 'a')
  expect(db.rpc).toHaveBeenLastCalledWith('finish_reveal', { p_session_id: 's9', p_result_title_id: 'a' })
})

test('function errors keep their code and anything else is network', async () => {
  for (const code of ['closed', 'invalid_picks', 'no_partner', 'not_found', 'not_in_picks']) {
    db.rpc.mockResolvedValue({ data: null, error: { message: code } })
    expect(await kindOf(submitReveal('s', ['a']))).toBe(code)
  }
  db.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  expect(await kindOf(startReveal(3))).toBe('network')
})

test('subscribeReveal listens to the couple games only (picks never travel by Realtime)', () => {
  const onChange = vi.fn()
  const stop = subscribeReveal('c1', onChange)
  const bindings = db.channel.on.mock.calls.filter(([type]) => type === 'postgres_changes').map(([, filter]) => filter)
  expect(bindings).toEqual([
    { event: 'INSERT', schema: 'public', table: 'reveal_sessions', filter: 'couple_id=eq.c1' },
    { event: 'UPDATE', schema: 'public', table: 'reveal_sessions', filter: 'couple_id=eq.c1' },
  ])
  for (const [type, , handler] of db.channel.on.mock.calls) if (type === 'postgres_changes') handler({})
  db.channel.on.mock.calls.find(([type]) => type === 'system')![2]({ extension: 'postgres_changes', status: 'ok' })
  expect(onChange).toHaveBeenCalledTimes(3)
  stop()
  expect(db.removeChannel).toHaveBeenCalledWith(db.channel)
})
