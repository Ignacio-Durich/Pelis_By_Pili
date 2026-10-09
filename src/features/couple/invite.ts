export function buildInviteLink(origin: string, token: string): string {
  return `${origin}/?invite=${encodeURIComponent(token)}`
}

// Sirve para la URL de la app y para un enlace pegado a mano, aunque venga con texto alrededor.
export function parseInviteToken(text: string): string | null {
  const match = /[?&]invite=([^&#\s]+)/.exec(text)
  return match ? decodeURIComponent(match[1]) : null
}
