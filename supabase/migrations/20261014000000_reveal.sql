-- Top 3 secreto (revelación simultánea) con dos celulares. El secreto lo cuida la base: la
-- elección de cada uno solo la lee su dueño hasta que la partida se revela, y la revelación la
-- hace submit_reveal cuando eligieron los dos. Las elecciones no van a Realtime: los celulares
-- se enteran por el cambio en la partida (`ready`, `revealed_at`) y recién ahí las piden.
-- (Con un solo celular la partida no pasa por la base.)

create table public.reveal_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  -- Quiénes ya eligieron (sin decir qué).
  ready uuid[] not null default '{}',
  revealed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  result_title_id uuid references public.titles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index reveal_sessions_one_open_idx on public.reveal_sessions (couple_id) where status = 'open';
create index reveal_sessions_couple_id_idx on public.reveal_sessions (couple_id);

create table public.reveal_picks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reveal_sessions (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title_ids uuid[] not null check (cardinality(title_ids) between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index reveal_picks_couple_id_idx on public.reveal_picks (couple_id);

alter table public.reveal_sessions enable row level security;
alter table public.reveal_picks enable row level security;

revoke all on public.reveal_sessions, public.reveal_picks from anon, authenticated;
grant select on public.reveal_sessions, public.reveal_picks to authenticated;
grant all on public.reveal_sessions, public.reveal_picks to service_role;

create function public.reveal_visible(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reveal_sessions where id = p_session_id and revealed_at is not null);
$$;

revoke execute on function public.reveal_visible(uuid) from public, anon;
grant execute on function public.reveal_visible(uuid) to authenticated;

create policy "members read their reveal sessions" on public.reveal_sessions
  for select to authenticated using (public.is_member(couple_id));

-- La propia siempre; la del otro, recién revelada la partida.
create policy "own picks, or both once revealed" on public.reveal_picks
  for select to authenticated
  using (public.is_member(couple_id) and (user_id = (select auth.uid()) or public.reveal_visible(session_id)));

alter publication supabase_realtime add table public.reveal_sessions;

create function public.start_reveal()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_id uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;

  select id into v_id from public.reveal_sessions where couple_id = v_couple and status = 'open';
  if found then
    return v_id;
  end if;

  if (select count(*) from public.couple_members where couple_id = v_couple) < 2 then
    raise exception 'no_partner';
  end if;

  begin
    insert into public.reveal_sessions (couple_id, created_by) values (v_couple, (select auth.uid())) returning id into v_id;
  exception when unique_violation then
    -- La pareja la empezó al mismo tiempo: se usa la suya.
    select id into v_id from public.reveal_sessions where couple_id = v_couple and status = 'open';
  end;
  return v_id;
end;
$$;

create function public.submit_reveal(p_session_id uuid, p_title_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.reveal_sessions;
  v_ids uuid[];
  v_ready uuid[];
begin
  -- El lock serializa a los dos: si eligen a la vez, el segundo ve al primero en `ready`.
  select * into v_session from public.reveal_sessions where id = p_session_id and public.is_member(couple_id) for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status <> 'open' or v_session.revealed_at is not null then
    raise exception 'closed';
  end if;

  select coalesce(array_agg(distinct u), '{}') into v_ids from unnest(p_title_ids) as u;
  if array_position(v_ids, null) is not null
    or cardinality(v_ids) not between 1 and 3
    or (select count(*) from public.titles
        where id = any (v_ids) and couple_id = v_session.couple_id and status = 'to_watch') <> cardinality(v_ids) then
    raise exception 'invalid_picks';
  end if;

  insert into public.reveal_picks (session_id, couple_id, user_id, title_ids)
  values (p_session_id, v_session.couple_id, (select auth.uid()), v_ids)
  on conflict (session_id, user_id) do update set title_ids = excluded.title_ids, updated_at = now();

  v_ready := case when (select auth.uid()) = any (v_session.ready) then v_session.ready else v_session.ready || (select auth.uid()) end;
  update public.reveal_sessions
  set ready = v_ready,
      revealed_at = case
        when cardinality(v_ready) >= 2 and cardinality(v_ready) >= (select count(*) from public.couple_members where couple_id = v_session.couple_id)
        then now()
      end
  where id = p_session_id;
end;
$$;

-- Con resultado queda 'done'; sin resultado, 'cancelled'. Si ya estaba cerrada no hace nada.
create function public.finish_reveal(p_session_id uuid, p_result_title_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.reveal_sessions;
begin
  select * into v_session from public.reveal_sessions where id = p_session_id and public.is_member(couple_id);
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status <> 'open' then
    return;
  end if;
  if p_result_title_id is not null
    and not exists (select 1 from public.reveal_picks where session_id = p_session_id and p_result_title_id = any (title_ids)) then
    raise exception 'not_in_picks';
  end if;

  update public.reveal_sessions
  set status = case when p_result_title_id is null then 'cancelled' else 'done' end,
      result_title_id = p_result_title_id,
      finished_at = now()
  where id = p_session_id and status = 'open';
end;
$$;

revoke execute on function public.start_reveal(), public.submit_reveal(uuid, uuid[]), public.finish_reveal(uuid, uuid) from public, anon;
grant execute on function public.start_reveal(), public.submit_reveal(uuid, uuid[]), public.finish_reveal(uuid, uuid) to authenticated;
