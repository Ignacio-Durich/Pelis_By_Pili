export function buildInviteLink(origin: string, token: string): string {
  return `${origin}/?invite=${encodeURIComponent(token)}`
}

export function parseInviteToken(url: string): string | null {
  return new URL(url).searchParams.get('invite') || null
}
