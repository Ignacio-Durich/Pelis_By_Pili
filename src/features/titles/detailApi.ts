import type { TitleDetail } from '../../../supabase/functions/title-detail/lib.ts'
import { supabase } from '../../lib/supabase'

export type { Provider, Providers, TitleDetail } from '../../../supabase/functions/title-detail/lib.ts'

export async function fetchTitleDetail(titleId: string): Promise<TitleDetail> {
  const { data, error } = await supabase.functions.invoke<TitleDetail>('title-detail', { body: { titleId } })
  if (error || !data) throw new Error('detail_failed')
  return data
}
