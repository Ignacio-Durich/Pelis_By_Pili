import { beforeEach, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn(), from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: db.rpc, from: db.from } }))

import { acceptInvite, CoupleError, createCouple, createInvite, getMyCouple } from './coupleApi'

beforeEach(() => {
  vi.resetAllMocks()
  db.from.mockReturnValue({ select: db.select })
})

async function kindOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(CoupleError)
  return (error as CoupleError).kind
}

test('getMyCouple is null without rows', async () => {
  db.select.mockResolvedValue({ data: [], error: null })
  expect(await getMyCouple()).toBeNull()
  expect(db.from).toHaveBeenCalledWith('couple_members')
})

test('getMyCouple counts the members of the couple', async () => {
  db.select.mockResolvedValue({ data: [{ couple_id: 'c1' }, { couple_id: 'c1' }], error: null })
  expect(await getMyCouple()).toEqual({ coupleId: 'c1', memberCount: 2 })
})

test('getMyCouple maps a fetch failure to network', async () => {
  db.select.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
  expect(await kindOf(getMyCouple())).toBe('network')
})

test('createCouple, createInvite and acceptInvite return the RPC result', async () => {
  db.rpc.mockResolvedValue({ data: 'value', error: null })
  expect(await createCouple()).toBe('value')
  expect(db.rpc.mock.lastCall?.[0]).toBe('create_couple')
  expect(await createInvite()).toBe('value')
  expect(db.rpc.mock.lastCall?.[0]).toBe('create_invite')
  expect(await acceptInvite('abc')).toBe('value')
  expect(db.rpc).toHaveBeenLastCalledWith('accept_invite', { p_token: 'abc' })
})

test.each(['already_in_couple', 'couple_full', 'invite_invalid', 'not_a_member'])(
  'the Postgres error %s keeps its kind',
  async (code) => {
    db.rpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } })
    expect(await kindOf(acceptInvite('abc'))).toBe(code)
  },
)

test('an unknown message is network', async () => {
  db.rpc.mockResolvedValue({ data: null, error: { message: 'something else' } })
  expect(await kindOf(createCouple())).toBe('network')
})
