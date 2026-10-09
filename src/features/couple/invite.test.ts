import { expect, test } from 'vitest'
import { buildInviteLink, parseInviteToken } from './invite'

test('buildInviteLink puts the token in the invite parameter', () => {
  expect(buildInviteLink('https://pelis.example', 'abc')).toBe('https://pelis.example/?invite=abc')
})

test('parseInviteToken reads the invite parameter', () => {
  expect(parseInviteToken('https://pelis.example/?invite=abc')).toBe('abc')
})

test('parseInviteToken is null without the parameter or with it empty', () => {
  expect(parseInviteToken('https://pelis.example/')).toBeNull()
  expect(parseInviteToken('https://pelis.example/?invite=')).toBeNull()
})

test('a 32-char hex token survives the round trip', () => {
  const token = '0123456789abcdef0123456789abcdef'
  expect(parseInviteToken(buildInviteLink('https://pelis.example', token))).toBe(token)
})

test('parseInviteToken finds the link inside pasted text', () => {
  expect(parseInviteToken('  https://pelis.example/?invite=abc\n')).toBe('abc')
  expect(parseInviteToken('Sumate: https://pelis.example/?invite=abc ❤️')).toBe('abc')
  expect(parseInviteToken('hola')).toBeNull()
})
