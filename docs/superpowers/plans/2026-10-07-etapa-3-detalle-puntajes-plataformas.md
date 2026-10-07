# Pelis By Pili — Etapa 3 (Detalle, puntajes y plataformas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al tocar un título de la lista se abra su detalle con sinopsis, puntajes de IMDb, Rotten Tomatoes, Metacritic y TMDB (guardados con fecha) y dónde verlo en Argentina, que la lista muestre IMDb y Rotten Tomatoes en cada tarjeta, y que Ajustes muestre las atribuciones de TMDB, JustWatch y OMDb.

**Architecture:**
- Una Edge Function nueva, `title-detail`, recibe solo el `id` de un título de la lista.
  - Lo lee con la sesión de quien llama, así RLS impide abrir títulos de otro espacio.
  - Pide a TMDB el detalle en una sola consulta (`append_to_response=external_ids,watch/providers`).
  - Si los puntajes guardados tienen más de 7 días, o no hay, consulta OMDb con el id de IMDb y los guarda en la fila del título con la clave de servicio.
  - Devuelve sinopsis, puntajes, si están desactualizados y plataformas de Argentina.
- Los puntajes viven en columnas nuevas de `titles`. Así la lista los lee sin consultas extra, y se cuidan las 1.000 consultas diarias de OMDb.
- Las plataformas no se guardan; se consultan al abrir el detalle (spec, sección 5).
- Al agregar un título, la app pide su detalle en segundo plano para que la tarjeta ya tenga puntajes. La lista escucha también los `UPDATE` de Realtime.

**Tech Stack:** lo de la etapa 2 (Vite, React, TypeScript, Vitest, Supabase con Edge Functions y Realtime, Supabase local en Docker). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 3, 5, 6, 7, 9 y Etapa 3). Notas: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` (puntos 1 y 2) y `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Costo cero. OMDb gratis: 1.000 consultas por día.
- `OMDB_API_KEY` y `TMDB_API_KEY` viven solo como secretos de las Edge Functions y en `.env.local`. Nunca van al cliente.
- Solo los miembros del espacio pueden abrir el detalle de sus títulos. Los puntajes se escriben solo desde la función; el cliente sigue sin permiso de `update` sobre `titles`.
- Interfaz en español rioplatense; los textos exactos están en cada tarea. Si falta un dato se muestra "—" (spec, sección 9).
- Alcance estricto. **No entra:** marcar vista, puntaje propio, pestaña "Vistas", filtros y lista sin conexión.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md` con su motivo. Los puntos menores que deje la revisión final se suman a la Etapa 12 de la spec.
- Decisiones de este plan, a confirmar con Nacho:
  - **Puntajes en columnas de `titles`:** se renuevan al abrir el detalle si tienen más de 7 días.
  - **Puntaje de TMDB:** se guarda y se muestra junto a los otros (spec, sección 3: "IMDb, Rotten Tomatoes, Metacritic, TMDB").
  - **Tarjeta de la lista:** muestra "IMDb 8.5 · RT 99%", con "—" si falta alguno (spec, sección 7).
  - **Agregar:** dispara la consulta del detalle en segundo plano, para que la tarjeta tenga puntajes sin abrirla.
  - **Logo de TMDB en Ajustes:** el archivo oficial se descarga de themoviedb.org (paso con permiso de Nacho).
- Verificado el 2026-10-06 y el 2026-10-07 con las claves reales:
  - Una consulta a `/3/{movie|tv}/{id}?append_to_response=external_ids,watch/providers` trae sinopsis, `vote_average`, el id de IMDb y `results.AR` con `link`, `flatrate`, `rent` y `buy`.
  - OMDb devuelve Rotten Tomatoes para Breaking Bad pero no para Dark ni The Office, y Metacritic falta en las tres series. Un id inexistente responde `{"Response":"False","Error":"Error getting data."}`.

## Review Focus

Entradas o fallas que la spec implica y que más pueden molestar, de la más a la menos probable:

1. **Una serie sin Rotten Tomatoes ni Metacritic** (Dark, The Office), o con `"N/A"`: se muestra "—" en esos puntajes, sin error. Probado en las Tasks 2 y 5.
2. **Se acabaron las consultas diarias de OMDb:** se muestran los puntajes guardados y el aviso "Hoy no se pudieron actualizar los puntajes". La fecha guardada no cambia, así se vuelve a intentar al otro día. Probado en la Task 2.
3. **Título sin plataformas en Argentina:** se muestra "Sin información de dónde verla", y el resto del detalle funciona. Probado en las Tasks 2 y 5.
4. **Título sin id de IMDb** (series poco conocidas): no se consulta OMDb, los puntajes de OMDb quedan en "—" y el de TMDB se muestra igual. Probado en la Task 2.
5. **Abrir el detalle sin conexión o con la función caída:** se ve al instante lo guardado (nombre, póster, puntajes con su fecha) y "No se pudo cargar el detalle. Probá de nuevo." con "Reintentar". Probado en la Task 5.

---

### Task 1: Columnas de puntajes y Realtime de cambios

**Files:**
- Create: `supabase/migrations/20261008000000_title_ratings.sql`
- Test: `tests/security/ratings.test.ts`

**Interfaces:**
- Consumes: la tabla `titles` y los helpers de `tests/security/helpers.ts` (`createTestUser`, `createCouple`, `adminClient`, `cleanup`).
- Produces (SQL), columnas nuevas en `public.titles`, todas `null` por defecto:
  - `imdb_rating text`, check largo ≤ 10 (como lo da OMDb: `"8.5/10"`).
  - `rotten_tomatoes text`, check largo ≤ 10 (`"99%"`).
  - `metacritic text`, check largo ≤ 10 (`"97/100"`).
  - `tmdb_rating numeric(3,1)`, check entre 0 y 10.
  - `ratings_updated_at timestamptz`.
  - Siguen sin existir el permiso y la política de `update` para `authenticated`.

- [ ] **Step 1: Escribir los tests de seguridad que fallan**

En `tests/security/ratings.test.ts`: A y B comparten un espacio, C tiene uno propio, y `afterAll(cleanup)`. A agrega un título.
- `members cannot write ratings`: A hace `update({ imdb_rating: '10/10' })` sobre su título → error. Con el cliente admin, `imdb_rating` sigue en `null`.
- `the partner receives rating updates in realtime and an outsider does not`:
  - B y C se suscriben a `UPDATE` en `public.titles` con filtro `couple_id=eq.<espacio de A>` y esperan el aviso de sistema `postgres_changes` `ok`, como en `titles.test.ts`.
  - El cliente admin actualiza `imdb_rating = '8.5/10'` y `ratings_updated_at = now()` en el título de A.
  - B recibe el `UPDATE` con `imdb_rating: '8.5/10'` en menos de 10 s; 3 s después, C no recibió nada.
- `rating values are validated`: con el cliente admin, `imdb_rating` de 11 caracteres → `23514`; `tmdb_rating = 11` → `23514`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm run test:security -- tests/security/ratings.test.ts`
Expected: FAIL (las columnas no existen).

- [ ] **Step 3: Escribir la migración, aplicarla en local y verificar**

No hace falta tocar la publicación de Realtime: `titles` ya está en `supabase_realtime`, que incluye los `UPDATE`.

Run: `npx supabase db reset && npm run test:security`
Expected: PASS en todos los tests de seguridad.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations tests/security && git commit -m "feat: columnas de puntajes en títulos"
```

### Task 2: Lógica del detalle (pura y testeada)

**Files:**
- Create: `supabase/functions/_shared/omdb.ts` (mover acá `summarizeOmdb` y `RatingsSummary` desde `scripts/verify/lib.ts`), `supabase/functions/title-detail/lib.ts`
- Modify:
  - `scripts/verify/omdb-ratings.ts`: importa de `../../supabase/functions/_shared/omdb.ts`.
  - `tsconfig.node.json`: incluir `supabase/functions/_shared` y `supabase/functions/*/lib*.ts`, en lugar de las rutas sueltas de `tmdb-search`.
- Delete: `scripts/verify/lib.ts` y `scripts/verify/lib.test.ts` (los tests pasan a `_shared/omdb.test.ts`).
- Test: `supabase/functions/_shared/omdb.test.ts`, `supabase/functions/title-detail/lib.test.ts`

**Interfaces:**
- Produces, en `_shared/omdb.ts`:
  - `RatingsSummary` y `summarizeOmdb(json)`, sin cambios. El valor `"N/A"` cuenta como `null`.
  - `export function isOmdbLimit(json: { Response?: string; Error?: string }): boolean`: `true` si `Response === 'False'` y `Error` contiene "limit", sin distinguir mayúsculas.
- Produces, en `title-detail/lib.ts`:
  - `export type Provider = { name: string; logoPath: string | null }`.
  - `export type Providers = { link: string | null; subscription: Provider[]; rent: Provider[]; buy: Provider[]; free: Provider[] }`.
  - `export type StoredRatings = { imdb: string | null; rottenTomatoes: string | null; metacritic: string | null; tmdb: number | null; updatedAt: string | null }`.
  - `export type TitleDetail = { overview: string; ratings: StoredRatings; ratingsStale: boolean; providers: Providers | null }`.
  - `export function parseTitleId(body: unknown): string | null`: devuelve `body.titleId` si es un UUID; si no, `null`.
  - `export function needsRefresh(updatedAt: string | null, now: Date): boolean`: `true` si es `null` o tiene 7 días o más.
  - `export function pickImdbId(details: { imdb_id?: string | null; external_ids?: { imdb_id?: string | null } }): string | null`.
  - `export function toProviders(ar: unknown): Providers | null`:
    - `null` si no hay datos para AR o si las cuatro listas quedan vacías.
    - `free` junta `free` y `ads` sin repetir proveedores.
    - Cada lista se ordena por `display_priority`.
  - `export function mergeRatings(stored: StoredRatings, omdb: unknown | null, tmdbScore: number | null, now: Date): { ratings: StoredRatings; stale: boolean; save: boolean }`:
    - `omdb === null` significa que no se consultó (sin id de IMDb, o puntajes vigentes). Si estaban vigentes, devuelve los guardados con `save: false`. Si no hay id de IMDb, guarda `tmdb` y la fecha, con los tres de OMDb en `null`.
    - Si OMDb respondió el límite (`isOmdbLimit`): devuelve los guardados, `stale: true`, `save: false`.
    - Si OMDb respondió bien, o `Response: 'False'` por otro motivo: toma `summarizeOmdb`, `tmdb = tmdbScore` redondeado a un decimal y `updatedAt = now`, con `save: true`.

- [ ] **Step 1: Escribir los tests que fallan**

- `omdb.test.ts`:
  - Los 3 tests que hoy están en `scripts/verify/lib.test.ts`.
  - `N/A counts as missing`: `{ Ratings: [{ Source: 'Metacritic', Value: 'N/A' }] }` → `metacritic: null`.
  - `isOmdbLimit`: `{ Response: 'False', Error: 'Request limit reached!' }` → `true`; `{ Response: 'False', Error: 'Error getting data.' }` → `false`; `{ Response: 'True' }` → `false`.
- `title-detail/lib.test.ts`:
  - `parseTitleId accepts only UUIDs`: un `crypto.randomUUID()` pasa; `'abc'`, `{}`, `null` y `{ titleId: 3 }` → `null`.
  - `needsRefresh`: `null` → `true`; hace 6 días → `false`; hace 7 días → `true`.
  - `pickImdbId`: lo toma de `imdb_id` (películas) o de `external_ids.imdb_id` (series); sin ninguno → `null`.
  - `toProviders`:
    - Con el fixture `{ link: 'https://www.themoviedb.org/movie/496243/watch?locale=AR', flatrate: [{ provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 2 }, { provider_name: 'Prime Video', logo_path: '/p.jpg', display_priority: 1 }], rent: [...], ads: [{ provider_name: 'Pluto TV', ... }], free: [{ provider_name: 'Pluto TV', ... }] }`: `subscription` queda ordenada `['Prime Video', 'Netflix']` y `free` tiene un solo "Pluto TV".
    - `undefined` → `null`; `{ link: 'x' }`, sin listas → `null`.
  - `mergeRatings`:
    - **(a) Respuesta de OMDb para Parásitos** (`8.5/10`, `99%`, `97/100`) con `tmdbScore` 8.5 → los tres puntajes, `tmdb: 8.5`, `updatedAt` = `now.toISOString()`, `save: true`, `stale: false`.
    - **(b) Breaking Bad** (sin Metacritic) → `metacritic: null`.
    - **(c) Límite de OMDb** con puntajes guardados del 2026-09-01 → devuelve los guardados con su fecha, `stale: true`, `save: false`.
    - **(d) `omdb === null` con puntajes vigentes** → los guardados, `save: false`.
    - **(e) `omdb === null` sin id de IMDb** (`stored.updatedAt === null`), con `tmdbScore` 7.25 → `tmdb: 7.3`, los otros tres `null`, `save: true`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- supabase/functions`
Expected: FAIL.

- [ ] **Step 3: Implementar, mover `summarizeOmdb` y verificar**

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS. Además, `npx tsx --env-file=.env.local scripts/verify/omdb-ratings.ts` sigue imprimiendo los puntajes de Parásitos y Breaking Bad.

- [ ] **Step 4: Commit**

```bash
git add -A supabase/functions scripts tsconfig.node.json && git commit -m "feat: lógica del detalle de un título"
```

### Task 3: Función `title-detail`

**Files:**
- Create: `supabase/functions/title-detail/index.ts`
- Modify: `supabase/config.toml` (sección `[functions.title-detail]` con `verify_jwt = false`, igual que `tmdb-search`)
- Test: `tests/security/detail.test.ts`

**Interfaces:**
- Consumes: todo lo de la Task 2; la tabla `titles` con las columnas de la Task 1.
- Produces, la función desplegada:
  - Recibe `POST` con cuerpo `{ titleId: string }` y la sesión en `Authorization`.
  - Respuestas: `200 TitleDetail`, `400 { error: 'invalid_id' }`, `401 { error: 'unauthorized' }`, `404 { error: 'not_found' }` y `502 { error: 'upstream' }`.
  - Mismos encabezados CORS y respuesta a `OPTIONS` que `tmdb-search`.

- [ ] **Step 1: Escribir los tests de la función que fallan**

En `tests/security/detail.test.ts`: A y B comparten un espacio, C tiene uno propio. A agrega Parásitos (`movie` 496243) y Dark (`tv` 70523) con `addTitle`, o con un `insert` directo.
- `a member gets the detail of a movie`:
  - B llama `invoke('title-detail', { body: { titleId } })` con el id de Parásitos.
  - `overview` no está vacío; `ratings.imdb` es `/^\d\.\d\/10$/`; `ratings.rottenTomatoes` es `/%$/`; `ratings.tmdb` es un número; `ratingsStale` es `false`.
  - `providers.subscription` tiene al menos un proveedor con `name`.
- `the ratings are saved on the title with their date`: B lee el título y `imdb_rating` y `ratings_updated_at` ya no son `null`.
- `a series without Rotten Tomatoes or Metacritic shows them as missing`: con Dark, `ratings.imdb` existe y `ratings.metacritic` es `null`.
- `a second call within 7 days does not change the saved date`: dos llamadas seguidas devuelven el mismo `ratings.updatedAt`.
- `outsiders get 404`: C con el id de Parásitos → estado 404, sin cuerpo de detalle.
- `an invalid id gets 400 and anonymous callers get 401`.

Run: `npm run test:security -- tests/security/detail.test.ts`
Expected: FAIL (la función no existe).

- [ ] **Step 2: Escribir `index.ts`**

- **Sesión:** se valida igual que en `tmdb-search` (`getClaims`, `role === 'authenticated'`).
- **Título:** se lee con un cliente creado con la clave pública y el encabezado `Authorization` de quien llama, para que RLS se aplique: `select('id, tmdb_id, media_type, imdb_rating, rotten_tomatoes, metacritic, tmdb_rating, ratings_updated_at').eq('id', titleId).maybeSingle()`. Si no aparece, 404.
- **TMDB:** `https://api.themoviedb.org/3/<media_type>/<tmdb_id>?language=es-AR&append_to_response=external_ids,watch/providers&api_key=<TMDB_API_KEY>`.
- **OMDb:** solo si `needsRefresh` y hay id de IMDb: `https://www.omdbapi.com/?i=<imdb>&apikey=<OMDB_API_KEY>`. Si la consulta falla por red, se la trata como límite: puntajes guardados con `stale`.
- **Guardar:** si `mergeRatings` dice `save`, se actualizan las cinco columnas con un cliente de servicio (`SUPABASE_SERVICE_ROLE_KEY`).
- **Respuesta:** `overview` (el de TMDB, o `''`), `ratings`, `ratingsStale` y `toProviders(details['watch/providers']?.results?.AR)`.
- Las consultas a TMDB y OMDb usan `AbortSignal.timeout(8000)`. Si TMDB falla o se vence el tiempo, se devuelve 502.

- [ ] **Step 3: Servir en local y verificar**

Run: `npx supabase functions serve --env-file .env.local` (en segundo plano: sirve las dos funciones) y `npm run test:security`
Expected: PASS, incluidos los de `detail.test.ts`.

- [ ] **Step 4: Secreto y despliegue en el proyecto real**

Nacho crea el secreto `OMDB_API_KEY` en el panel de Supabase (**Edge Functions → Secrets**). Verificar con `npx supabase secrets list` que el nombre aparece.

Run: `npx supabase db push` (Nacho, en su terminal); después, `npx supabase functions deploy title-detail --use-api` y una sola corrida de `npm run test:security:remote`
Expected: la migración y la función se aplican sin errores, y los tests pasan contra el proyecto real.

- [ ] **Step 5: Commit**

```bash
git add supabase tests/security && git commit -m "feat: función de detalle con puntajes y plataformas"
```

### Task 4: Puntajes y detalle en el cliente

**Files:**
- Create: `src/features/titles/detailApi.ts`, `src/features/titles/ratings.ts`
- Modify: `src/features/titles/titlesApi.ts`, `src/features/titles/AddTitle.tsx`
- Test: `src/features/titles/detailApi.test.ts`, `src/features/titles/ratings.test.ts`; tests nuevos en `titlesApi.test.ts` y `AddTitle.test.tsx`

**Interfaces:**
- Consumes: `TitleDetail` y los tipos de la Task 2, con `import type` desde `supabase/functions/title-detail/lib.ts`.
- Produces:
  - **`Title` suma cinco campos:** `imdbRating: string | null`, `rottenTomatoes: string | null`, `metacritic: string | null`, `tmdbRating: number | null` y `ratingsUpdatedAt: string | null`. `listTitles` los mapea.
  - **`addTitle` devuelve `Promise<string>`,** el `id` del título nuevo (`insert(...).select('id').single()`). Los errores siguen igual.
  - **`subscribeTitles` suma** una escucha de `UPDATE` con el mismo filtro `couple_id=eq.<coupleId>`, que también llama a `onChange`.
  - **`detailApi.ts`:** `export async function fetchTitleDetail(titleId: string): Promise<TitleDetail>`. Llama a `supabase.functions.invoke('title-detail', { body: { titleId } })` y lanza `Error` ante cualquier fallo.
  - **`ratings.ts`:**
    - `imdbScore(raw)`: `'8.5/10'` → `'8.5'`.
    - `rtScore(raw)`: `'99%'` → `'99%'`.
    - `metacriticScore(raw)`: `'97/100'` → `'97'`.
    - `tmdbScore(n)`: `8.5` → `'8.5'`, `8` → `'8.0'`.
    - Con `null` o un valor que no se puede leer, todas devuelven `'—'`.
    - `ratingsDate(iso)`: `'2026-10-07T15:00:00Z'` → `'7/10/2026'`, con `toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })`.
  - **`AddTitle`:** después de un `addTitle` exitoso llama a `fetchTitleDetail(id)` sin esperarlo y sin mostrar sus errores. La función guarda los puntajes y Realtime actualiza la tarjeta.

- [ ] **Step 1: Escribir los tests que fallan**

- `ratings.test.ts`: los casos de arriba, y `'N/A'`, `''` y `null` → `'—'`.
- `detailApi.test.ts`:
  - Llama a `invoke('title-detail', { body: { titleId: 't1' } })` y devuelve `data`.
  - Si `invoke` devuelve `error`, rechaza.
- `titlesApi.test.ts`:
  - `listTitles` mapea las cinco columnas nuevas.
  - `addTitle` devuelve el id que devuelve `select('id').single()`.
  - `subscribeTitles` registra un `UPDATE` con el filtro del espacio.
- `AddTitle.test.tsx`:
  - `adding a title asks for its detail in the background`: tras agregar, `fetchTitleDetail` se llama con el id que devolvió `addTitle`.
  - Si `fetchTitleDetail` rechaza, igual se ve "✓ Agregada" y no aparece ningún error.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/titles`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: puntajes y detalle en el cliente"
```

### Task 5: Pantalla de detalle, puntajes en la lista y atribuciones

**Files:**
- Create: `src/features/titles/TitleDetail.tsx`, `public/tmdb-logo.svg`
- Modify: `src/features/titles/TitleList.tsx` (tocar una tarjeta abre el detalle; puntajes en la tarjeta), `src/features/settings/Settings.tsx`, `src/app/styles.css`
- Test: `src/features/titles/TitleDetail.test.tsx`; tests nuevos en `TitleList.test.tsx` y `Settings.test.tsx`

**Interfaces:**
- Consumes: `fetchTitleDetail` y `ratings.ts` (Task 4), `TitleCard`, `useMemberName` y `removeTitle`.
- Produces: `TitleDetail(props: { title: Title; onClose: () => void }): JSX.Element`.

- [ ] **Step 1: Bajar el logo de TMDB (pide permiso a Nacho)**

De la página oficial de logos de TMDB (themoviedb.org/about/logos-attribution), bajar el logo SVG rectangular a `public/tmdb-logo.svg`. Antes, decirle a Nacho el nombre del archivo, la fuente y el tamaño, y esperar su OK.

- [ ] **Step 2: Escribir los tests que fallan** (APIs simuladas)

- `TitleList`:
  - Cada tarjeta muestra "IMDb 8.5 · RT 99%" a partir de lo guardado. Sin puntajes muestra "IMDb — · RT —".
  - Tocar el título de una tarjeta (un botón con el nombre del título) abre el detalle, y "Volver" vuelve a la lista.
- `TitleDetail`:
  - **Al abrir, sin esperar la función:** muestra el póster grande (`w342`), el nombre, "Original: …", año y tipo, "La agregó <nombre>", la nota y los puntajes guardados.
  - **Mientras carga:** "Cargando el detalle…".
  - **Con la respuesta:**
    - Encabezado "Sinopsis" con el texto; si `overview` está vacío, "Sin sinopsis".
    - Encabezado "Puntajes" con cuatro filas: "IMDb 8.5", "Rotten Tomatoes 99%", "Metacritic 97" y "TMDB 8.5", con "—" en los que falten.
    - Debajo, "Actualizados el 7/10/2026".
  - **`ratingsStale: true`:** muestra "Hoy no se pudieron actualizar los puntajes".
  - **Plataformas:** encabezado "Dónde verla en Argentina".
    - Grupos "Suscripción", "Alquiler", "Compra" y "Gratis", solo los que tienen proveedores. Cada proveedor con su logo (`https://image.tmdb.org/t/p/w92<logoPath>`, `alt` = nombre) y su nombre.
    - Si `link` existe, un enlace "Ver opciones en TMDB" que se abre en otra pestaña.
    - Debajo, "Fuente: JustWatch".
    - Con `providers: null`: "Sin información de dónde verla".
  - **Si `fetchTitleDetail` falla:** siguen visibles los datos guardados, y aparece "No se pudo cargar el detalle. Probá de nuevo." con "Reintentar", que vuelve a llamar.
  - **Quitar:** el detalle tiene "Quitar", con la misma confirmación que la lista. Si se acepta, llama a `removeTitle` y después a `onClose`.
  - **Contenido de la pantalla:** no muestra "null" ni "undefined" en ningún caso.
- `Settings`:
  - Muestra el logo de TMDB (`img` con `alt` "TMDB") junto a la frase de atribución.
  - Muestra "Datos de dónde ver cada título: JustWatch.".
  - Muestra "Puntajes de IMDb, Rotten Tomatoes y Metacritic vía OMDb API (CC BY-NC 4.0). No afiliado con IMDb.".

- [ ] **Step 3: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 4: Implementar y verificar**

`TitleDetail` se muestra en lugar de la lista, dentro de la pestaña "Lista", igual que `AddTitle`.

Run: `npm test && npm run typecheck && npx oxlint && npm run build`
Expected: PASS.

- [ ] **Step 5: Revisión visual en local**

Run: `npx vite --mode test` (contra el Supabase local, con las dos funciones servidas). Entrar con un usuario de prueba (el código llega a Mailpit, en `http://127.0.0.1:54324`), agregar "Parásitos" y "Dark", y abrir los dos detalles.

Expected:
- Las tarjetas muestran IMDb y RT sin necesidad de abrirlas.
- El detalle de Dark muestra "—" en Metacritic.
- Las plataformas aparecen con logo.
- Ajustes muestra las tres atribuciones.

- [ ] **Step 6: Commit**

```bash
git add src public && git commit -m "feat: detalle con puntajes y plataformas, y atribuciones"
```

### Task 6: Publicación y aceptación en los dos iPhones

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-10-verificacion-fuentes.md`: sección "Cierre de la Etapa 3", con Rotten Tomatoes en una serie más.
  - `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`: los puntos menores de la revisión final van a la Etapa 12.

- [ ] **Step 1: Suite completa**

Run: `npm test && npm run test:security && npm run typecheck && npm run build`. Contra el proyecto real, una sola corrida de `npm run test:security:remote`.
Expected: todo en verde.

- [ ] **Step 2: Publicar**

Antes de publicar, revisar que `dist/` no contenga los nombres ni los valores de las claves secretas, ni `127.0.0.1:54321`.

Run: `npx netlify-cli deploy --prod --no-build --dir=dist`
Expected: `HTTP/2 200`, y el bundle publicado es el mismo que el local.

- [ ] **Step 3: Prueba de aceptación con Nacho y Pili**

1. Los títulos que ya estaban en la lista muestran "IMDb — · RT —" hasta que alguien abre su detalle. Al abrirlo, la tarjeta se actualiza en los dos iPhones.
2. Nacho agrega una película: la tarjeta muestra IMDb y RT en unos segundos, sin abrirla.
3. Pili abre una película y una serie: cada una muestra sinopsis, los cuatro puntajes ("—" donde falte), la fecha y dónde verla en Argentina, con "Fuente: JustWatch".
4. Ajustes muestra el logo de TMDB y las tres atribuciones.

Anotar los resultados en las notas.

- [ ] **Step 4: Commit**

```bash
git add docs && git commit -m "docs: cierre de la Etapa 3"
```

**Cierre de la Etapa 3:** una película y una serie muestran sus puntajes y las atribuciones están visibles. **No entra** (no adelantar): marcar vista, puntaje propio, "Vistas", filtros y lista sin conexión.
