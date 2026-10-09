import { beforeEach, expect, test, vi } from 'vitest'
import { makeTitle } from '../test/titles'
import { applyPending, clearCaches, clearDropped, droppedFor, enqueue, flushPending, pendingFor, readCache, saveCache, subscribePending, type Pending } from './offline'

beforeEach(() => {
  localStorage.clear()
  clearDropped('o')
})

const network = new Error('Failed to fetch')
const isNetwork = (e: unknown) => e === network

test('the cache belongs to its owner', () => {
  saveCache('titles', 'c1', [1, 2])
  expect(readCache('titles', 'c1')).toEqual([1, 2])
  expect(readCache('titles', 'c2')).toBeNull()
  localStorage.setItem('pelis-cache:titles', '{roto')
  expect(readCache('titles', 'c1')).toBeNull()
})

test('the queue keeps its order, belongs to its owner and tells subscribers', () => {
  const heard = vi.fn()
  const stop = subscribePending(heard)
  enqueue('u1:c1', { kind: 'watched', titleId: 't1', watched: true })
  enqueue('u1:c1', { kind: 'score', titleId: 't1', score: 8, note: '' })
  expect(pendingFor('u1:c1').map((p) => p.kind)).toEqual(['watched', 'score'])
  expect(pendingFor('u2:c1')).toEqual([])
  expect(heard).toHaveBeenCalledTimes(2)
  stop()
})

test('flush sends in order and empties the queue', async () => {
  enqueue('o', { kind: 'watched', titleId: 't1', watched: true })
  enqueue('o', { kind: 'score', titleId: 't1', score: 8, note: 'buena' })
  const sent: string[] = []
  const result = await flushPending('o', async (p) => void sent.push(p.kind), isNetwork)
  expect(sent).toEqual(['watched', 'score'])
  expect(result).toEqual({ sent: 2, dropped: [] })
  expect(pendingFor('o')).toEqual([])
})

test('a network error stops and keeps the rest; another error drops only that one', async () => {
  enqueue('o', { kind: 'later', query: 'Dark', note: '' })
  enqueue('o', { kind: 'watched', titleId: 'gone', watched: true })
  enqueue('o', { kind: 'later', query: 'Oldboy', note: '' })
  const notFound = new Error('not_found')
  const send = vi.fn(async (p: Pending) => {
    if (p.kind === 'watched') throw notFound
    if (p.kind === 'later' && p.query === 'Oldboy') throw network
  })
  const result = await flushPending('o', send, isNetwork)
  expect(result.sent).toBe(1)
  expect(result.dropped.map((d) => [d.item.kind, d.error])).toEqual([['watched', notFound]])
  expect(pendingFor('o').map((p) => p.kind === 'later' && p.query)).toEqual(['Oldboy'])
})

test('two flushes at once send each item once', async () => {
  enqueue('o', { kind: 'later', query: 'Dark', note: '' })
  enqueue('o', { kind: 'later', query: 'Oldboy', note: '' })
  const send = vi.fn(() => new Promise<void>((r) => setTimeout(r, 5)))
  await Promise.all([flushPending('o', send, isNetwork), flushPending('o', send, isNetwork)])
  expect(send).toHaveBeenCalledTimes(2)
})

test('applyPending shows watched and the own score as pending', () => {
  const t = makeTitle({ id: 't1', scores: [{ userId: 'u2', score: 7, note: null, updatedAt: '2026-10-08T00:00:00Z' }] })
  const other = makeTitle({ id: 't2' })
  const pending: Pending[] = [
    { id: 'p1', kind: 'watched', titleId: 't1', watched: true },
    { id: 'p2', kind: 'score', titleId: 't1', score: 8.5, note: 'linda' },
    { id: 'p3', kind: 'later', query: 'Dark', note: '' },
  ]
  const [shown, untouched] = applyPending([t, other], pending, 'u1')
  expect(shown.status).toBe('watched')
  expect(shown.watchedAt).not.toBeNull()
  expect(shown.pending).toBe(true)
  expect(shown.scores.map((s) => [s.userId, s.score])).toEqual([
    ['u2', 7],
    ['u1', 8.5],
  ])
  expect(untouched.pending).toBeUndefined()
  const unwatched = applyPending([{ ...t, status: 'watched', watchedAt: '2026-10-08T00:00:00Z' }], [{ id: 'p', kind: 'watched', titleId: 't1', watched: false }], 'u1')[0]
  expect([unwatched.status, unwatched.watchedAt]).toEqual(['to_watch', null])
})

test('dropped changes are kept for their owner until cleared, and subscribers hear it', async () => {
  const heard = vi.fn()
  const stop = subscribePending(heard)
  enqueue('o', { kind: 'watched', titleId: 'gone', watched: true })
  await flushPending('o', async () => {
    throw new Error('not_found')
  }, isNetwork)
  expect(droppedFor('o').map((d) => d.item.kind)).toEqual(['watched'])
  expect(droppedFor('otro')).toEqual([])
  clearDropped('o')
  expect(droppedFor('o')).toEqual([])
  expect(heard).toHaveBeenCalled()
  stop()
})

test('a change that keeps failing as if there were no connection is dropped after 20 tries, and the next one goes', async () => {
  enqueue('o', { kind: 'watched', titleId: 'stuck', watched: true })
  enqueue('o', { kind: 'watched', titleId: 'next', watched: true })
  const sent: string[] = []
  const send = async (p: Pending) => {
    if (p.kind === 'watched' && p.titleId === 'stuck') throw network
    sent.push(p.kind === 'watched' ? p.titleId : '')
  }
  for (let i = 0; i < 19; i++) await flushPending('o', send, isNetwork)
  expect(pendingFor('o')).toHaveLength(2)
  const last = await flushPending('o', send, isNetwork)
  expect(last.dropped.map((d) => d.item.kind === 'watched' && d.item.titleId)).toEqual(['stuck'])
  expect(sent).toEqual(['next'])
  expect(pendingFor('o')).toEqual([])
})

test('clearCaches forgets what was saved but keeps what is waiting to be sent', () => {
  saveCache('titles', 'c1', [makeTitle()])
  saveCache('couple', 'u1', { coupleId: 'c1' })
  enqueue('u1:c1', { kind: 'later', query: 'Dark', note: '' })
  clearCaches()
  expect(readCache('titles', 'c1')).toBeNull()
  expect(readCache('couple', 'u1')).toBeNull()
  expect(pendingFor('u1:c1')).toHaveLength(1)
})
