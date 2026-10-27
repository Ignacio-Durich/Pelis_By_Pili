-- Bumble: el mazo puede ser de 10, 20, 30, 50 u 80 títulos (lo eligen al empezar). La base solo
-- pone el tope: de 2 a 80.

alter table public.bumble_sessions drop constraint bumble_sessions_deck_check;
alter table public.bumble_sessions add constraint bumble_sessions_deck_check check (cardinality(deck) between 2 and 80);

-- Si la pareja ya tiene una partida abierta devuelve esa, así los dos terminan en la misma.
create or replace function public.start_bumble(p_title_ids uuid[])
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

  if cardinality(v_deck) not between 2 and 80
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
