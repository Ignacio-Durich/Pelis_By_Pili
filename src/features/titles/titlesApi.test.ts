import { beforeEach, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
  }
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  return { query, channel, from: vi.fn(), channelFn: vi.fn(), removeChannel: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({
  supabase: { from: db.from, channel: db.channelFn, removeChannel: db.removeChannel },
}))

import type { SearchResult } from '../../../supabase/functions/tmdb-search/lib.ts'
import { addTitle, listTitles, removeTitle, subscribeTitles, TitleError } from './titlesApi'

const row = {
  id: 't1',
  tmdb_id: 771,
  media_type: 'movie',
  title: 'Mi pobre angelito',
  original_title: 'Home Alone',
  year: 1990,
  poster_path: '/h.jpg',
  origin_note: 'un reel',
  added_by: 'u2',
  created_at: '2026-10-07T12:00:00Z',
  imdb_rating: '7.7/10',
  rotten_tomatoes: '67%',
  metacritic: null,
  tmdb_rating: 7.4,
  ratings_updated_at: '2026-10-07T13:00:00Z',
}
const result: SearchResult = {
  tmdbId: 771,
  mediaType: 'movie',
  title: 'Mi pobre angelito',
  originalTitle: 'Home Alone',
  year: 1990,
  posterPath: '/h.jpg',
  overview: '…',
}

beforeEach(() => {
  vi.resetAllMocks()
  db.from.mockReturnValue(db.query)
  db.query.select.mockReturnValue(db.query)
  db.query.eq.mockReturnValue(db.query)
  db.query.delete.mockReturnValue(db.query)
  db.query.insert.mockReturnValue(db.query)
  db.channelFn.mockReturnValue(db.channel)
  db.channel.on.mockReturnValue(db.channel)
  db.channel.subscribe.mockReturnValue(db.channel)
})

async function kindOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(TitleError)
  return (error as TitleError).kind
}

test('listTitles maps the rows, filters by couple and orders newest first', async () => {
  db.query.order.mockResolvedValue({ data: [row], error: null })
  expect(await listTitles('c1')).toEqual([
    {
      id: 't1',
      tmdbId: 771,
      mediaType: 'movie',
      title: 'Mi pobre angelito',
      originalTitle: 'Home Alone',
      year: 1990,
      posterPath: '/h.jpg',
      originNote: 'un reel',
      addedBy: 'u2',
      createdAt: '2026-10-07T12:00:00Z',
      imdbRating: '7.7/10',
      rottenTomatoes: '67%',
      metacritic: null,
      tmdbRating: 7.4,
      ratingsUpdatedAt: '2026-10-07T13:00:00Z',
    },
  ])
  expect(db.from).toHaveBeenCalledWith('titles')
  expect(db.query.eq).toHaveBeenCalledWith('couple_id', 'c1')
  expect(db.query.order).toHaveBeenCalledWith('created_at', { ascending: false })
})

test('listTitles maps any error to network', async () => {
  db.query.order.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
  expect(await kindOf(listTitles('c1'))).toBe('network')
})

test('addTitle inserts the result with the trimmed note and returns the new id', async () => {
  db.query.single.mockResolvedValue({ data: { id: 't9' }, error: null })
  expect(await addTitle('c1', result, '  un reel ')).toBe('t9')
  expect(db.query.select).toHaveBeenCalledWith('id')
  expect(db.query.insert).toHaveBeenCalledWith({
    couple_id: 'c1',
    tmdb_id: 771,
    media_type: 'movie',
    title: 'Mi pobre angelito',
    original_title: 'Home Alone',
    year: 1990,
    poster_path: '/h.jpg',
    origin_note: 'un reel',
  })
})

test('a blank note is sent as null', async () => {
  db.query.single.mockResolvedValue({ data: { id: 't9' }, error: null })
  await addTitle('c1', result, '   ')
  expect(db.query.insert.mock.lastCall?.[0].origin_note).toBeNull()
})

test('addTitle maps 23505 to duplicate and anything else to network', async () => {
  db.query.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
  expect(await kindOf(addTitle('c1', result, ''))).toBe('duplicate')
  db.query.single.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
  expect(await kindOf(addTitle('c1', result, ''))).toBe('network')
})

test('removeTitle deletes by id and maps errors to network', async () => {
  db.query.eq.mockResolvedValueOnce({ error: null })
  await removeTitle('t1')
  expect(db.query.delete).toHaveBeenCalled()
  expect(db.query.eq).toHaveBeenCalledWith('id', 't1')
  db.query.eq.mockResolvedValueOnce({ error: { message: 'Failed to fetch' } })
  expect(await kindOf(removeTitle('t1'))).toBe('network')
})

test('subscribeTitles listens to filtered inserts and unfiltered deletes', () => {
  const onChange = vi.fn()
  const stop = subscribeTitles('c1', onChange)
  const bindings = db.channel.on.mock.calls.filter(([type]) => type === 'postgres_changes').map(([, filter]) => filter)
  expect(bindings).toContainEqual({ event: 'INSERT', schema: 'public', table: 'titles', filter: 'couple_id=eq.c1' })
  expect(bindings).toContainEqual({ event: 'DELETE', schema: 'public', table: 'titles' })
  expect(bindings).toContainEqual({ event: 'UPDATE', schema: 'public', table: 'titles', filter: 'couple_id=eq.c1' })
  for (const [type, , handler] of db.channel.on.mock.calls) if (type === 'postgres_changes') handler({})
  expect(onChange).toHaveBeenCalledTimes(3)
  stop()
  expect(db.removeChannel).toHaveBeenCalledWith(db.channel)
})

test('reloads when the server is listening to the database, not merely when the channel joins', () => {
  const onChange = vi.fn()
  subscribeTitles('c1', onChange)
  const system = db.channel.on.mock.calls.find(([type]) => type === 'system')?.[2]
  system({ extension: 'postgres_changes', status: 'error', message: 'falló' })
  expect(onChange).not.toHaveBeenCalled()
  system({ extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' })
  expect(onChange).toHaveBeenCalledTimes(1)
})
