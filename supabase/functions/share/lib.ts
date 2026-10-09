// Lo que manda el Atajo: `shared` es lo que llegó del menú Compartir (link, texto o los dos) y
// `name`, lo que se escribió en "¿Qué peli o serie es?".
export type SharedItem = { url: string | null; body: string | null; query: string | null; source: string | null }

const LINK = /https?:\/\/\S+/i
// Parámetros que agregan las apps para rastrear quién compartió: no hacen falta para abrir el link.
const TRACKING = /^(igsh|igshid|si|fbclid|utm_.*|share_.*|_t|_r|is_from_webapp|sender_device|pp|feature)$/i

const SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X'],
  [/(^|\.)(facebook\.com|fb\.watch)$/, 'Facebook'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
]

// Un punto, coma o paréntesis pegado al final es del texto, no del link (salvo un paréntesis que cierra uno del link).
function trimLink(raw: string): string {
  let link = raw
  const count = (c: string) => link.split(c).length - 1
  while (/[.,;:!?)]$/.test(link) && !(link.endsWith(')') && count('(') >= count(')'))) link = link.slice(0, -1)
  return link
}

const text = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

function cleanLink(raw: string): URL | null {
  try {
    const url = new URL(raw)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key)
    return url
  } catch {
    return null
  }
}

export function parseShare(input: unknown): SharedItem | null {
  const fields = (input ?? {}) as { shared?: unknown; name?: unknown }
  const shared = text(fields.shared)
  const name = text(fields.name)

  const found = shared.match(LINK)?.[0]
  const link = found ? cleanLink(trimLink(found)) : null
  const url = link && link.toString().length <= 2000 ? link.toString() : null
  // Si el link viene repetido (link y texto juntos), se saca todas las veces.
  const body = (link ? text(shared.split(found!).join(' ')) : shared).slice(0, 500) || null
  const query = name && name !== '-' ? name.slice(0, 100) : null
  if (!url && !body && !query) return null

  const host = link?.hostname.replace(/^www\./, '') ?? null
  const source = host ? (SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? host.slice(0, 40)) : null
  return { url, body, query, source: url ? source : null }
}
