-- Datos para filtrar la lista y la ruleta: duración, géneros y dónde verla (suscripción o
-- gratis). Los escribe solo la función title-detail con la clave de servicio, cada vez que se
-- abre el detalle; el cliente sigue sin permiso de update sobre titles.
alter table public.titles
  add column runtime smallint check (runtime between 1 and 1000),
  add column genres text[] check (cardinality(genres) <= 20),
  add column streaming text[] check (cardinality(streaming) <= 50),
  add column details_updated_at timestamptz;
