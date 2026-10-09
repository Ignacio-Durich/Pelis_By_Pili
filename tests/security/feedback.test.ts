import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User
let couple: string

beforeAll(async () => {
  ;[A, B] = await Promise.all([createTestUser(), createTestUser()])
  couple = await createCouple(A, B)
})
afterAll(cleanup)

const send = (u: User, p_body: string) => u.client.rpc('send_feedback', { p_body, p_user_agent: 'test-agent' })

test('a member sends a comment and it is saved trimmed, with who and where', async () => {
  expect((await send(A, '  La ruleta tarda  ')).error).toBeNull()
  const { data } = await adminClient().from('feedback').select('*').eq('user_id', A.id)
  expect(data).toEqual([expect.objectContaining({ couple_id: couple, body: 'La ruleta tarda', user_agent: 'test-agent' })])
})

test('members cannot read or insert comments directly', async () => {
  const { data } = await A.client.from('feedback').select('*')
  expect(data ?? []).toEqual([])
  const { error } = await A.client.from('feedback').insert({ couple_id: couple, body: 'directo' })
  expect(error?.code).toBe('42501')
})

test('anonymous clients cannot send comments', async () => {
  const { error } = await anonClient().rpc('send_feedback', { p_body: 'hola', p_user_agent: null })
  expect(error).not.toBeNull()
})

test('an account without a couple gets no_couple', async () => {
  const D = await createTestUser()
  expect((await send(D, 'hola')).error?.message).toBe('no_couple')
})

test('empty or too long comments are rejected', async () => {
  for (const body of ['   ', 'x'.repeat(2001)]) expect((await send(A, body)).error?.message).toBe('invalid_feedback')
})

test('after 20 comments in a day the next one is too_many', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ couple_id: couple, user_id: B.id, body: `n${i}` }))
  expect((await adminClient().from('feedback').insert(rows)).error).toBeNull()
  expect((await send(B, 'uno más')).error?.message).toBe('too_many')
})
