-- Vistas y puntaje propio. Marcar como vista vale para los dos (la lista es de los dos);
-- cada uno pone su propio puntaje, del 1 al 10 con hasta 2 decimales, con una nota opcional.
-- Como en la etapa 1, toda escritura pasa por funciones security definer.

alter table public.titles
  add column status text not null default 'to_watch' check (status in ('to_watch', 'watched')),
  add column watched_at timestamptz,
  add constraint titles_watched_has_date check ((status = 'watched') = (watched_at is not null));

create table public.title_scores (
  title_id uuid not null references public.titles (id) on delete cascade,
  -- Copia del espacio del título: filtra Realtime y simplifica RLS (sin joins).
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric(4, 2) not null check (score between 1 and 10),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (title_id, user_id)
);

create index title_scores_couple_id_idx on public.title_scores (couple_id);

alter table public.title_scores enable row level security;

revoke all on public.title_scores from anon, authenticated;
grant select on public.title_scores to authenticated;
grant all on public.title_scores to service_role;

create policy "members read their scores" on public.title_scores
  for select to authenticated using (public.is_member(couple_id));

alter publication supabase_realtime add table public.title_scores;

create function public.set_watched(p_title_id uuid, p_watched boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_watched then
    -- Si ya estaba vista, la fecha no cambia.
    update public.titles
      set status = 'watched', watched_at = coalesce(watched_at, now())
      where id = p_title_id and public.is_member(couple_id);
  else
    update public.titles
      set status = 'to_watch', watched_at = null
      where id = p_title_id and public.is_member(couple_id);
  end if;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.set_my_score(p_title_id uuid, p_score numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_title public.titles;
begin
  if p_score is null or p_score < 1 or p_score > 10 or round(p_score, 2) <> p_score then
    raise exception 'invalid_score';
  end if;
  if char_length(v_note) > 200 then
    raise exception 'invalid_note';
  end if;

  select * into v_title from public.titles where id = p_title_id and public.is_member(couple_id);
  if not found then
    raise exception 'not_found';
  end if;
  if v_title.status <> 'watched' then
    raise exception 'not_watched';
  end if;

  insert into public.title_scores (title_id, couple_id, user_id, score, note)
  values (p_title_id, v_title.couple_id, auth.uid(), p_score, v_note)
  on conflict (title_id, user_id)
  do update set score = excluded.score, note = excluded.note, updated_at = now();
end;
$$;

revoke execute on function public.set_watched(uuid, boolean), public.set_my_score(uuid, numeric, text) from public, anon;
grant execute on function public.set_watched(uuid, boolean), public.set_my_score(uuid, numeric, text) to authenticated;
