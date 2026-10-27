-- Top 3 secreto: además de 3, cada uno puede elegir 5 o 10. Lo decide quien empieza la partida
-- de dos celulares y vale para los dos. (Con un solo celular la partida no pasa por la base.)

alter table public.reveal_sessions
  add column pick_count int not null default 3 check (pick_count in (3, 5, 10));

alter table public.reveal_picks drop constraint reveal_picks_title_ids_check;
alter table public.reveal_picks add constraint reveal_picks_title_ids_check check (cardinality(title_ids) between 1 and 10);

drop function public.start_reveal();

-- Si ya hay una partida abierta se usa esa, con su cantidad.
create function public.start_reveal(p_pick_count int default 3)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_id uuid;
begin
  if p_pick_count is null or p_pick_count not in (3, 5, 10) then
    raise exception 'invalid_picks';
  end if;

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
    insert into public.reveal_sessions (couple_id, created_by, pick_count)
    values (v_couple, (select auth.uid()), p_pick_count) returning id into v_id;
  exception when unique_violation then
    -- La pareja la empezó al mismo tiempo: se usa la suya.
    select id into v_id from public.reveal_sessions where couple_id = v_couple and status = 'open';
  end;
  return v_id;
end;
$$;

create or replace function public.submit_reveal(p_session_id uuid, p_title_ids uuid[])
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
    or cardinality(v_ids) not between 1 and v_session.pick_count
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

revoke execute on function public.start_reveal(int) from public, anon;
grant execute on function public.start_reveal(int) to authenticated;
