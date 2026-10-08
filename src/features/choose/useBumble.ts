import { useLive } from '../../lib/useLive'
import { loadOpenBumble, subscribeBumble, type BumbleSession } from './bumbleApi'

// La partida de Bumble con dos celulares, siempre al día. undefined = cargando; null = no hay.
export function useBumble(coupleId: string): { session: BumbleSession | null | undefined; offline: boolean; load: () => void } {
  const { data, offline, load } = useLive(coupleId, loadOpenBumble, subscribeBumble)
  return { session: data, offline, load }
}
