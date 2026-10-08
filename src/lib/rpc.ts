import { supabase } from './supabase'

// Un error con su código (`kind`). Cada parte de la app tiene su subclase (TitleError, BumbleError…)
// para que `instanceof` diga de dónde viene.
export class CodedError<K extends string> extends Error {
  kind: K
  constructor(kind: K) {
    super(kind)
    this.kind = kind
  }
}

// Llama a una función SQL. Sus excepciones traen como mensaje exactamente el código: si es uno de
// `known` se lanza con ese código; cualquier otro error cuenta como 'network'.
export async function callRpc<T, K extends string>(
  name: string,
  args: Record<string, unknown> | undefined,
  known: readonly K[],
  fail: (kind: K | 'network') => Error,
): Promise<T> {
  const { data, error } = await (args ? supabase.rpc(name, args) : supabase.rpc(name))
  if (error) throw fail((known as readonly string[]).includes(error.message) ? (error.message as K) : 'network')
  return data as T
}
