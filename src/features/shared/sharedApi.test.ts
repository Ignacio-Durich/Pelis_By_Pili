import { beforeEach, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), delete: vi.fn() }
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  return { query, channel, from: vi.fn(), channelFn: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({
  supabase: { from: db.from, channel: db.channelFn, removeChannel: db.removeChannel, rpc: db.rpc },
}))

import { createShareKey, dismissShared, listShared, originNote, shareKeyCreatedAt, sourceLabel, subscribeShared, type SharedItem } from './sharedApi'

beforeEach(() => {
  vi.resetAllMocks()
  db.from.mockReturnValue(db.query)
  db.query.select.mockReturnValue(db.query)
  db.query.delete.mockReturnValue(db.query)
  db.query.eq.mockReturnValue(db.query)
  db.channelFn.mockReturnValue(db.channel)
  db.channel.on.mockReturnValue(db.channel)
  db.channel.subscribe.mockReturnValue(db.channel)
})

const item = (over: Partial<SharedItem>): SharedItem => ({
  id: 'i1',
  url: 'https://www.instagram.com/reel/abc/',
  body: null,
  query: null,
  source: 'Instagram',
  sharedBy: 'u2',
  createdAt: '2026-10-08T12:00:00Z',
  ...over,
})

test('listShared reads the couple inbox, newest first', async () => {
  db.query.order.mockResolvedValue({
    data: [{ id: 'i1', url: 'https://x.com/a', body: 'hola', query: 'Dark', source: 'X', shared_by: 'u2', created_at: '2026-10-08T12:00:00Z' }],
    error: null,
  })
  expect(await listShared('c1')).toEqual([item({ url: 'https://x.com/a', body: 'hola', query: 'Dark', source: 'X' })])
  expect(db.from).toHaveBeenCalledWith('shared_items')
  expect(db.query.eq).toHaveBeenCalledWith('couple_id', 'c1')
  expect(db.query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  db.query.order.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  await expect(listShared('c1')).rejects.toThrow('network')
})

test('dismissShared deletes by id', async () => {
  db.query.eq.mockResolvedValueOnce({ error: null })
  await dismissShared('i1')
  expect(db.query.delete).toHaveBeenCalled()
  expect(db.query.eq).toHaveBeenCalledWith('id', 'i1')
  db.query.eq.mockResolvedValueOnce({ error: { message: 'Failed to fetch' } })
  await expect(dismissShared('i1')).rejects.toThrow('network')
})

test('the key functions call their rpc', async () => {
  db.rpc.mockResolvedValueOnce({ data: 'a'.repeat(48), error: null })
  expect(await createShareKey()).toBe('a'.repeat(48))
  expect(db.rpc).toHaveBeenLastCalledWith('create_share_key')
  db.rpc.mockResolvedValueOnce({ data: null, error: null })
  expect(await shareKeyCreatedAt()).toBeNull()
  expect(db.rpc).toHaveBeenLastCalledWith('share_key_created_at')
  db.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
  await expect(createShareKey()).rejects.toThrow('network')
})

test('subscribeShared listens to the couple inserts and to deletes', () => {
  const onChange = vi.fn()
  const stop = subscribeShared('c1', onChange)
  const bindings = db.channel.on.mock.calls.filter(([type]) => type === 'postgres_changes').map(([, filter]) => filter)
  expect(bindings).toEqual([
    { event: 'INSERT', schema: 'public', table: 'shared_items', filter: 'couple_id=eq.c1' },
    { event: 'DELETE', schema: 'public', table: 'shared_items' },
  ])
  for (const [type, , handler] of db.channel.on.mock.calls) if (type === 'postgres_changes') handler({})
  db.channel.on.mock.calls.find(([type]) => type === 'system')![2]({ extension: 'postgres_changes', status: 'ok' })
  expect(onChange).toHaveBeenCalledTimes(3)
  stop()
  expect(db.removeChannel).toHaveBeenCalledWith(db.channel)
})

test('sourceLabel and originNote say where it came from', () => {
  expect(sourceLabel(item({}))).toBe('Reel de Instagram')
  expect(originNote(item({}))).toBe('Reel de Instagram · https://www.instagram.com/reel/abc/')
  expect(originNote(item({ url: 'https://vm.tiktok.com/x/', source: 'TikTok' }))).toBe('Video de TikTok · https://vm.tiktok.com/x/')
  expect(originNote(item({ url: 'https://youtu.be/x', source: 'YouTube' }))).toBe('Video de YouTube · https://youtu.be/x')
  expect(originNote(item({ url: 'https://letterboxd.com/f/', source: 'letterboxd.com' }))).toBe('Post de letterboxd.com · https://letterboxd.com/f/')
  expect(sourceLabel(item({ url: null, source: null, body: 'La que dijo Juan' }))).toBeNull()
  expect(originNote(item({ url: null, source: null, body: 'La que dijo Juan' }))).toBe('La que dijo Juan')
  expect(originNote(item({ url: null, source: null, body: 'x'.repeat(300) }))).toHaveLength(200)
  expect(originNote(item({ url: `https://www.instagram.com/reel/${'a'.repeat(190)}/` }))).toBe('Reel de Instagram')
  expect(originNote(item({ url: null, source: null, body: null, query: 'Dark' }))).toBe('')
})
