import { beforeEach, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  return { query, channel, from: vi.fn(), channelFn: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({
  supabase: { from: db.from, channel: db.channelFn, removeChannel: db.removeChannel, rpc: db.rpc },
}))

import { BumbleError, bumbleUndo, bumbleVote, finishBumble, loadOpenBumble, startBumble, subscribeBumble } from './bumbleApi'

beforeEach(() => {
  vi.resetAllMocks()
  db.from.mockReturnValue(db.query)
  db.query.select.mockReturnValue(db.query)
  db.query.eq.mockReturnValue(db.query)
  db.channelFn.mockReturnValue(db.channel)
  db.channel.on.mockReturnValue(db.channel)
  db.channel.subscribe.mockReturnValue(db.channel)
})

const kindOf = (p: Promise<unknown>) => p.then(() => 'ok', (e: BumbleError) => e.kind)

test('loadOpenBumble reads the open game of the couple with its votes in order', async () => {
  db.query.maybeSingle.mockResolvedValue({
    data: {
      id: 's1',
      deck: ['a', 'b'],
      bumble_votes: [
        { id: 'v2', user_id: 'u2', round: 1, title_id: 'a', liked: false, created_at: '2026-10-08T12:00:01.000+00:00' },
        { id: 'v1', user_id: 'u1', round: 1, title_id: 'a', liked: true, created_at: '2026-10-08T12:00:00.000+00:00' },
      ],
    },
    error: null,
  })
  expect(await loadOpenBumble('c1')).toEqual({
    id: 's1',
    deck: ['a', 'b'],
    votes: [
      { userId: 'u1', round: 1, titleId: 'a', liked: true },
      { userId: 'u2', round: 1, titleId: 'a', liked: false },
    ],
  })
  expect(db.from).toHaveBeenCalledWith('bumble_sessions')
  expect(db.query.eq).toHaveBeenCalledWith('couple_id', 'c1')
  expect(db.query.eq).toHaveBeenCalledWith('status', 'open')
})

test('loadOpenBumble gives null without an open game and network on errors', async () => {
  db.query.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect(await loadOpenBumble('c1')).toBeNull()
  db.query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  expect(await kindOf(loadOpenBumble('c1'))).toBe('network')
})

test('each action calls its function with the exact parameters', async () => {
  db.rpc.mockResolvedValue({ data: 's9', error: null })
  expect(await startBumble(['a', 'b'])).toBe('s9')
  expect(db.rpc).toHaveBeenLastCalledWith('start_bumble', { p_title_ids: ['a', 'b'] })
  await bumbleVote('s9', 2, 'a', true)
  expect(db.rpc).toHaveBeenLastCalledWith('bumble_vote', { p_session_id: 's9', p_round: 2, p_title_id: 'a', p_liked: true })
  await bumbleUndo('s9')
  expect(db.rpc).toHaveBeenLastCalledWith('bumble_undo', { p_session_id: 's9' })
  await finishBumble('s9', null)
  expect(db.rpc).toHaveBeenLastCalledWith('finish_bumble', { p_session_id: 's9', p_result_title_id: null })
})

test('function errors keep their code and anything else is network', async () => {
  for (const code of ['closed', 'invalid_deck', 'no_partner', 'not_found', 'not_in_deck']) {
    db.rpc.mockResolvedValue({ data: null, error: { message: code } })
    expect(await kindOf(bumbleVote('s', 1, 'a', true))).toBe(code)
  }
  db.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  expect(await kindOf(startBumble(['a', 'b']))).toBe('network')
})

test('subscribeBumble listens to the couple games and votes, and to vote deletes', () => {
  const onChange = vi.fn()
  const stop = subscribeBumble('c1', onChange)
  const bindings = db.channel.on.mock.calls.filter(([type]) => type === 'postgres_changes').map(([, filter]) => filter)
  expect(bindings).toEqual(
    expect.arrayContaining([
      { event: 'INSERT', schema: 'public', table: 'bumble_sessions', filter: 'couple_id=eq.c1' },
      { event: 'UPDATE', schema: 'public', table: 'bumble_sessions', filter: 'couple_id=eq.c1' },
      { event: 'INSERT', schema: 'public', table: 'bumble_votes', filter: 'couple_id=eq.c1' },
      { event: 'DELETE', schema: 'public', table: 'bumble_votes' },
    ]),
  )
  expect(bindings).toHaveLength(4)
  for (const [type, , handler] of db.channel.on.mock.calls) if (type === 'postgres_changes') handler({})
  expect(onChange).toHaveBeenCalledTimes(4)
  const system = db.channel.on.mock.calls.find(([type]) => type === 'system')![2]
  system({ extension: 'postgres_changes', status: 'ok' })
  expect(onChange).toHaveBeenCalledTimes(5)
  stop()
  expect(db.removeChannel).toHaveBeenCalledWith(db.channel)
})
