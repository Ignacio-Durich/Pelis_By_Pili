-- Puntajes externos de cada título, guardados con su fecha para cuidar las 1.000 consultas
-- diarias de OMDb. Solo los escribe la función title-detail (clave de servicio): el cliente
-- sigue sin permiso de update sobre titles.

alter table public.titles
  add column imdb_rating text check (char_length(imdb_rating) <= 10),
  add column rotten_tomatoes text check (char_length(rotten_tomatoes) <= 10),
  add column metacritic text check (char_length(metacritic) <= 10),
  add column tmdb_rating numeric(3, 1) check (tmdb_rating between 0 and 10),
  add column ratings_updated_at timestamptz;
