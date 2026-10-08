-- Compartir desde otras apps. iOS no deja que una app web instalada reciba lo compartido, así
-- que un Atajo lo manda a la función `share` con una clave personal, y la función lo guarda en
-- la bandeja de la pareja. De la clave solo se guarda el hash; se muestra una sola vez.

create table public.share_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);

-- Nadie la lee desde la app: la usa la función `share` con la clave de servicio.
alter table public.share_keys enable row level security;
revoke all on public.share_keys from anon, authenticated;
grant all on public.share_keys to service_role;

-- Clave al azar: Realtime manda la clave de las filas borradas (descartar) a cualquier suscriptor.
create table public.shared_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  shared_by uuid references auth.users (id) on delete set null,
  url text check (char_length(url) <= 2000),
  body text check (char_length(body) <= 500),
  query text check (char_length(query) <= 100),
  source text check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  check (url is not null or body is not null or query is not null)
);

create index shared_items_couple_id_idx on public.shared_items (couple_id);

alter table public.shared_items enable row level security;
revoke all on public.shared_items from anon, authenticated;
grant select, delete on public.shared_items to authenticated;
grant all on public.shared_items to service_role;

create policy "members read their shared items" on public.shared_items
  for select to authenticated using (public.is_member(couple_id));

create policy "members dismiss their shared items" on public.shared_items
  for delete to authenticated using (public.is_member(couple_id));

alter publication supabase_realtime add table public.shared_items;

-- Crea (o reemplaza) la clave de quien llama y la devuelve: es la única vez que se ve.
create function public.create_share_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_key text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;

  insert into public.share_keys (user_id, couple_id, key_hash)
  values ((select auth.uid()), v_couple, encode(extensions.digest(v_key, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set couple_id = excluded.couple_id, key_hash = excluded.key_hash, created_at = now();
  return v_key;
end;
$$;

create function public.share_key_created_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select created_at from public.share_keys where user_id = (select auth.uid());
$$;

revoke execute on function public.create_share_key(), public.share_key_created_at() from public, anon;
grant execute on function public.create_share_key(), public.share_key_created_at() to authenticated;
