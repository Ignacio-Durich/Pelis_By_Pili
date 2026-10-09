-- Quién la dirigió (o creó, si es serie) y cuántas temporadas tiene, para la tarjeta y el
-- detalle. Como la duración y los géneros, los escribe solo title-detail con la clave de servicio.
alter table public.titles
  add column director text check (char_length(director) <= 300),
  add column seasons smallint check (seasons between 1 and 500);

-- Así la lista los vuelve a pedir y los títulos que ya estaban se completan solos.
update public.titles set details_updated_at = null;
