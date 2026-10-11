-- Nombre visible de cada persona dentro de su espacio ("La agregó Juli").
-- Se carga solo con set_display_name y cada uno cambia únicamente el suyo.

alter table public.couple_members
  add column display_name text
  check (display_name = btrim(display_name) and char_length(display_name) between 1 and 30);

create function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
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

revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
