-- Realtime manda la clave primaria de cada fila borrada a cualquier suscriptor (no aplica RLS
-- ni filtros a los DELETE). Con (title_id, user_id) como clave, un ajeno veía ids de usuarios
-- de otros espacios. Con una clave al azar solo viaja ese id, igual que en titles.
alter table public.title_scores
  add column id uuid not null default gen_random_uuid(),
  drop constraint title_scores_pkey,
  add primary key (id),
  add constraint title_scores_title_user_key unique (title_id, user_id);
