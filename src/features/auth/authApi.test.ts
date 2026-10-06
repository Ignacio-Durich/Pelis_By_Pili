import { beforeEach, expect, test, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))

import { AuthError, getSession, requestCode, verifyCode } from './authApi'

const rateLimit = { name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit', message: 'rate' }
const network = { name: 'AuthRetryableFetchError', status: 0, code: undefined, message: 'Failed to fetch' }
const badOtp = { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }

async function kindOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(AuthError)
  return (error as AuthError).kind
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
})

test('requestCode sends the normalized email', async () => {
  await requestCode('  Nacho@Gmail.COM ')
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'nacho@gmail.com' })
})

test('requestCode maps a Supabase rate limit to rate_limited', async () => {
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: rateLimit })
  expect(await kindOf(requestCode('nacho@gmail.com'))).toBe('rate_limited')
})

test('requestCode maps a fetch failure to network', async () => {
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: network })
  expect(await kindOf(requestCode('nacho@gmail.com'))).toBe('network')
})

test('requestCode rejects an implausible email without calling Supabase', async () => {
  expect(await kindOf(requestCode('nacho'))).toBe('invalid_email')
  expect(auth.signInWithOtp).not.toHaveBeenCalled()
})

test('verifyCode sends the normalized email with type email', async () => {
  await verifyCode(' Nacho@Gmail.com', '123456')
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'nacho@gmail.com', token: '123456', type: 'email' })
})

test('verifyCode maps a wrong code to wrong_code', async () => {
  auth.verifyOtp.mockResolvedValue({ data: {}, error: badOtp })
  expect(await kindOf(verifyCode('nacho@gmail.com', '000000'))).toBe('wrong_code')
})

test('verifyCode maps a fetch failure to network', async () => {
  auth.verifyOtp.mockResolvedValue({ data: {}, error: network })
  expect(await kindOf(verifyCode('nacho@gmail.com', '000000'))).toBe('network')
})

test('getSession returns the session or null', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  expect(await getSession()).toEqual({ user: { id: 'u1' } })
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  expect(await getSession()).toBeNull()
})

test('getSession maps a fetch failure to network', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: network })
  expect(await kindOf(getSession())).toBe('network')
})
