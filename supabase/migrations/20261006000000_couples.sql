-- Espacio de pareja: dos personas como máximo, nadie ajeno ve ni toca nada.
-- Toda escritura pasa por create_couple, create_invite y accept_invite (security definer);
-- el cliente solo puede leer, y solo lo de su propio espacio.

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table public.invites (
  token text primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create index invites_couple_id_idx on public.invites (couple_id);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.invites enable row level security;

-- Supabase da todos los privilegios a anon y authenticated por defecto; RLS no cubre truncate.
revoke all on public.couples, public.couple_members, public.invites from anon, authenticated;
grant select on public.couples, public.couple_members, public.invites to authenticated;
-- Explícito por si el proyecto no expone tablas nuevas automáticamente (lo usan los tests de seguridad).
grant all on public.couples, public.couple_members, public.invites to service_role;

-- security definer para que la política de couple_members no se llame a sí misma.
create function public.is_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

create policy "members read their couple" on public.couples
  for select to authenticated using (public.is_member(id));

create policy "members read their members" on public.couple_members
  for select to authenticated using (public.is_member(couple_id));

create policy "members read their invites" on public.invites
  for select to authenticated using (public.is_member(couple_id));

-- Tope de dos miembros. El lock sobre la fila del espacio serializa dos altas simultáneas.
create function public.enforce_couple_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'couple_full';
  end if;
  return new;
end;
$$;

create trigger couple_members_limit
  before insert on public.couple_members
  for each row execute function public.enforce_couple_limit();

create function public.create_couple()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple_id uuid;
begin
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'already_in_couple';
  end if;

  insert into public.couples default values returning id into v_couple_id;
  begin
    insert into public.couple_members (couple_id, user_id) values (v_couple_id, auth.uid());
  exception when unique_violation then
    -- Dos llamadas simultáneas: la segunda choca con unique (user_id) y su espacio se descarta.
    raise exception 'already_in_couple';
  end;
  return v_couple_id;
end;
$$;

create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple_id uuid;
  v_token text;
begin
  select couple_id into v_couple_id from public.couple_members where user_id = auth.uid();
  if v_couple_id is null then
    raise exception 'not_a_member';
  end if;
  if (select count(*) from public.couple_members where couple_id = v_couple_id) >= 2 then
    raise exception 'couple_full';
  end if;

  -- 64 caracteres hexadecimales de gen_random_uuid (aleatorio criptográfico, sin extensiones).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invites (token, couple_id, created_by, expires_at)
  values (v_token, v_couple_id, auth.uid(), now() + interval '7 days');
  return v_token;
end;
$$;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites;
begin
  -- for update: dos personas aceptando el mismo token a la vez → la segunda lo ve usado.
  select * into v_invite from public.invites where token = p_token for update;
  -- Inexistente, usada o vencida: el mismo mensaje, para no revelar cuál fue.
  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite_invalid';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'already_in_couple';
  end if;

  begin
    insert into public.couple_members (couple_id, user_id) values (v_invite.couple_id, auth.uid());
  exception when unique_violation then
    raise exception 'already_in_couple';
  end;
  -- couple_full lo lanza el trigger de couple_members.

  update public.invites set used_at = now(), used_by = auth.uid() where token = p_token;
  return v_invite.couple_id;
end;
$$;

revoke execute on function public.create_couple(), public.create_invite(), public.accept_invite(text) from public, anon;
grant execute on function public.create_couple(), public.create_invite(), public.accept_invite(text) to authenticated;
