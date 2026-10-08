// En los modos de un celular, el otro jugador cuando el espacio todavía tiene un solo miembro.
export const NO_PARTNER = 'pareja'

export const playerName = (player: string, nameOf: (userId: string) => string) => (player === NO_PARTNER ? 'tu pareja' : nameOf(player))
