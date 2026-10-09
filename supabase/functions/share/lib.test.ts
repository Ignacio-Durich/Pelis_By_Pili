import { expect, test } from 'vitest'
import { parseShare } from './lib.ts'

test('an Instagram link loses its tracking and says where it came from', () => {
  expect(parseShare({ shared: 'https://www.instagram.com/reel/C1abc/?igsh=MWQ1ZGUxMzBkMA==', name: '' })).toEqual({
    url: 'https://www.instagram.com/reel/C1abc/',
    body: null,
    query: null,
    source: 'Instagram',
  })
})

test('text around a TikTok link is kept as the body', () => {
  expect(parseShare({ shared: 'Miren esto https://vm.tiktok.com/ZMabc/ 🔥' })).toEqual({
    url: 'https://vm.tiktok.com/ZMabc/',
    body: 'Miren esto 🔥',
    query: null,
    source: 'TikTok',
  })
})

test('known sources and other domains', () => {
  const source = (url: string) => parseShare({ shared: url })?.source
  expect(source('https://youtu.be/xyz?si=abc')).toBe('YouTube')
  expect(source('https://www.youtube.com/shorts/xyz')).toBe('YouTube')
  expect(source('https://x.com/a/status/1')).toBe('X')
  expect(source('https://fb.watch/abc/')).toBe('Facebook')
  expect(source('https://www.threads.com/@a/post/1')).toBe('Threads')
  expect(source('https://www.letterboxd.com/film/dark/')).toBe('letterboxd.com')
  expect(parseShare({ shared: 'https://youtu.be/xyz?si=abc&t=30' })?.url).toBe('https://youtu.be/xyz?t=30')
  expect(parseShare({ shared: 'https://example.com/a?utm_source=x&fbclid=y&share_id=z#top' })?.url).toBe('https://example.com/a')
})

test('text without a link has no url or source', () => {
  expect(parseShare({ shared: 'La peli que dijo Juan' })).toEqual({ url: null, body: 'La peli que dijo Juan', query: null, source: null })
})

test('the typed name is the query; empty or a dash means no name', () => {
  expect(parseShare({ shared: 'https://x.com/a', name: '  Dark  ' })?.query).toBe('Dark')
  expect(parseShare({ shared: 'https://x.com/a', name: '' })?.query).toBeNull()
  expect(parseShare({ shared: 'https://x.com/a', name: ' - ' })?.query).toBeNull()
  expect(parseShare({ name: 'Dark' })).toEqual({ url: null, body: null, query: 'Dark', source: null })
})

test('nothing shared gives null, and long fields are cut', () => {
  expect(parseShare({ shared: '  ', name: '' })).toBeNull()
  expect(parseShare(null)).toBeNull()
  expect(parseShare({ shared: 42 })).toBeNull()
  expect(parseShare({ shared: 'a'.repeat(600) })?.body).toHaveLength(500)
  expect(parseShare({ name: 'b'.repeat(150) })?.query).toHaveLength(100)
})

test('TikTok and YouTube trackers are removed', () => {
  expect(parseShare({ shared: 'https://vm.tiktok.com/x?_t=1&_r=2&is_from_webapp=1&sender_device=pc' })?.url).toBe('https://vm.tiktok.com/x')
  expect(parseShare({ shared: 'https://www.youtube.com/watch?v=abc&pp=x&feature=share' })?.url).toBe('https://www.youtube.com/watch?v=abc')
})

test('punctuation stuck at the end stays out of the link, unless it closes a parenthesis of the link', () => {
  expect(parseShare({ shared: 'mirá (https://a.com/x).' })?.url).toBe('https://a.com/x')
  expect(parseShare({ shared: 'https://a.com/x, buenísima' })?.url).toBe('https://a.com/x')
  expect(parseShare({ shared: 'https://es.wikipedia.org/wiki/Foo_(bar)' })?.url).toBe('https://es.wikipedia.org/wiki/Foo_(bar)')
})

test('a text that repeats the link does not show it raw', () => {
  const item = parseShare({ shared: 'https://www.instagram.com/reel/abc/?igsh=1 Mirá esto https://www.instagram.com/reel/abc/?igsh=1' })
  expect(item?.body).toBe('Mirá esto')
})
