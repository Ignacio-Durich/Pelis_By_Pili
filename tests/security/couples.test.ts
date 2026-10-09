import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, anonClient, cleanup, createTestUser } from './helpers.ts'

type User = { id: string; client: SupabaseClient }
let A: User, B: User, C: User
let coupleA: string
let tokenA: string

async function rpc(user: User, name: string, args?: Record<string, string>) {
  return user.client.rpc(name, args)
}

beforeAll(async () => {
  ;[A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
})
afterAll(cleanup)

test('create_couple makes the caller a member', async () => {
  const { data, error } = await rpc(A, 'create_couple')
  expect(error).toBeNull()
  coupleA = data
  const { data: rows } = await A.client.from('couple_members').select('couple_id, user_id')
  expect(rows).toEqual([{ couple_id: coupleA, user_id: A.id }])
})

test('create_couple twice fails with already_in_couple', async () => {
  const again = await rpc(A, 'create_couple')
  expect(again.error?.message).toBe('already_in_couple')

  const E = await createTestUser()
  const results = await Promise.all([rpc(E, 'create_couple'), rpc(E, 'create_couple')])
  expect(results.filter((r) => r.error === null)).toHaveLength(1)
  expect(results.filter((r) => r.error?.message === 'already_in_couple')).toHaveLength(1)
  const { data: rows } = await adminClient().from('couple_members').select('couple_id').eq('user_id', E.id)
  expect(rows).toHaveLength(1)
})

test('outsiders see nothing', async () => {
  const { data: invite } = await rpc(A, 'create_invite')
  tokenA = invite
  for (const table of ['couples', 'couple_members', 'invites']) {
    const { data, error } = await B.client.from(table).select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  }
})

test('no direct writes', async () => {
  const insert = await B.client.from('couple_members').insert({ couple_id: coupleA, user_id: B.id })
  expect(insert.error).not.toBeNull()

  const update = await A.client.from('invites').update({ used_at: new Date().toISOString() }).eq('token', tokenA)
  expect(update.error).not.toBeNull()
  const { data } = await adminClient().from('invites').select('used_at').eq('token', tokenA).single()
  expect(data?.used_at).toBeNull()
})

test('accept_invite joins the couple', async () => {
  const { data, error } = await rpc(B, 'accept_invite', { p_token: tokenA })
  expect(error).toBeNull()
  expect(data).toBe(coupleA)
  const { data: rows } = await B.client.from('couple_members').select('user_id')
  expect(rows).toHaveLength(2)
})

test('invite is single use', async () => {
  const { error } = await rpc(C, 'accept_invite', { p_token: tokenA })
  expect(error?.message).toBe('invite_invalid')
})

test('unknown and expired tokens look the same', async () => {
  const unknown = await rpc(C, 'accept_invite', { p_token: 'inventado' })
  expect(unknown.error?.message).toBe('invite_invalid')

  const D = await createTestUser()
  await rpc(D, 'create_couple')
  const { data: token } = await rpc(D, 'create_invite')
  await adminClient().from('invites').update({ expires_at: '2000-01-01T00:00:00Z' }).eq('token', token)
  const expired = await rpc(C, 'accept_invite', { p_token: token })
  expect(expired.error?.message).toBe('invite_invalid')
})

test('a full couple refuses more', async () => {
  const { error } = await rpc(A, 'create_invite')
  expect(error?.message).toBe('couple_full')
})

test('a user already in a couple cannot accept another invite', async () => {
  const F = await createTestUser()
  await rpc(F, 'create_couple')
  const { data: token } = await rpc(F, 'create_invite')
  const { error } = await rpc(B, 'accept_invite', { p_token: token })
  expect(error?.message).toBe('already_in_couple')
  const { data: rows } = await B.client.from('couple_members').select('couple_id')
  expect(rows?.every((r) => r.couple_id === coupleA)).toBe(true)
})

test('a member of another couple sees only their own couple', async () => {
  const G = await createTestUser()
  const { data: coupleG } = await rpc(G, 'create_couple')
  await rpc(G, 'create_invite')
  for (const [table, column] of [['couples', 'id'], ['couple_members', 'couple_id'], ['invites', 'couple_id']]) {
    const { data, error } = await G.client.from(table).select('*')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
    expect(data?.every((row) => row[column] === coupleG)).toBe(true)
  }
})

test('non-members cannot create invites', async () => {
  const { error } = await rpc(C, 'create_invite')
  expect(error?.message).toBe('not_a_member')
})

test('anonymous clients cannot call the functions', async () => {
  const anon = anonClient()
  for (const [name, args] of [['create_couple'], ['create_invite'], ['accept_invite', { p_token: tokenA }]] as const) {
    const { error } = await anon.rpc(name, args)
    expect(error?.code, name).toBe('42501')
  }
  for (const table of ['couples', 'couple_members', 'invites']) {
    const { data, error } = await anon.from(table).select('*')
    expect(error?.code, table).toBe('42501')
    expect(data).toBeNull()
  }
})

test('members cannot delete members or invites directly', async () => {
  const D = await createTestUser()
  const { data: couple } = await rpc(D, 'create_couple')
  const { data: token } = await rpc(D, 'create_invite')
  await D.client.from('couple_members').delete().eq('user_id', D.id)
  await D.client.from('invites').delete().eq('token', token)
  const admin = adminClient()
  expect((await admin.from('couple_members').select('user_id').eq('couple_id', couple)).data).toEqual([{ user_id: D.id }])
  expect((await admin.from('invites').select('token').eq('token', token)).data).toHaveLength(1)
})

test('two people joining with the same invite at once: only one gets in', async () => {
  const [D, E, F] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  const { data: couple } = await rpc(D, 'create_couple')
  const { data: token } = await rpc(D, 'create_invite')
  const results = await Promise.all([rpc(E, 'accept_invite', { p_token: token }), rpc(F, 'accept_invite', { p_token: token })])
  expect(results.filter((r) => r.error === null)).toHaveLength(1)
  expect(['invite_invalid', 'couple_full']).toContain(results.find((r) => r.error)?.error?.message)
  const { data } = await adminClient().from('couple_members').select('user_id').eq('couple_id', couple)
  expect(data).toHaveLength(2)
})
