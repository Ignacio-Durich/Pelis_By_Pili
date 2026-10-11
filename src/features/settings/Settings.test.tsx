import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ createInvite: vi.fn(), signOut: vi.fn(), writeText: vi.fn(), createShareKey: vi.fn(), shareKeyCreatedAt: vi.fn() }))
vi.mock('../couple/coupleApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../couple/coupleApi')>()),
  createInvite: api.createInvite,
}))
vi.mock('../auth/authApi', () => ({ signOut: api.signOut }))
vi.mock('../shared/sharedApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/sharedApi')>()),
  createShareKey: api.createShareKey,
  shareKeyCreatedAt: api.shareKeyCreatedAt,
}))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { tomas, juli, withCouple } from '../../test/providers'
import { savedTheme } from '../../lib/theme'
import { SHARE_URL } from '../shared/sharedApi'
import { Settings } from './Settings'

function renderSettings(memberCount: number) {
  render(withCouple(<Settings />, memberCount === 1 ? [tomas] : [juli, tomas]))
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: api.writeText }, configurable: true })
  api.writeText.mockResolvedValue(undefined)
  api.shareKeyCreatedAt.mockResolvedValue(null)
})

test('with one member, Invitar a mi pareja shows a copyable link', async () => {
  api.createInvite.mockResolvedValue('tok123')
  renderSettings(1)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a mi pareja' }))
  const link = `${window.location.origin}/?invite=tok123`
  expect(await screen.findByDisplayValue(link)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
  expect(api.writeText).toHaveBeenCalledWith(link)
})

test('a failed invite shows its message', async () => {
  const { CoupleError } = await import('../couple/coupleApi')
  api.createInvite.mockRejectedValue(new CoupleError('network'))
  renderSettings(1)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a mi pareja' }))
  expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
})

test('with two members there is no invite button', () => {
  renderSettings(2)
  expect(screen.queryByRole('button', { name: 'Invitar a mi pareja' })).not.toBeInTheDocument()
  expect(screen.getByText(/^Son dos personas en este espacio/)).toBeInTheDocument()
})

test('Cerrar sesión calls signOut', () => {
  renderSettings(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(api.signOut).toHaveBeenCalled()
})

test('with two members names both, mine first', () => {
  renderSettings(2)
  expect(screen.getByText('Son dos personas en este espacio: Tomás y Juli')).toBeInTheDocument()
})

test('a missing name is left out', () => {
  render(withCouple(<Settings />, [tomas, { userId: 'u2', displayName: null }]))
  expect(screen.getByText('Son dos personas en este espacio')).toBeInTheDocument()
})

test('shows the TMDB attribution', () => {
  renderSettings(2)
  expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeInTheDocument()
})

test('shows the TMDB logo, JustWatch and OMDb attributions', () => {
  renderSettings(2)
  expect(screen.getByAltText('TMDB')).toHaveAttribute('src', '/tmdb-logo.svg')
  expect(screen.getByText('Datos de dónde ver cada título: JustWatch.')).toBeInTheDocument()
  expect(
    screen.getByText('Puntajes de IMDb, Rotten Tomatoes y Metacritic vía OMDb API (CC BY-NC 4.0). No afiliado con IMDb.'),
  ).toBeInTheDocument()
})

test('without a key, Crear mi clave shows it once with Copiar clave', async () => {
  api.createShareKey.mockResolvedValue('ab'.repeat(24))
  renderSettings(2)
  expect(screen.getByRole('heading', { name: 'Atajo para compartir' })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Crear mi clave' }))
  expect(await screen.findByDisplayValue('ab'.repeat(24))).toBeInTheDocument()
  expect(screen.getByText('Guardala en el Atajo ahora: después no se vuelve a mostrar')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copiar clave' }))
  expect(api.writeText).toHaveBeenCalledWith('ab'.repeat(24))
})

test('with a key it shows its date and offers a new one', async () => {
  api.shareKeyCreatedAt.mockResolvedValue('2026-10-08T15:00:00Z')
  renderSettings(2)
  expect(await screen.findByText('Tu clave se creó el 8/10/2026')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear otra clave' })).toBeInTheDocument()
  expect(screen.getByText('La clave anterior deja de funcionar')).toBeInTheDocument()
})

test('a key that cannot be created says so', async () => {
  api.createShareKey.mockRejectedValue(new Error('network'))
  renderSettings(2)
  fireEvent.click(await screen.findByRole('button', { name: 'Crear mi clave' }))
  expect(await screen.findByText('No se pudo crear la clave. Probá de nuevo.')).toBeInTheDocument()
})

test('the guide shows the address to copy', async () => {
  renderSettings(2)
  await screen.findByRole('button', { name: 'Crear mi clave' })
  expect(screen.getByText('Cómo armar el Atajo')).toBeInTheDocument()
  expect(screen.getByText(SHARE_URL)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copiar dirección' }))
  expect(api.writeText).toHaveBeenCalledWith(SHARE_URL)
})

test('the guide shows the server answer, warns about the key in iCloud and points to the share sheet block', async () => {
  renderSettings(2)
  await screen.findByRole('button', { name: 'Crear mi clave' })
  expect(screen.getByText(/"Mostrar notificación" \(Show Notification\) con la variable "Contenido de URL"/)).toBeInTheDocument()
  expect(screen.getByText(/antes de compartirlo, borrá tu clave del encabezado/)).toBeInTheDocument()
  expect(screen.getByText(/"Recibir … de …"/)).toBeInTheDocument()
})

test('the guide also names the iOS actions in English', async () => {
  renderSettings(2)
  await screen.findByRole('button', { name: 'Crear mi clave' })
  for (const name of ['Show in Share Sheet', 'Ask for Input', 'Get Contents of URL', 'Show Notification', 'Shortcut Input', 'Provided Input', 'Contents of URL'])
    expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0)
})

test('under the guide, what to change in a shortcut someone else built', async () => {
  renderSettings(2)
  await screen.findByRole('button', { name: 'Crear mi clave' })
  expect(screen.getByText('¿Te pasaron el Atajo ya armado?')).toBeInTheDocument()
  expect(screen.getByText(/Solo cambiá la clave/)).toBeInTheDocument()
  expect(screen.getByText(/reemplazá el valor de/)).toBeInTheDocument()
  expect(screen.getByText(/No cambies nada más/)).toBeInTheDocument()
})

test('Tema shows the 15 themes and choosing one paints the app and is remembered', async () => {
  localStorage.clear()
  renderSettings(2)
  expect(screen.getByRole('heading', { name: 'Tema' })).toBeInTheDocument()
  const themes = within(screen.getByRole('group', { name: 'Tema' })).getAllByRole('button')
  expect(themes).toHaveLength(15)
  expect(screen.getByRole('button', { name: 'Azul noche' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Menta' }))
  expect(screen.getByRole('button', { name: 'Menta' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Azul noche' })).toHaveAttribute('aria-pressed', 'false')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#f1faf6')
  expect(savedTheme()).toBe('menta')
  await screen.findByRole('button', { name: 'Crear mi clave' })
})

test('if copying fails it says how to copy by hand', async () => {
  api.createInvite.mockResolvedValue('tok')
  api.writeText.mockRejectedValue(new Error('denied'))
  renderSettings(1)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a mi pareja' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar enlace' }))
  expect(await screen.findByText('No se pudo copiar. Mantené apretado el enlace para copiarlo.')).toBeInTheDocument()
  expect(screen.queryByText('¡Copiado!')).not.toBeInTheDocument()
})

test('if the key date cannot be read it offers Reintentar, never Crear mi clave', async () => {
  api.shareKeyCreatedAt.mockRejectedValueOnce(new Error('network')).mockResolvedValue('2026-10-08T15:00:00Z')
  renderSettings(2)
  expect(await screen.findByText('No se pudo ver tu clave.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Crear mi clave' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Tu clave se creó el 8/10/2026')).toBeInTheDocument()
})
