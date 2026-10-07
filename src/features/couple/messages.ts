import type { CoupleErrorKind } from './coupleApi'

export const coupleMessages: Record<CoupleErrorKind, string> = {
  invite_invalid: 'Esta invitación no es válida o ya se usó',
  already_in_couple: 'Ya sos parte de un espacio',
  couple_full: 'Ese espacio ya tiene dos personas',
  not_a_member: 'No sos parte de este espacio',
  invalid_name: 'Escribí un nombre de hasta 30 letras',
  network: 'Sin conexión. Probá de nuevo.',
}
