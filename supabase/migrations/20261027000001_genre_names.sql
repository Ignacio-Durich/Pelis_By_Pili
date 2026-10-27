-- Los géneros guardados con el nombre que da TMDB pasan al de toda la app ("Suspense" → "Suspenso",
-- los de series en inglés → castellano), así Filtros, Preguntas rápidas y Descubrir coinciden.
update public.titles t
set genres = array(
  select coalesce(m.es, g)
  from unnest(t.genres) with ordinality as u(g, i)
  left join (values
    ('Suspense', 'Suspenso'), ('Action & Adventure', 'Acción y aventura'), ('Kids', 'Infantil'),
    ('News', 'Noticias'), ('Sci-Fi & Fantasy', 'Ciencia ficción y fantasía'), ('Soap', 'Telenovela'),
    ('Talk', 'Entrevistas'), ('War & Politics', 'Guerra y política')
  ) as m(en, es) on m.en = u.g
  order by u.i
)
where t.genres && array['Suspense', 'Action & Adventure', 'Kids', 'News', 'Sci-Fi & Fantasy', 'Soap', 'Talk', 'War & Politics'];
