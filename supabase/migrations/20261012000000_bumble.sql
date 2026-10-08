-- Bumble con dos celulares: una partida abierta por pareja, con el mazo fijo y los votos de cada
-- uno por vuelta. Los dos celulares calculan matches y resultado con los mismos votos; la base
-- solo guarda y valida. Como siempre, toda escritura pasa por funciones security definer.
-- (Con un solo celular la partida no pasa por la base.)

create table public.bumble_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  deck uuid[] not null check (cardinality(deck) between 2 and 30),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  result_title_id uuid references public.titles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Una sola partida abierta por pareja.
create unique index bumble_sessions_one_open_idx on public.bumble_sessions (couple_id) where status = 'open';
create index bumble_sessions_couple_id_idx on public.bumble_sessions (couple_id);

-- Clave al azar: Realtime manda la clave de las filas borradas (deshacer) a cualquier suscriptor.
create table public.bumble_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bumble_sessions (id) on delete cascade,
  -- Copia del espacio de la partida: filtra Realtime y simplifica RLS.
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  round smallint not null check (round between 1 and 3),
  title_id uuid not null references public.titles (id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, user_id, round, title_id)
);

create index bumble_votes_couple_id_idx on public.bumble_votes (couple_id);

alter table public.bumble_sessions enable row level security;
alter table public.bumble_votes enable row level security;

revoke all on public.bumble_sessions, public.bumble_votes from anon, authenticated;
grant select on public.bumble_sessions, public.bumble_votes to authenticated;
grant all on public.bumble_sessions, public.bumble_votes to service_role;

create policy "members read their bumble sessions" on public.bumble_sessions
  for select to authenticated using (public.is_member(couple_id));

create policy "members read their bumble votes" on public.bumble_votes
  for select to authenticated using (public.is_member(couple_id));

alter publication supabase_realtime add table public.bumble_sessions, public.bumble_votes;

-- Si la pareja ya tiene una partida abierta devuelve esa, así los dos terminan en la misma.
create function public.start_bumble(p_title_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_deck uuid[];
  v_id uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;

  select id into v_id from public.bumble_sessions where couple_id = v_couple and status = 'open';
  if found then
    return v_id;
  end if;

  if (select count(*) from public.couple_members where couple_id = v_couple) < 2 then
    raise exception 'no_partner';
  end if;

  -- Sin repetidos, en el orden en que llegaron.
  select coalesce(array_agg(t.id order by t.pos), '{}') into v_deck
  from (
    select u.id, min(u.pos) as pos
    from unnest(p_title_ids) with ordinality as u (id, pos)
    group by u.id
  ) t;

  if cardinality(v_deck) not between 2 and 30
    or (select count(*) from public.titles
        where id = any (v_deck) and couple_id = v_couple and status = 'to_watch') <> cardinality(v_deck) then
    raise exception 'invalid_deck';
  end if;

  begin
    insert into public.bumble_sessions (couple_id, created_by, deck)
    values (v_couple, (select auth.uid()), v_deck)
    returning id into v_id;
  exception when unique_violation then
    -- La pareja la empezó al mismo tiempo: se usa la suya.
    select id into v_id from public.bumble_sessions where couple_id = v_couple and status = 'open';
  end;
  return v_id;
end;
$$;

create function public.bumble_vote(p_session_id uuid, p_round int, p_title_id uuid, p_liked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.bumble_sessions;
begin
  select * into v_session from public.bumble_sessions where id = p_session_id and public.is_member(couple_id);
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status <> 'open' then
    raise exception 'closed';
  end if;
  if p_round is null or p_round not between 1 and 3 or not coalesce(p_title_id = any (v_session.deck), false) then
    raise exception 'not_in_deck';
  end if;

  -- Un reintento (doble toque, corte de red) no duplica ni falla.
  insert into public.bumble_votes (session_id, couple_id, user_id, round, title_id, liked)
  values (p_session_id, v_session.couple_id, (select auth.uid()), p_round, p_title_id, p_liked)
  on conflict (session_id, user_id, round, title_id) do nothing;
end;
$$;

-- Deshacer: borra el voto más reciente de quien llama.
create function public.bumble_undo(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.bumble_sessions;
begin
  select * into v_session from public.bumble_sessions where id = p_session_id and public.is_member(couple_id);
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status <> 'open' then
    raise exception 'closed';
  end if;

  delete from public.bumble_votes
  where id = (
    select id from public.bumble_votes
    where session_id = p_session_id and user_id = (select auth.uid())
    order by created_at desc, id desc
    limit 1
  );
end;
$$;

-- Con resultado queda 'done'; sin resultado, 'cancelled'. Si ya estaba cerrada no hace nada
-- (los dos celulares pueden tocar "Listo").
create function public.finish_bumble(p_session_id uuid, p_result_title_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.bumble_sessions;
begin
  select * into v_session from public.bumble_sessions where id = p_session_id and public.is_member(couple_id);
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status <> 'open' then
    return;
  end if;
  if p_result_title_id is not null and not (p_result_title_id = any (v_session.deck)) then
    raise exception 'not_in_deck';
  end if;

  update public.bumble_sessions
  set status = case when p_result_title_id is null then 'cancelled' else 'done' end,
      result_title_id = p_result_title_id,
      finished_at = now()
  where id = p_session_id and status = 'open';
end;
$$;

revoke execute on function
  public.start_bumble(uuid[]),
  public.bumble_vote(uuid, int, uuid, boolean),
  public.bumble_undo(uuid),
  public.finish_bumble(uuid, uuid)
from public, anon;
grant execute on function
  public.start_bumble(uuid[]),
  public.bumble_vote(uuid, int, uuid, boolean),
  public.bumble_undo(uuid),
  public.finish_bumble(uuid, uuid)
to authenticated;
