-- Etapa 12: candados que faltaban.

-- 1. Un miembro solo carga las columnas que carga la app: no puede crear un título ya visto,
--    con fecha o con puntajes inventados. `added_by` toma su default y la política exige que sea uno.
revoke insert on public.titles from authenticated;
grant insert (couple_id, tmdb_id, media_type, title, original_title, year, poster_path, origin_note)
  on public.titles to authenticated;

-- 2. Tope de 100 ítems en la bandeja, en la base: vale para el Atajo (función `share`) y para la app.
--    El lock sobre la pareja serializa el conteo y el alta, así dos a la vez no pasan el tope.
create function public.shared_items_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.shared_items where couple_id = new.couple_id) >= 100 then
    raise exception 'inbox_full';
  end if;
  return new;
end;
$$;

revoke execute on function public.shared_items_cap() from public, anon, authenticated;

create trigger shared_items_cap before insert on public.shared_items
  for each row execute function public.shared_items_cap();

-- add_shared_item ya no cuenta: lo hace el trigger.
create or replace function public.add_shared_item(p_query text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_query text := nullif(btrim(p_query), '');
  v_body text := nullif(btrim(p_body), '');
  v_id uuid;
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;
  if (v_query is null and v_body is null) or char_length(v_query) > 100 or char_length(v_body) > 500 then
    raise exception 'invalid_item';
  end if;

  insert into public.shared_items (couple_id, shared_by, query, body)
  values (v_couple, (select auth.uid()), v_query, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- 3. Los nombres se guardan sin tabulaciones ni saltos de línea en las puntas.
update public.couple_members set display_name = btrim(display_name, E' \t\r\n') where display_name is not null;
alter table public.couple_members drop constraint couple_members_display_name_check;
alter table public.couple_members add constraint couple_members_display_name_check
  check (display_name = btrim(display_name, E' \t\r\n') and char_length(display_name) between 1 and 30);

create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name, E' \t\r\n');
begin
  if v_name is null or char_length(v_name) not between 1 and 30 then
    raise exception 'invalid_name';
  end if;
  update public.couple_members set display_name = v_name where user_id = auth.uid();
  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;
