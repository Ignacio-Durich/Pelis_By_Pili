-- Lista compartida de títulos del espacio. Solo los dos miembros leen, agregan o quitan;
-- nadie edita (no hay política de update).

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (char_length(title) between 1 and 300),
  original_title text check (char_length(original_title) <= 300),
  year smallint check (year between 1870 and 2100),
  -- Solo la ruta de TMDB: el cliente arma la URL, así no se cuela otra dirección.
  poster_path text check (poster_path ~ '^/[A-Za-z0-9_.-]+$'),
  origin_note text check (char_length(origin_note) <= 200),
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (couple_id, media_type, tmdb_id)
);

alter table public.titles enable row level security;

revoke all on public.titles from anon, authenticated;
grant select, insert, delete on public.titles to authenticated;
grant all on public.titles to service_role;

create policy "members read their titles" on public.titles
  for select to authenticated using (public.is_member(couple_id));

create policy "members add titles as themselves" on public.titles
  for insert to authenticated with check (public.is_member(couple_id) and added_by = (select auth.uid()));

create policy "members remove their titles" on public.titles
  for delete to authenticated using (public.is_member(couple_id));

alter publication supabase_realtime add table public.titles;
