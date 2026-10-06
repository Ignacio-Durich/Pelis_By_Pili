# Verificación de fuentes externas

## 1. OMDb: Rotten Tomatoes en películas y series (2026-10-06)

`npx tsx --env-file=.env.local scripts/verify/omdb-ratings.ts`, con la clave gratuita real:

| Título | Response | IMDb | Rotten Tomatoes | Metacritic |
|---|---|---|---|---|
| Parasite (película, tt6751668) | True | 8.5/10 | 99% | 97/100 |
| Breaking Bad (serie, tt0903747) | True | 9.5/10 | 96% | — (null) |

Contra lo que decía el reporte de la comunidad citado en la spec, OMDb **sí** devolvió Rotten Tomatoes para una serie. Metacritic, en cambio, faltó para la serie. Es una sola muestra: puede variar según el título.

Impacto en el plan: no ocultar Rotten Tomatoes en series. Tratar los tres puntajes como opcionales en películas y en series y mostrar "—" cuando falte cualquiera (ya lo pide la spec, sección 9). Etapa 3: probar con al menos una serie más antes de cerrarla.

## 2. TMDB: región AR y proveedores (2026-10-06)

`npx tsx --env-file=.env.local scripts/verify/tmdb-providers.ts`, con la clave v3 real:

- Región `AR` en `/3/watch/providers/regions`: sí.
- Parasite (`/3/movie/496243/watch/providers`, `results.AR`): suscripción (`flatrate`) Netflix, Amazon Prime Video, MovistarTV; alquiler Apple TV Store, Google Play Movies; compra Apple TV Store, Google Play Movies.
- Breaking Bad (`/3/tv/1396/watch/providers`, `results.AR`): suscripción Netflix.

Impacto en el plan: la etapa 3 puede mostrar "dónde verla en Argentina" con `results.AR`, separando suscripción de alquiler y compra (una serie puede traer solo `flatrate`). Hay que mostrar la atribución a JustWatch (spec, sección 6). La etapa 5 puede filtrar por plataforma usando los nombres de `flatrate`.

## 3. Supabase: pausa de proyectos gratis y límite de emails (2026-10-06)

Fuente: documentación pública de Supabase, consultada el 2026-10-06. Falta confirmarlo en el panel del proyecto.

**Pausa por inactividad** ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)):

> "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week."

Según la misma página, unas pocas consultas por día a la base alcanzan para que no se pause; Supabase avisa por email al dueño alrededor de una semana antes, y un proyecto pausado se puede restaurar desde el panel durante un año.

Impacto en el plan: si pasan una semana sin abrir la app, el proyecto se pausa y la app deja de andar hasta restaurarlo a mano. Para etapas 2 a 4: el error de red (`network`) es lo que verían; conviene que el mensaje de "Sin conexión" no sea el único diagnóstico posible (anotar en la etapa 2) y, si molesta, programar una consulta diaria liviana (por ejemplo, una función programada de Netlify, gratis) — a decidir con Nacho.

**Límite de emails del servicio integrado** ([Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)):

> "Currently this value is set to 2 messages per hour."

La misma página aclara que, sin un servidor SMTP propio, Supabase solo entrega emails a direcciones que son parte del equipo de la organización del proyecto; a cualquier otra responde "Email address not authorized".

Impacto en el plan: afecta ya a la Etapa 1, no solo a las siguientes. La novia de Nacho no recibiría su código salvo que (a) se la agregue como miembro del equipo de la organización de Supabase, o (b) se configure un SMTP propio gratuito (por ejemplo, Gmail con contraseña de aplicación). Con 2 emails por hora, además, la prueba de la Task 8 con tres emails y la de la Task 9 se cortan por el límite. Recomendación: SMTP propio antes de las pruebas con emails reales (Task 6, paso 6).

## Publicación (2026-10-06)

- URL: https://pelis-by-pili.netlify.app (sitio `pelis-by-pili` en Netlify, equipo de Nacho).
- Se publica con `npm run build` y `npx netlify-cli deploy --prod --no-build --dir=dist`: el build corre en la compu y toma las dos variables públicas de `.env.local`, así que no hace falta cargar variables en Netlify.
- Antes de publicar se revisó `dist/`: no contiene los nombres ni los valores de `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY` ni `OMDB_API_KEY`.
- Netlify creó el sitio con protección de acceso (respondía 401 con login de Netlify); Nacho la desactivó en Visitor access.
- Verificado con curl: `/` responde `HTTP/2 200`; el manifest tiene `"display":"standalone"` y `"short_name":"Pelis"`; `/sw.js` y el apple-touch-icon responden 200; las rutas de la SPA (`/?invite=…`, `/alguna/ruta`) responden 200.
- Prueba en los iPhones: pendiente.
