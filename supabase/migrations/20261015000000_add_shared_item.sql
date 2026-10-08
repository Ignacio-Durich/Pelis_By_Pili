-- Sin internet, "Agregar" anota el nombre en el celular; al volver la conexión la app lo manda a la
-- bandeja de Compartidos con la sesión de quien lo anotó (sin link ni origen). Mismos límites y
-- tope que la función `share` del Atajo.

create function public.add_shared_item(p_query text, p_body text)
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

  -- El lock sobre la pareja serializa el conteo y el alta: dos a la vez no pasan el tope.
  perform 1 from public.couples where id = v_couple for update;
  if (select count(*) from public.shared_items where couple_id = v_couple) >= 100 then
    raise exception 'inbox_full';
  end if;

  insert into public.shared_items (couple_id, shared_by, query, body)
  values (v_couple, (select auth.uid()), v_query, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.add_shared_item(text, text) from public, anon;
grant execute on function public.add_shared_item(text, text) to authenticated;
