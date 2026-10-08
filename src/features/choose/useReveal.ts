import { useLive } from '../../lib/useLive'
import { loadOpenReveal, subscribeReveal, type RevealSession } from './revealApi'

// La partida de Top 3 secreto con dos celulares, siempre al día. undefined = cargando; null = no hay.
export function useReveal(coupleId: string): { session: RevealSession | null | undefined; offline: boolean; load: () => void } {
  const { data, offline, load } = useLive(coupleId, loadOpenReveal, subscribeReveal)
  return { session: data, offline, load }
}
