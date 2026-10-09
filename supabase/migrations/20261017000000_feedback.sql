-- Comentarios y errores desde Ajustes. Se guardan acá y la app no los puede leer:
-- Nacho los ve en el panel de Supabase (o pidiéndolos por SQL).

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index feedback_user_created on public.feedback (user_id, created_at);

-- RLS sin políticas: nadie la lee ni la escribe directo.
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create function public.send_feedback(p_body text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
  v_body text := btrim(p_body);
begin
  select couple_id into v_couple from public.couple_members where user_id = (select auth.uid());
  if v_couple is null then
    raise exception 'no_couple';
  end if;
  if v_body is null or char_length(v_body) not between 1 and 2000 then
    raise exception 'invalid_feedback';
  end if;
  if (select count(*) from public.feedback
      where user_id = (select auth.uid()) and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too_many';
  end if;

  insert into public.feedback (couple_id, user_id, body, user_agent)
  values (v_couple, (select auth.uid()), v_body, left(p_user_agent, 300));
end;
$$;

revoke execute on function public.send_feedback(text, text) from public, anon;
grant execute on function public.send_feedback(text, text) to authenticated;
