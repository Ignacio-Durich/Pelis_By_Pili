# Pelis By Pili — Etapa 2 (Agregar y ver la lista) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Nacho o Pili busquen una película o serie por cualquiera de sus nombres (español latino, España o inglés), la agreguen con un toque (con nota de origen opcional) o la quiten, y que a la otra persona le aparezca el cambio en la lista "Por ver" sin recargar.

**Architecture:**
- La búsqueda pasa por una Edge Function de Supabase (`tmdb-search`). La función valida la sesión y consulta TMDB en tres idiomas a la vez (`es-MX`, `es-AR` y `en-US`); el idioma cambia con qué nombres compara TMDB. Después une los resultados.
- Los títulos viven en una tabla `titles` protegida por RLS con el mismo `is_member(couple_id)` de la etapa 1. El cliente inserta y borra directo: RLS controla el espacio y el autor, y una restricción `unique` impide duplicados.
- La lista se actualiza con Supabase Realtime. Cualquier cambio, reconexión o vuelta de la app al frente vuelve a pedir la lista completa.
- Los tests de seguridad corren contra un Supabase local en Docker (OrbStack), no contra el proyecto real.

**Tech Stack:** lo de la etapa 1 (Vite, React, TypeScript, Vitest + Testing Library, Supabase) más Supabase Edge Functions (Deno), Supabase Realtime y el Supabase local del CLI (Docker vía OrbStack). Sin dependencias nuevas en `package.json`.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 2, 4, 5, 6, 7, 9 y Etapa 2). Notas: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` y `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Costo cero: Supabase Free (Edge Functions incluidas) y Netlify Free.
- Las claves de TMDB y OMDb nunca van al cliente. `TMDB_API_KEY` vive como secreto de la Edge Function y en `.env.local` para scripts.
- Solo los dos miembros del espacio leen, agregan o quitan títulos de ese espacio. Nadie ajeno ve sus datos, ni por consulta ni por Realtime.
- Interfaz en español rioplatense; los textos exactos están en cada tarea.
- Alcance estricto. **No entra:** puntajes, detalle, marcar vista, pestaña "Vistas", filtros, plataformas, lista sin conexión.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md` con su motivo.
- Decisiones confirmadas por Nacho el 2026-10-06:
  - La intermediaria con TMDB es una Edge Function de Supabase.
  - "Quién la cargó" se muestra como "vos" o "tu pareja".
  - La frase de atribución de TMDB va en Ajustes desde esta etapa. El logo y JustWatch quedan para la etapa 3.
  - **Quitar títulos de la lista** entra en esta etapa, aunque la spec no lo nombra. Cualquiera de los dos puede quitar cualquier título del espacio, con confirmación.
  - **Buscar por el nombre en inglés y por los nombres de cada región.**
- Nombres que se muestran, verificados contra TMDB el 2026-10-06:
  - **Nombre principal:** el latino (`es-MX`), que es el que se usa en Argentina ("Duro de matar", "Mi pobre angelito"). `es-AR` devuelve los de España ("Jungla de cristal", "Solo en casa").
  - **Sinopsis:** la de `es-AR`, que viene más completa.
  - **Nombre original:** se muestra debajo cuando es distinto.

## Review Focus

Entradas o fallas que la spec implica y que más pueden molestar, de la más a la menos probable:

1. Buscar por otro nombre: el de España ("solo en casa"), el latino ("mi pobre angelito") o el inglés ("parasite", "wild tales"). El título aparece en la primera página de resultados y se muestra con su nombre latino y el original. Probado en la Task 2.
2. Escribir rápido en el buscador: una respuesta vieja que llega tarde no pisa los resultados de la búsqueda actual. Probado en la Task 5.
3. Los dos agregan el mismo título casi a la vez, o uno quita un título mientras el otro mira la lista: queda una sola fila, el segundo ve "Ya está en la lista" y la lista de los dos se pone al día. Probado en las Tasks 1 y 5.
4. El celular vuelve de segundo plano o se cortó el Realtime: la lista se pone al día sola, al reconectar y al volver la app al frente. Probado en las Tasks 4 y 5.
5. Resultados sin póster, sin año o sin sinopsis, algo frecuente en series y títulos viejos: se muestra un recuadro gris y se omite el dato, nunca "null" ni "undefined". Probado en la Task 5.

---

### Task 0: Supabase local para los tests

**Files:**
- Modify: `vitest.security.config.ts`, `package.json`, `.env.example`
- Create: `.env.test.local` (ignorado por git; lo genera el paso 2)

**Interfaces:**
- Produces:
  - `npm run test:security`: corre contra el Supabase local por defecto.
  - `npm run test:security:remote`: corre contra el proyecto real.
  - `vitest.security.config.ts` carga las variables con `loadEnv(mode, cwd, '')`, donde `mode` es `'test'` salvo que `SUPABASE_TARGET=remote`; en ese caso es `'production'`. Vite pone `.env.test.local` por encima de `.env.local`, así que el modo `test` apunta al local.

- [ ] **Step 1: Levantar Supabase local**

Run: `npx supabase start`
Expected: levanta el stack (la primera vez descarga las imágenes) y aplica las migraciones de `supabase/migrations`.

- [ ] **Step 2: Generar `.env.test.local`**

Escribir `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` con los valores de `npx supabase status -o env` (`API_URL`, `ANON_KEY` y `SERVICE_ROLE_KEY`). Copiar también `TMDB_API_KEY` y `OMDB_API_KEY` desde `.env.local`. Comprobar con `git check-ignore .env.test.local` que está ignorado. En `.env.example`, agregar un comentario que explique para qué sirve `.env.test.local`.

- [ ] **Step 3: Verificar las dos variantes**

Run: `npm run test:security` y después `npm run test:security:remote`
Expected:
- Las dos pasan los 12 tests de la etapa 1.
- La URL del modo local empieza con `http://127.0.0.1`. Comprobarlo con un `console.log` temporal en el config o con `npx supabase status`, sin imprimir claves.

- [ ] **Step 4: Commit**

```bash
git add vitest.security.config.ts package.json .env.example && git commit -m "chore: tests de seguridad contra Supabase local"
```

### Task 1: Tabla de títulos, seguridad y Realtime

**Files:**
- Create: `supabase/migrations/20261007000000_titles.sql`
- Test: `tests/security/titles.test.ts`
- Modify: `tests/security/helpers.ts` (agregar `createCouple`)

**Interfaces:**
- Consumes:
  - De la etapa 1: `couples`, `couple_members`, `is_member`, `create_couple`, `create_invite` y `accept_invite`.
  - De `tests/security/helpers.ts`: `createTestUser`, `adminClient`, `anonClient` y `cleanup`.
- Produces (SQL): la tabla `public.titles`, con estas columnas:
  - `id uuid` primary key, default `gen_random_uuid()`.
  - `couple_id uuid not null`, referencia a `couples` con `on delete cascade`.
  - `tmdb_id integer not null`.
  - `media_type text not null`, check `in ('movie', 'tv')`.
  - `title text not null`, check largo 1–300.
  - `original_title text null`, check largo ≤ 300.
  - `year smallint null`, check 1870–2100.
  - `poster_path text null`, check `'^/[A-Za-z0-9_.-]+$'`.
  - `origin_note text null`, check largo ≤ 200.
  - `added_by uuid null`, default `auth.uid()`, referencia a `auth.users` con `on delete set null`.
  - `created_at timestamptz not null`, default `now()`.
  - `unique (couple_id, media_type, tmdb_id)`.

  La tabla se agrega a la publicación `supabase_realtime`.
- Produces (tests): `createCouple(a, b?)` en `helpers.ts`. `a` crea el espacio; si viene `b`, `a` lo invita y `b` acepta. Devuelve el `coupleId`.

- [ ] **Step 1: Escribir los tests de seguridad que fallan**

En `tests/security/titles.test.ts`: A y B comparten un espacio, C tiene un espacio propio, y `afterAll(cleanup)`. Título de prueba: `{ couple_id, tmdb_id: 496243, media_type: 'movie', title: 'Parásitos', original_title: '기생충', year: 2019, poster_path: '/abc.jpg' }`.
- `a member adds a title and the partner reads it`: A inserta; B lee una fila con `added_by` = id de A y `origin_note` null.
- `the same title twice fails with 23505`: B inserta el mismo `tmdb_id` y `media_type` → `error.code === '23505'`. Queda una sola fila.
- `added_by cannot be forged`: B inserta otro título con `added_by` = id de A → error.
- `outsiders cannot read, add or remove`:
  - C lee `titles` y no ve ninguna fila con el `couple_id` de A.
  - C inserta con el `couple_id` de A → error.
  - C borra por `id` un título de A → la fila sigue existiendo (se comprueba con el cliente admin).
- `either member removes a title of the couple`: B borra el título que agregó A → la fila ya no existe.
- `no updates`: A hace un `update` directo → error; la fila sigue igual.
- `invalid values are rejected`: `poster_path: 'https://malo.example/x.jpg'` → `error.code === '23514'`; un `origin_note` de 201 caracteres → `23514`.
- `the partner receives changes in realtime and an outsider gets no data`:
  1. B y C se suscriben a `postgres_changes` sobre `public.titles`: `INSERT` con filtro `couple_id=eq.<espacio de A>`, y `DELETE` sin filtro (Realtime no filtra los borrados). Los dos esperan `SUBSCRIBED`.
  2. A inserta un título nuevo: B recibe el `INSERT` con ese `tmdb_id` en menos de 10 s; 3 s después, C no recibió ningún `INSERT`.
  3. A borra ese título: B recibe el `DELETE`. Si C recibe un `DELETE`, su `old` solo trae `id`, sin `couple_id` ni `title`.
- `anonymous clients cannot read titles`: el cliente anónimo no obtiene filas.

- [ ] **Step 2: Verificar que fallan**

Run: `npm run test:security -- tests/security/titles.test.ts`
Expected: FAIL (la tabla no existe).

- [ ] **Step 3: Escribir la migración**

Mismo patrón que `20261006000000_couples.sql`:
- RLS activado.
- `revoke all ... from anon, authenticated`; `grant select, insert, delete ... to authenticated`; `grant all ... to service_role`.
- Políticas para `authenticated`:
  - `select` con `is_member(couple_id)`.
  - `insert` con `with check (is_member(couple_id) and added_by = auth.uid())`.
  - `delete` con `is_member(couple_id)`.
- Sin política de `update`.
- Al final: `alter publication supabase_realtime add table public.titles;`.

- [ ] **Step 4: Aplicar en local y verificar que pasan**

Run: `npx supabase db reset && npm run test:security`
Expected: PASS en los 12 tests de la etapa 1 y los 9 nuevos.

- [ ] **Step 5: Aplicar en el proyecto real (Nacho, en su terminal) y verificar**

Run: `npx supabase db push`; después, `npm run test:security:remote`
Expected: la migración se aplica sin errores y los tests pasan también contra el proyecto real.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations tests/security && git commit -m "feat: tabla de títulos con RLS y Realtime"
```

### Task 2: Función de búsqueda en TMDB en tres idiomas

**Files:**
- Create: `supabase/functions/tmdb-search/lib.ts`, `supabase/functions/tmdb-search/index.ts`
- Modify:
  - `vite.config.ts`: agregar `'supabase/functions/**/*.test.ts'` a `test.include`.
  - `tsconfig.node.json`: incluir `supabase/functions/tmdb-search/lib.ts` y su test. `index.ts` queda afuera porque es Deno.
- Test: `supabase/functions/tmdb-search/lib.test.ts`, `tests/security/search.test.ts`

**Interfaces:**
- Produces, en `lib.ts` (TypeScript puro, sin APIs de Deno):
  - `export const SEARCH_LANGUAGES = ['es-MX', 'es-AR', 'en-US'] as const`
  - `export type SearchResult = { tmdbId: number; mediaType: 'movie' | 'tv'; title: string; originalTitle: string; year: number | null; posterPath: string | null; overview: string }`
  - `export function parseQuery(body: unknown): string | null`: toma `body.query` y recorta los espacios. Devuelve `null` si no es texto o si queda con menos de 2 o más de 100 caracteres.
  - `export function mergeSearches(byLanguage: Record<(typeof SEARCH_LANGUAGES)[number], unknown[]>): SearchResult[]`: recibe los `results` de `/3/search/multi` de cada idioma.
    - Conserva solo `media_type` `movie` y `tv`, y une por `media_type` + `id`.
    - **Orden:** primero el mejor puesto que tuvo cada título en cualquiera de los idiomas; a igual puesto, `popularity` de mayor a menor. Devuelve como máximo 20.
    - **`title`:** el de `es-MX`; si no está, el de `es-AR`; si no, el de `en-US`. En películas es `title`; en series, `name`.
    - **`originalTitle`:** `original_title` u `original_name`.
    - **`overview`:** el primero no vacío en el orden `es-AR`, `es-MX`, `en-US`, o `''`.
    - **`year`:** los 4 primeros dígitos de `release_date` o `first_air_date`, o `null` si falta o está vacía.
    - **`posterPath`:** `poster_path` o `null`.
- Produces, la función `tmdb-search` desplegada:
  - Recibe `POST` con cuerpo `{ query: string }` y la sesión del usuario en `Authorization`.
  - Respuestas: `200 { results: SearchResult[] }`, `400 { error: 'invalid_query' }`, `401 { error: 'unauthorized' }` y `502 { error: 'upstream' }`.
  - `OPTIONS` responde `204`. Todas las respuestas llevan `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` y `Access-Control-Allow-Methods: POST, OPTIONS`.

- [ ] **Step 1: Escribir los tests de `lib.ts` que fallan**

En `lib.test.ts`, con fixtures hechos a mano:
- `takes the Latin American title, the es-AR overview and the original title`: el mismo `{ media_type: 'movie', id: 771 }` llega en los tres idiomas con títulos "Mi pobre angelito" (es-MX), "Solo en casa" (es-AR) y "Home Alone" (en-US), `original_title: 'Home Alone'` y sinopsis distintas → `title: 'Mi pobre angelito'`, `originalTitle: 'Home Alone'`, `overview` = la de es-AR.
- `a title found only in English keeps its English name`: `id` 496243 solo en `en-US`, con `title: 'Parasite'` → aparece con `title: 'Parasite'`.
- `ranks by best position in any language`: X es 1º en `en-US` y no aparece en los demás; Y es 2º en `es-MX` → X va antes que Y.
- `ties are broken by popularity`.
- `maps a series`: `{ media_type: 'tv', id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', first_air_date: '2008-01-20', poster_path: null }` → `year: 2008`, `posterPath: null`.
- `drops people`; `missing or empty dates give a null year`; `missing overview gives ''`; `returns at most 20`.
- `parseQuery trims and validates`:
  - `{ query: '  parásitos ' }` → `'parásitos'`.
  - `{ query: 'a' }`, `{ query: '   ' }`, `{ query: 'x'.repeat(101) }`, `{}`, `null` y `{ query: 3 }` → `null`.
  - `'x'.repeat(100)` es válido.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- supabase/functions`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib.ts`**

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Escribir `index.ts`**

- Usar `Deno.serve`.
- Sesión: validarla con `createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'))` y `auth.getClaims(token)`, importando `npm:@supabase/supabase-js@2`. Se acepta solo si no hay error y `claims.role === 'authenticated'`; la clave pública también es un token válido, pero no es una sesión.
- TMDB: las tres consultas van en paralelo con `Promise.all`, una por idioma de `SEARCH_LANGUAGES`, a `https://api.themoviedb.org/3/search/multi?query=<query codificada>&language=<idioma>&include_adult=false&page=1&api_key=<TMDB_API_KEY>`. Si alguna falla, se devuelve 502.

- [ ] **Step 6: Escribir los tests de la función que fallan**

En `tests/security/search.test.ts`, con un usuario de `createTestUser` que llama a `client.functions.invoke('tmdb-search', { body: { query } })`:
- `finds a movie by its English name`: `'parasite'` devuelve el resultado `{ tmdbId: 496243, mediaType: 'movie' }` entre los primeros 5.
- `finds a movie by its Spain and Latin American names and shows the Latin one`: `'solo en casa'` y `'mi pobre angelito'` devuelven `{ tmdbId: 771 }`, con `title: 'Mi pobre angelito'` y `originalTitle: 'Home Alone'`.
- `a one-letter query is rejected`: `{ query: 'a' }` → error con estado 400.
- `anonymous callers get 401`: el cliente anónimo recibe un error con estado 401.

Run: `npm run test:security -- tests/security/search.test.ts`
Expected: FAIL (la función no existe).

- [ ] **Step 7: Servir la función en local y verificar**

Run: `npx supabase functions serve tmdb-search --no-verify-jwt --env-file .env.local` (en segundo plano) y `npm run test:security -- tests/security/search.test.ts`
Expected: PASS en los 4.

- [ ] **Step 8: Secreto y despliegue en el proyecto real**

Nacho crea el secreto `TMDB_API_KEY` en el panel de Supabase (**Edge Functions → Secrets**) con su clave de TMDB.

Run: `npx supabase functions deploy tmdb-search --use-api --no-verify-jwt`; después, `npm run test:security:remote`
Expected: el despliegue termina sin errores y los tests pasan contra el proyecto real. `--no-verify-jwt` deja la validación de la sesión al código, que funciona con las claves nuevas de Supabase.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions vite.config.ts tsconfig.node.json tests/security && git commit -m "feat: función de búsqueda en TMDB en tres idiomas"
```

### Task 3: API de títulos, búsqueda y usuario actual en el cliente

**Files:**
- Create: `src/features/auth/sessionContext.ts`, `src/features/titles/searchApi.ts`, `src/features/titles/titlesApi.ts`
- Modify: `src/features/auth/AuthGate.tsx` (envuelve a los hijos en `SessionContext`)
- Test: `src/features/titles/searchApi.test.ts`, `src/features/titles/titlesApi.test.ts`, `src/features/auth/AuthGate.test.tsx` (un test nuevo)

**Interfaces:**
- Consumes:
  - `supabase`, de `src/lib/supabase.ts`.
  - `SearchResult`, de la Task 2, con `import type` desde `supabase/functions/tmdb-search/lib.ts`.
  - La tabla `titles`, de la Task 1.
- Produces:
  - `sessionContext.ts`:
    - `export const SessionContext = createContext<Session | null>(null)`.
    - `export function useUserId(): string`. Lanza un error si se usa fuera de `AuthGate`.
  - `searchApi.ts`: `export async function searchTitles(query: string): Promise<SearchResult[]>`. Llama a `supabase.functions.invoke('tmdb-search', { body: { query } })` y lanza `Error` ante cualquier fallo.
  - `titlesApi.ts`:
    - `export type Title = { id: string; tmdbId: number; mediaType: 'movie' | 'tv'; title: string; originalTitle: string | null; year: number | null; posterPath: string | null; originNote: string | null; addedBy: string | null; createdAt: string }`.
    - `export type TitleErrorKind = 'duplicate' | 'network'` y `export class TitleError extends Error { kind: TitleErrorKind }`, sin parameter properties.
    - `listTitles(coupleId: string): Promise<Title[]>`:
      - Filtra por `couple_id`.
      - Ordena por `created_at` de más nuevo a más viejo.
      - Pasa las columnas a camelCase.
      - Cualquier error se convierte en `TitleError('network')`.
    - `addTitle(coupleId: string, result: SearchResult, originNote: string): Promise<void>`:
      - Manda `original_title`.
      - Recorta la nota; si queda vacía, manda `null`.
      - No manda `added_by`: lo pone la base.
      - El error `23505` es `duplicate`; cualquier otro, `network`.
    - `removeTitle(id: string): Promise<void>`. Cualquier error es `network`.
    - `subscribeTitles(coupleId: string, onChange: () => void): () => void`:
      - Un canal con dos escuchas de `postgres_changes` sobre `public.titles`: `INSERT` con filtro `couple_id=eq.<coupleId>`, y `DELETE` sin filtro.
      - Llama a `onChange` en cada evento y cada vez que el estado del canal pasa a `SUBSCRIBED`, incluidas las reconexiones.
      - Devuelve la función que quita el canal.
  - `AuthGate` entrega la sesión a sus hijos con `SessionContext`.

- [ ] **Step 1: Escribir los tests que fallan** (cliente de Supabase simulado)

- `searchApi`:
  - Llama a `invoke` con `'tmdb-search'` y `{ body: { query: 'parásitos' } }`, y devuelve `data.results`.
  - Si `invoke` devuelve `error`, rechaza.
- `titlesApi`:
  - `listTitles`:
    - Mapea las columnas a `Title`.
    - Filtra por `couple_id` y ordena por `created_at` descendente.
  - `addTitle`:
    - Inserta `{ couple_id, tmdb_id, media_type, title, original_title, year, poster_path, origin_note }`.
    - Si la nota es `'   '`, manda `origin_note: null`.
    - El error `{ code: '23505' }` es `duplicate`; otro error, `network`.
  - `removeTitle`:
    - Llama a `delete().eq('id', id)`.
    - Un error es `network`.
  - `subscribeTitles`:
    - Registra un `INSERT` filtrado y un `DELETE` sin filtro.
    - Llama a `onChange` ante cada evento y ante `SUBSCRIBED`.
    - La función que devuelve llama a `removeChannel`.
- `AuthGate`: `with a session the children can read the user id`. Un hijo que muestra `useUserId()` ve `'u1'`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/titles src/features/auth`
Expected: FAIL.

- [ ] **Step 3: Implementar los tres módulos y el provider en `AuthGate`**

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: API de títulos y búsqueda en el cliente"
```

### Task 4: Pantallas de lista y agregar

**Files:**
- Create:
  - `src/features/titles/TitleList.tsx`
  - `src/features/titles/AddTitle.tsx`
  - `src/features/titles/TitleCard.tsx`: la fila compartida, con póster, nombres, año y tipo.
- Modify:
  - `src/app/Home.tsx`: la pestaña "Lista" muestra `TitleList`.
  - `src/features/settings/Settings.tsx`: la atribución de TMDB.
  - `src/app/styles.css`
- Test:
  - `src/features/titles/TitleList.test.tsx` y `src/features/titles/AddTitle.test.tsx`
  - Actualizar `src/app/Home.test.tsx`, `src/app/App.test.tsx` y `src/features/settings/Settings.test.tsx`

**Interfaces:**
- Consumes:
  - De la etapa 1: `useCouple`.
  - De la Task 3: `useUserId`, `searchTitles`, `listTitles`, `addTitle`, `removeTitle`, `subscribeTitles`, `TitleError`, `Title` y `SearchResult`.
- Produces:
  - `TitleList(): JSX.Element`.
  - `AddTitle(props: { coupleId: string; titles: Title[]; onClose: () => void }): JSX.Element`.
  - `TitleCard(props: { title: string; originalTitle: string | null; year: number | null; mediaType: 'movie' | 'tv'; posterPath: string | null; children?: ReactNode }): JSX.Element`:
    - **Póster:** sale de `https://image.tmdb.org/t/p/w185<posterPath>`, con `alt=""`. Si no hay póster, un recuadro gris.
    - **Nombre original:** "Original: <nombre>" debajo del título, solo si es distinto al título (sin distinguir mayúsculas).
    - **Año y tipo:** "<año> · Película" o "<año> · Serie". Si no hay año, solo el tipo.

- [ ] **Step 1: Escribir los tests que fallan** (APIs simuladas)

- `TitleList`:
  - **Carga:** mientras carga muestra "Cargando…". Sin títulos muestra el encabezado "Por ver" y "Nuestra lista está vacía".
  - **Tarjetas:** cada título se muestra con `TitleCard`.
    - Si `addedBy` es el usuario actual, dice "La agregaste vos"; si no, "La agregó tu pareja".
    - Con `originNote` muestra "De dónde vino: <nota>".
    - Con `originalTitle` distinto muestra "Original: <nombre>".
    - Un título sin año ni póster no muestra "null" ni "undefined".
  - **Quitar:** cada tarjeta tiene un botón "Quitar".
    - Pide confirmación con `window.confirm('¿Quitar «<título>» de la lista?')`.
    - Si se acepta, llama a `removeTitle(id)`; si no, no llama.
    - Si `removeTitle` falla, muestra "No se pudo quitar. Probá de nuevo.".
  - **Actualización:** cuando `subscribeTitles` avisa un cambio, vuelve a llamar a `listTitles`. También lo hace ante `visibilitychange` con `document.visibilityState === 'visible'`. Al desmontarse quita la suscripción.
  - **Errores y navegación:**
    - Un fallo de red muestra "Sin conexión. Probá de nuevo." con "Reintentar".
    - El botón "+" (con `aria-label` "Agregar") abre `AddTitle`.
- `AddTitle`:
  - **Pantalla:**
    - Encabezado "Agregar".
    - Campo "Buscar película o serie": `type="search"`, `maxLength` 100, placeholder "En español o en inglés".
    - Campo "¿De dónde vino? (opcional)": `maxLength` 200, placeholder "Ej.: un reel, una recomendación".
    - Botón "Volver", que llama a `onClose`.
  - **Cuándo busca:** con 1 carácter no busca. Con 2 o más busca una sola vez, 400 ms después de la última tecla (timers falsos de Vitest).
  - **Estados:** mientras espera muestra "Buscando…". Sin resultados muestra "No encontramos nada con ese nombre". Si la búsqueda falla muestra "No se pudo buscar. Probá de nuevo.".
  - **Respuestas fuera de orden:** se busca "par" y después "parásitos", y la respuesta de "par" llega última. Se ven solo los resultados de "parásitos".
  - **Agregar:**
    - Tocar un resultado llama a `addTitle(coupleId, resultado, nota)` una sola vez, aunque se toque dos veces seguidas.
    - Después, ese resultado muestra "✓ Agregada" y el campo de la nota se vacía.
  - **Ya está en la lista:** un resultado que ya está en `titles` (mismo `tmdbId` y `mediaType`):
    - Muestra "Ya está en la lista (la agregaste vos)" o "Ya está en la lista (la agregó tu pareja)".
    - Queda deshabilitado y no llama a `addTitle`.
  - **Errores al agregar:** si `addTitle` falla con `duplicate`, muestra "Ya está en la lista"; con `network`, "No se pudo agregar. Probá de nuevo.".
- `Home`:
  - La pestaña "Lista" muestra `TitleList`, con las APIs simuladas.
  - Con un solo miembro sigue mostrando "Esperando a tu pareja".
- `Settings`: muestra la frase "This product uses the TMDB API but is not endorsed or certified by TMDB.".
- `App`: con sesión y espacio muestra el heading "Pelis By Pili" y "Por ver" (el `listTitles` simulado devuelve `[]`).

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar los componentes**

- **Orden de las respuestas:** un contador o un ref con la última consulta. Cuando llega una respuesta, se aplica solo si corresponde a la consulta actual.
- **Navegación:** `AddTitle` se muestra en lugar de la lista, dentro de la pestaña "Lista", sin router.
- **Estilos:**
  - La tarjeta lleva el póster a la izquierda (46×69 px) y el texto a la derecha.
  - La sinopsis del buscador se corta en 2 líneas (`-webkit-line-clamp`).
  - El botón "+" queda fijo abajo a la derecha, por encima de la barra de pestañas y respetando `env(safe-area-inset-bottom)`.

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck && npx oxlint && npm run build`
Expected: PASS, sin advertencias de lint y con el build correcto.

- [ ] **Step 5: Probar en local**

Run: `npm run dev`, contra el proyecto real. Hay que entrar con dos sesiones del mismo espacio, por ejemplo Nacho en una ventana normal y una cuenta `+pareja` en una privada.
1. Una sesión busca "wild tales" y la agrega con la nota "prueba".
2. Después, busca "mi pobre angelito".
3. Después, la otra sesión quita la primera.

Expected:
- **Búsqueda:** "Relatos salvajes" aparece entre los primeros resultados. "Mi pobre angelito" aparece con "Original: Home Alone".
- **Al agregar:** la otra ventana muestra el título sin recargar, con "La agregó tu pareja" y "De dónde vino: prueba".
- **Al quitar:** desaparece en las dos ventanas sin recargar.

Después, Nacho quita la cuenta de prueba desde el panel.

- [ ] **Step 6: Commit**

```bash
git add src && git commit -m "feat: lista Por ver en tiempo real, agregar y quitar"
```

### Task 5: Publicación y aceptación en los dos iPhones

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` (sección "Cierre de la Etapa 2")

- [ ] **Step 1: Suite completa**

Run: `npm test && npm run test:security && npm run test:security:remote && npm run typecheck && npm run build`
Expected: todo en verde.

- [ ] **Step 2: Publicar**

Antes de publicar, revisar que `dist/` no contenga los nombres ni los valores de `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY` y `OMDB_API_KEY`.

Run: `npx netlify-cli deploy --prod --no-build --dir=dist`
Expected: `curl -sI https://pelis-by-pili.netlify.app | head -n 1` devuelve `HTTP/2 200`.

- [ ] **Step 3: Prueba de aceptación con Nacho y Pili en sus iPhones**

Con las dos apps instaladas y abiertas:
1. Nacho busca una película por su nombre en inglés y la agrega con una nota. En el iPhone de Pili aparece sin recargar, con "La agregó tu pareja" y la nota.
2. Pili agrega una serie, y a Nacho le aparece sin recargar.
3. Pili busca la película que agregó Nacho y ve "Ya está en la lista (la agregó tu pareja)".
4. Nacho manda la app a segundo plano y Pili agrega otra. Cuando Nacho vuelve a la app, el título ya está.
5. Pili quita uno de los títulos y desaparece también en el iPhone de Nacho.

Anotar el resultado y las versiones de iOS en las notas.

- [ ] **Step 4: Commit**

```bash
git add docs && git commit -m "docs: cierre de la Etapa 2"
```

**Cierre de la Etapa 2:** una persona agrega un título y a la otra le aparece sin recargar. **No entra** (no adelantar): puntajes, detalle, marcar vista, "Vistas", filtros, plataformas y lista sin conexión.
