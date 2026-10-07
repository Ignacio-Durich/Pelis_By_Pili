import { supabase } from '../../lib/supabase'
import type { SearchResult } from './searchApi'

export type Title = {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  originalTitle: string | null
  year: number | null
  posterPath: string | null
  originNote: string | null
  addedBy: string | null
  createdAt: string
  imdbRating: string | null
  rottenTomatoes: string | null
  metacritic: string | null
  tmdbRating: number | null
  ratingsUpdatedAt: string | null
  status: 'to_watch' | 'watched'
  watchedAt: string | null
  scores: Score[]
  runtime: number | null
  genres: string[]
  streaming: string[]
  detailsUpdatedAt: string | null
}

export type Score = { userId: string; score: number; note: string | null; updatedAt: string }

export type TitleErrorKind = 'duplicate' | 'network' | 'not_found' | 'not_watched' | 'invalid_score' | 'invalid_note'

export class TitleError extends Error {
  kind: TitleErrorKind
  constructor(kind: TitleErrorKind) {
    super(kind)
    this.kind = kind
  }
}

type Row = {
  id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  title: string
  original_title: string | null
  year: number | null
  poster_path: string | null
  origin_note: string | null
  added_by: string | null
  created_at: string
  imdb_rating: string | null
  rotten_tomatoes: string | null
  metacritic: string | null
  tmdb_rating: number | string | null
  ratings_updated_at: string | null
  status: 'to_watch' | 'watched'
  watched_at: string | null
  title_scores: { user_id: string; score: number | string; note: string | null; updated_at: string }[]
  runtime: number | null
  genres: string[] | null
  streaming: string[] | null
  details_updated_at: string | null
}

export async function listTitles(coupleId: string): Promise<Title[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('*, title_scores(user_id, score, note, updated_at)')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
  if (error) throw new TitleError('network')
  return (data as Row[]).map((r) => ({
    id: r.id,
    tmdbId: r.tmdb_id,
    mediaType: r.media_type,
    title: r.title,
    originalTitle: r.original_title,
    year: r.year,
    posterPath: r.poster_path,
    originNote: r.origin_note,
    addedBy: r.added_by,
    createdAt: r.created_at,
    imdbRating: r.imdb_rating,
    rottenTomatoes: r.rotten_tomatoes,
    metacritic: r.metacritic,
    // numeric de Postgres puede llegar como texto.
    tmdbRating: r.tmdb_rating === null ? null : Number(r.tmdb_rating),
    ratingsUpdatedAt: r.ratings_updated_at,
    status: r.status,
    watchedAt: r.watched_at,
    scores: r.title_scores.map((sc) => ({
      userId: sc.user_id,
      score: Number(sc.score),
      note: sc.note,
      updatedAt: sc.updated_at,
    })),
    runtime: r.runtime,
    genres: r.genres ?? [],
    streaming: r.streaming ?? [],
    detailsUpdatedAt: r.details_updated_at,
  }))
}

export async function addTitle(coupleId: string, result: SearchResult, originNote: string): Promise<string> {
  // added_by lo pone la base (default auth.uid()) y RLS exige que sea quien inserta.
  const { data, error } = await supabase
    .from('titles')
    .insert({
      couple_id: coupleId,
      tmdb_id: result.tmdbId,
      media_type: result.mediaType,
      title: result.title,
      original_title: result.originalTitle,
      year: result.year,
      poster_path: result.posterPath,
      origin_note: originNote.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw new TitleError(error.code === '23505' ? 'duplicate' : 'network')
  return data.id
}

// Las funciones SQL lanzan excepciones cuyo mensaje es exactamente el código.
const functionErrors: string[] = ['not_found', 'not_watched', 'invalid_score', 'invalid_note']

async function call(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(name, args)
  if (error) throw new TitleError(functionErrors.includes(error.message) ? (error.message as TitleErrorKind) : 'network')
}

export const setWatched = (titleId: string, watched: boolean) => call('set_watched', { p_title_id: titleId, p_watched: watched })

export const setMyScore = (titleId: string, score: number, note: string) =>
  call('set_my_score', { p_title_id: titleId, p_score: score, p_note: note })

export async function removeTitle(id: string): Promise<void> {
  const { error } = await supabase.from('titles').delete().eq('id', id)
  if (error) throw new TitleError('network')
}

// Ante cualquier cambio, y al (re)conectar, se vuelve a pedir la lista entera: con dos personas
// es poca data, y así no se pierde nada de lo que pasó mientras el celular estaba en segundo plano.
// Realtime no filtra los DELETE, por eso esa escucha va sin filtro (con RLS solo trae el id).
// La recarga va cuando el servidor avisa que ya escucha la base ("Subscribed to PostgreSQL"), que
// llega un poco después de SUBSCRIBED: un cambio en ese hueco se perdería si se recargara antes.
export function subscribeTitles(coupleId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`titles:${coupleId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'titles', filter: `couple_id=eq.${coupleId}` }, () => onChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'titles' }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'titles', filter: `couple_id=eq.${coupleId}` }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'title_scores', filter: `couple_id=eq.${coupleId}` }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'title_scores', filter: `couple_id=eq.${coupleId}` }, () => onChange())
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') onChange()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
