-- Recomendaciones ("Descubrir"): las plataformas de streaming que tiene el espacio
-- (IDs de TMDB) y los títulos que el espacio descartó para no volver a verlos.

alter table public.couples
  add column platforms int[] not null default '{}'
  check (cardinality(platforms) <= 30);

-- Guarda las plataformas sin repetidos, en el orden recibido.
create function public.set_platforms(p_ids int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;
  if p_ids is null or cardinality(p_ids) > 30 or exists (select 1 from unnest(p_ids) as i where i is null or i <= 0) then
    raise exception 'invalid_platforms';
  end if;

  update public.couples
  set platforms = coalesce(
    (select array_agg(id order by ord)
     from (select distinct on (id) id, ord from unnest(p_ids) with ordinality as t (id, ord) order by id, ord) s),
    '{}')
  where id = v_couple;
end;
$$;

revoke execute on function public.set_platforms(int[]) from public, anon;
grant execute on function public.set_platforms(int[]) to authenticated;

create table public.dismissed_titles (
  couple_id uuid not null references public.couples (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id int not null check (tmdb_id > 0),
  dismissed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (couple_id, media_type, tmdb_id)
);

alter table public.dismissed_titles enable row level security;
revoke all on public.dismissed_titles from anon, authenticated;
grant select on public.dismissed_titles to authenticated;
-- En producción las tablas nuevas no le dan permisos a service_role solas.
grant all on public.dismissed_titles to service_role;

create policy "members read their dismissed titles" on public.dismissed_titles
  for select to authenticated using (public.is_member(couple_id));

create function public.dismiss_title(p_media_type text, p_tmdb_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;
  if p_media_type is null or p_media_type not in ('movie', 'tv') or p_tmdb_id is null or p_tmdb_id <= 0 then
    raise exception 'invalid_title';
  end if;

  insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
  values (v_couple, p_media_type, p_tmdb_id, (select auth.uid()))
  on conflict do nothing;
end;
$$;

create function public.undismiss_title(p_media_type text, p_tmdb_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;
  if p_media_type is null or p_media_type not in ('movie', 'tv') or p_tmdb_id is null or p_tmdb_id <= 0 then
    raise exception 'invalid_title';
  end if;

  delete from public.dismissed_titles
  where couple_id = v_couple and media_type = p_media_type and tmdb_id = p_tmdb_id;
end;
$$;

revoke execute on function public.dismiss_title(text, int) from public, anon;
grant execute on function public.dismiss_title(text, int) to authenticated;
revoke execute on function public.undismiss_title(text, int) from public, anon;
grant execute on function public.undismiss_title(text, int) to authenticated;
