import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { anonClient, cleanup, createCouple, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User, C: User

async function nameOf(reader: User, user: User) {
  const { data } = await reader.client.from('couple_members').select('display_name').eq('user_id', user.id).maybeSingle()
  return data?.display_name
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  await createCouple(A, B)
  await createCouple(C)
})
afterAll(cleanup)

test('a member sets their own name and the partner reads it', async () => {
  const { error } = await A.client.rpc('set_display_name', { p_name: '  Nacho ' })
  expect(error).toBeNull()
  expect(await nameOf(B, A)).toBe('Nacho')
})

test("the name only changes the caller's row", async () => {
  await B.client.rpc('set_display_name', { p_name: 'Pili' })
  expect(await nameOf(A, B)).toBe('Pili')
  expect(await nameOf(A, A)).toBe('Nacho')
})

test('invalid names are rejected', async () => {
  for (const p_name of ['', '   ', 'x'.repeat(31)]) {
    const { error } = await A.client.rpc('set_display_name', { p_name })
    expect(error?.message).toBe('invalid_name')
  }
  expect(await nameOf(A, A)).toBe('Nacho')
})

test('non-members cannot set a name', async () => {
  const D = await createTestUser()
  const { error } = await D.client.rpc('set_display_name', { p_name: 'Nadie' })
  expect(error?.message).toBe('not_a_member')
})

test('outsiders cannot read names', async () => {
  expect(await nameOf(C, A)).toBeUndefined()
})

test('no direct updates', async () => {
  const { error } = await A.client.from('couple_members').update({ display_name: 'Otro' }).eq('user_id', A.id)
  expect(error).not.toBeNull()
  expect(await nameOf(B, A)).toBe('Nacho')
})

test('anonymous clients cannot call set_display_name', async () => {
  const { error } = await anonClient().rpc('set_display_name', { p_name: 'Anon' })
  expect(error).not.toBeNull()
})
