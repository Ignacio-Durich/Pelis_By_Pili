import type { SearchResult } from '../../../supabase/functions/tmdb-search/lib.ts'
import { supabase } from '../../lib/supabase'

export type { SearchResult }

export async function searchTitles(query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.functions.invoke<{ results: SearchResult[] }>('tmdb-search', {
    body: { query },
  })
  if (error || !data) throw new Error('search_failed')
  return data.results
}
