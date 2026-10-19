# Recomendaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pestaña "Descubrir" con recomendaciones para los dos, para cada uno y novedades (cines y plataformas), "Parecidas a esta" en la ficha de cada vista, "Nuestras plataformas" en Ajustes, "No me interesa" con "Deshacer" y "Ver detalle" con la sinopsis.

**Architecture:** Una Edge Function nueva, `recommendations`, calcula todo al pedirlo, leyendo con la sesión de quien llama (RLS) y consultando TMDB; la lógica pura vive en `lib.ts` con tests de Vitest. La base suma `couples.platforms` y la tabla `dismissed_titles`, con escrituras solo por funciones `security definer`. En la app, una carpeta nueva `src/features/discover/` con la API, una lista de tarjetas reusable, la pantalla Descubrir y "Parecidas a esta"; Ajustes suma "Nuestras plataformas".

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + Testing Library, Supabase (Postgres, RLS, Edge Functions en Deno), TMDB API.

**Spec:** `docs/superpowers/specs/2026-10-19-recomendaciones-design.md`

## Global Constraints

- Todo texto de la app en español rioplatense, con los textos exactos del spec y de este plan.
- Nombres inventados en código, tests, docs y commits: Tomás (`u1`) y Juli (`u2`), como en `src/test/providers.tsx`. El repo es público.
- Escrituras en la base solo por funciones `security definer` con `set search_path = ''`; RLS activado; `revoke all ... from anon, authenticated`; `grant all ... to service_role` en cada tabla nueva (en producción no se da solo).
- Las claves de TMDB y OMDb no salen del servidor.
- La función nueva lleva `verify_jwt = false` en `supabase/config.toml` y valida la sesión ella misma (`getClaims`, rol `authenticated`), como `tmdb-search`.
- TMDB en `es-MX`; región y `watch_region` `AR`.
- Topes del spec: hasta 50 semillas; 30 por sección; 20 en "Parecidas a esta"; 10 visibles y "Ver más" suma 10; mínimo 50 votos solo en las secciones por gusto; ventana de novedades 90 días; hasta 30 plataformas.
- TDD: cada cambio arranca con un test que falla. Commits chicos en `main`, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pantallas revisadas a 390×844 y 393×852 antes de publicar.
- Antes de cerrar cada tarea: `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Review Focus

- Una persona sin puntajes: su opción del selector no aparece y "Para los dos" usa solo los puntajes del otro (tareas 2 y 6).
- Sin plataformas elegidas: "En sus plataformas" muestra la invitación a Ajustes en lugar de una lista vacía (tareas 3 y 6).
- Agregar algo que el otro agregó un momento antes: aparece "Ya está en la lista", no un error genérico, y la tarjeta queda como estaba (tarea 5).
- El mismo título en dos secciones (por ejemplo "Para los dos" y "En sus plataformas"): descartarlo o agregarlo en una lo saca de la otra (tareas 5 y 6).
- Puntajes que cambian con Descubrir ya cargado: al volver a la pestaña se piden de nuevo; sin cambios, sale de la memoria sin llamar (tareas 4 y 6).

---

## Archivos

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20261019000000_recommendations.sql` | `couples.platforms`, `set_platforms`, `dismissed_titles`, `dismiss_title`, `undismiss_title` |
| `supabase/functions/recommendations/lib.ts` | Lógica pura: pedido, pesos, orden, exclusiones, géneros, novedades, temporada nueva |
| `supabase/functions/recommendations/lib.test.ts` | Tests de la lógica pura |
| `supabase/functions/recommendations/index.ts` | Sesión, lectura con RLS, consultas a TMDB |
| `supabase/functions/tmdb-search/lib.ts` | Exporta `toSearchResult` (sale de `personTitles`) para reusarlo |
| `supabase/config.toml` | `[functions.recommendations]` |
| `tests/security/recommendations.test.ts` | Permisos de la base y de la función |
| `src/features/discover/discoverApi.ts` | Llamadas a la función y a las funciones SQL; memoria de Descubrir |
| `src/features/discover/RecommendationList.tsx` | Tarjetas: agregar, ver detalle, descartar, "Ver más" |
| `src/features/discover/Discover.tsx` | Pestaña Descubrir |
| `src/features/discover/SimilarTitles.tsx` | "Parecidas a esta" |
| `src/features/settings/Platforms.tsx` | "Nuestras plataformas" |
| `src/features/titles/TitleDetail.tsx` | Suma `SimilarTitles` en vistas |
| `src/features/settings/Settings.tsx` | Suma `Platforms` |
| `src/app/Home.tsx` | Pestaña Descubrir |
| `src/app/styles.css` | Estilos de tarjetas y plataformas |

---

### Task 1: Base de datos — plataformas y descartes

**Files:**
- Create: `supabase/migrations/20261019000000_recommendations.sql`
- Test: `tests/security/recommendations.test.ts`

**Interfaces:**
- Produces:
  - `couples.platforms int[] not null default '{}'`, con `check (cardinality(platforms) <= 30)`.
  - `set_platforms(p_ids int[]) returns void`: guarda los IDs sin repetidos, en el orden recibido. Errores: `no_couple` (sin espacio), `invalid_platforms` (algún ID ≤ 0, nulo, o más de 30).
  - Tabla `dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by, created_at)`, PK `(couple_id, media_type, tmdb_id)`, `media_type in ('movie','tv')`, `tmdb_id > 0`, `dismissed_by references auth.users on delete set null`. Política `select` para miembros (`public.is_member(couple_id)`).
  - `dismiss_title(p_media_type text, p_tmdb_id int) returns void` (si ya estaba, no hace nada) y `undismiss_title(p_media_type text, p_tmdb_id int) returns void`. Errores: `no_couple`, `invalid_title`.
  - Las tres funciones: `revoke execute ... from public, anon; grant execute ... to authenticated`.

- [ ] **Step 1: Write the failing tests** en `tests/security/recommendations.test.ts`, con el esquema de `tests/security/feedback.test.ts` (dos usuarios A y B en un espacio, un tercero C en otro):

```ts
test('a member sets the platforms and both read them, without repeats', async () => {
  expect((await A.client.rpc('set_platforms', { p_ids: [8, 337, 8] })).error).toBeNull()
  const { data } = await B.client.from('couples').select('platforms').eq('id', couple).single()
  expect(data?.platforms).toEqual([8, 337])
})
test('invalid platform lists are rejected', async () => {
  for (const p_ids of [[0], [-3], Array.from({ length: 31 }, (_, i) => i + 1)])
    expect((await A.client.rpc('set_platforms', { p_ids })).error?.message).toBe('invalid_platforms')
})
test('a member dismisses a title, both see it, and undismiss brings it back', async () => {
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  const { data } = await B.client.from('dismissed_titles').select('media_type, tmdb_id, dismissed_by')
  expect(data).toEqual([{ media_type: 'movie', tmdb_id: 27205, dismissed_by: A.id }])
  expect((await B.client.rpc('undismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 })).error).toBeNull()
  expect((await A.client.from('dismissed_titles').select('*')).data).toEqual([])
})
test('another couple does not see the dismissed titles and nobody inserts directly', async () => {
  await A.client.rpc('dismiss_title', { p_media_type: 'tv', p_tmdb_id: 1396 })
  expect((await C.client.from('dismissed_titles').select('*')).data ?? []).toEqual([])
  const { error } = await A.client.from('dismissed_titles').insert({ couple_id: couple, media_type: 'tv', tmdb_id: 1 })
  expect(error?.code).toBe('42501')
})
test('bad titles, no couple and anonymous callers are rejected', async () => {
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'book', p_tmdb_id: 1 })).error?.message).toBe('invalid_title')
  expect((await A.client.rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 0 })).error?.message).toBe('invalid_title')
  const D = await createTestUser()
  expect((await D.client.rpc('set_platforms', { p_ids: [8] })).error?.message).toBe('no_couple')
  expect((await anonClient().rpc('dismiss_title', { p_media_type: 'movie', p_tmdb_id: 1 })).error).not.toBeNull()
})
test('service_role reads the dismissed titles', async () => {
  expect((await adminClient().from('dismissed_titles').select('*').eq('couple_id', couple)).error).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:security -- recommendations` (con el Supabase local levantado: `npx supabase start`)
Expected: FAIL (no existen `set_platforms` ni `dismissed_titles`).

- [ ] **Step 3: Write the migration** con el estilo de `supabase/migrations/20261017000000_feedback.sql` (comentario de cabecera en español, `security definer`, `set search_path = ''`, espacio por `couple_members where user_id = (select auth.uid())`).

- [ ] **Step 4: Apply and run**

Run: `npx supabase db reset && npm run test:security -- recommendations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261019000000_recommendations.sql tests/security/recommendations.test.ts
git commit -m "feat: plataformas del espacio y títulos descartados en la base"
```

---

### Task 2: Lógica pura de las recomendaciones

**Files:**
- Create: `supabase/functions/recommendations/lib.ts`, `supabase/functions/recommendations/lib.test.ts`
- Modify: `supabase/functions/tmdb-search/lib.ts` (extraer `toSearchResult`)

**Interfaces:**
- Consumes: `SearchResult` de `tmdb-search/lib.ts`.
- Produces (todo exportado desde `recommendations/lib.ts`):

```ts
export type TmdbItem = { id: number; media_type?: string; title?: string; name?: string; original_title?: string; original_name?: string;
  release_date?: string; first_air_date?: string; poster_path?: string | null; overview?: string; genre_ids?: number[];
  vote_count?: number; popularity?: number }
export type Recommendation = SearchResult & { genres: string[]; because?: string[]; platforms?: string[]; newSeason?: boolean; watchedTitleId?: string }
export type Discover = { forBoth: Recommendation[]; forEach: { userId: string; name: string; results: Recommendation[] }[];
  inTheaters: Recommendation[]; onPlatforms: Recommendation[] | null; platformNames: string[] }   // platformNames: las elegidas, para mostrar bajo el subtítulo
export type ProviderOption = { id: number; name: string; logoPath: string | null }
export type RecRequest = { kind: 'discover' } | { kind: 'similar'; titleId: string } | { kind: 'providers' }
export type Seed = { key: string; title: string; weight: number }       // key = `${mediaType}:${tmdbId}`

export function parseRequest(body: unknown): RecRequest | null
export function seedWeight(scores: number[]): number | null
export function pickSeeds<T extends { weight: number }>(seeds: T[], max?: number): T[]   // max = 50
export function genreNames(ids: number[] | undefined): string[]
export function toRecommendation(item: TmdbItem, mediaType: 'movie' | 'tv'): Recommendation
export function rankRecommendations(seeds: { seed: Seed; mediaType: 'movie' | 'tv'; results: TmdbItem[] }[],
  options: { exclude: Set<string>; minVotes: number; limit: number }): Recommendation[]
export function inOrder(items: { item: TmdbItem; mediaType: 'movie' | 'tv' }[], exclude: Set<string>, limit: number): Recommendation[]
export function byPopularity(items: { item: TmdbItem; mediaType: 'movie' | 'tv' }[], exclude: Set<string>, limit: number): Recommendation[]
export function mergePlatformResults(byProvider: { name: string; movies: TmdbItem[]; series: TmdbItem[] }[],
  options: { exclude: Set<string>; watched: Map<string, string>; since: string; limit: number }): Recommendation[]
export function hasNewSeason(details: { seasons?: { season_number: number; air_date: string | null }[] }, watchedAt: string, today: string): boolean
export function isNewSeasonSeries(item: TmdbItem, since: string): boolean
export const LONG_RUNNING_GENRES = [10767, 10763, 10764, 10766]
export function toProviderOptions(movie: unknown[], tv: unknown[]): ProviderOption[]
```

- `toSearchResult(item, mediaType)` en `tmdb-search/lib.ts`: el `.map` que hoy está dentro de `personTitles`, exportado; `personTitles` lo usa.

- [ ] **Step 1: Write the failing tests** en `lib.test.ts`:

```ts
test('parseRequest: the three modes and nothing else', () => {
  expect(parseRequest({ discover: true })).toEqual({ kind: 'discover' })
  expect(parseRequest({ similarTo: '6f1c2a4e-3b7d-4c1e-9a2b-1d2e3f4a5b6c' })).toEqual({ kind: 'similar', titleId: '6f1c2a4e-3b7d-4c1e-9a2b-1d2e3f4a5b6c' })
  expect(parseRequest({ providers: true })).toEqual({ kind: 'providers' })
  for (const body of [null, {}, { similarTo: 'x' }, { discover: 'yes' }]) expect(parseRequest(body)).toBeNull()
})
test('seedWeight: average minus 5, one score alone, none is null', () => {
  expect(seedWeight([9, 8])).toBe(3.5)
  expect(seedWeight([3])).toBe(-2)
  expect(seedWeight([])).toBeNull()
})
test('pickSeeds keeps the 50 with the largest weight, good or bad', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => ({ weight: i % 2 ? i / 10 : -i / 10 }))
  const picked = pickSeeds(seeds)
  expect(picked).toHaveLength(50)
  expect(picked.map((s) => Math.abs(s.weight))).not.toContain(0)
})
test('rankRecommendations: several favorites push a title up, a bad one pushes it down, with why', () => {
  const a = { id: 1, title: 'Uno', vote_count: 500 }, b = { id: 2, title: 'Dos', vote_count: 500 }, c = { id: 3, title: 'Tres', vote_count: 500 }
  const seeds = [
    { seed: { key: 'movie:10', title: 'El origen', weight: 4 }, mediaType: 'movie' as const, results: [a, b] },
    { seed: { key: 'movie:11', title: 'Interestelar', weight: 3 }, mediaType: 'movie' as const, results: [b, c] },
    { seed: { key: 'movie:12', title: 'Mala', weight: -3 }, mediaType: 'movie' as const, results: [c] },
  ]
  const ranked = rankRecommendations(seeds, { exclude: new Set(), minVotes: 50, limit: 30 })
  expect(ranked.map((r) => r.tmdbId)).toEqual([2, 1])
  expect(ranked[0].because).toEqual(['El origen', 'Interestelar'])
})
test('rankRecommendations drops the list, the dismissed, the few-voted and caps at the limit', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `T${i}`, vote_count: i === 5 ? 10 : 500 }))
  const ranked = rankRecommendations([{ seed: { key: 'movie:99', title: 'X', weight: 4 }, mediaType: 'movie', results: items }],
    { exclude: new Set(['movie:1', 'movie:2']), minVotes: 50, limit: 30 })
  expect(ranked).toHaveLength(30)
  expect(ranked.map((r) => r.tmdbId)).not.toContain(1)
  expect(ranked.map((r) => r.tmdbId)).not.toContain(6)
})
test('genreNames maps TMDB ids to Spanish names and skips unknown ones', () => {
  expect(genreNames([18, 36, 12, 999999])).toEqual(['Drama', 'Historia', 'Aventura'])
  expect(genreNames(undefined)).toEqual([])
})
test('mergePlatformResults names every platform, marks new seasons, keeps watched series for checking and sorts by popularity', () => {
  const nueva = { id: 5, name: 'Nueva', first_air_date: '2026-09-01', popularity: 10 }
  const vieja = { id: 6, name: 'Vieja', first_air_date: '2019-01-01', popularity: 30 }
  const vista = { id: 7, name: 'Vista', first_air_date: '2018-01-01', popularity: 20 }
  const peli = { id: 8, title: 'Peli', release_date: '2026-09-10', popularity: 25 }
  const merged = mergePlatformResults(
    [{ name: 'Netflix', movies: [peli], series: [nueva, vieja, vista] }, { name: 'Max', movies: [], series: [vieja] }],
    { exclude: new Set(['tv:7']), watched: new Map([['tv:7', 'title-7']]), since: '2026-07-21', limit: 30 },
  )
  expect(merged.map((r) => [r.tmdbId, r.platforms, r.newSeason ?? false, r.watchedTitleId])).toEqual([
    [6, ['Netflix', 'Max'], true, undefined],
    [8, ['Netflix'], false, undefined],
    [7, ['Netflix'], true, 'title-7'],
    [5, ['Netflix'], false, undefined],
  ])
})
test('hasNewSeason: the latest season already aired started after it was marked watched', () => {
  const seasons = [{ season_number: 0, air_date: '2026-10-01' }, { season_number: 1, air_date: '2020-01-01' }, { season_number: 2, air_date: '2026-09-01' }, { season_number: 3, air_date: '2027-03-01' }]
  expect(hasNewSeason({ seasons }, '2026-01-10T00:00:00Z', '2026-10-19')).toBe(true)
  expect(hasNewSeason({ seasons }, '2026-09-15T00:00:00Z', '2026-10-19')).toBe(false)
  expect(hasNewSeason({}, '2026-01-10T00:00:00Z', '2026-10-19')).toBe(false)
})
test('toProviderOptions joins movie and tv providers by display priority, up to 30', () => {
  const movie = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', display_priority: 2 }]
  const tv = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', display_priority: 2 }, { provider_id: 337, provider_name: 'Disney Plus', logo_path: null, display_priority: 1 }]
  expect(toProviderOptions(movie, tv)).toEqual([{ id: 337, name: 'Disney Plus', logoPath: null }, { id: 8, name: 'Netflix', logoPath: '/n.png' }])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run supabase/functions/recommendations supabase/functions/tmdb-search`
Expected: FAIL (`lib.ts` no existe). Los tests de `tmdb-search` siguen pasando.

- [ ] **Step 3: Implement `lib.ts`** con estas reglas del spec:
  - `parseRequest`: `similarTo` tiene que ser un UUID (mismo patrón que `parseTitleId` en `title-detail/lib.ts`).
  - `seedWeight`: promedio − 5.
  - `rankRecommendations`: cada aparición suma `weight × (1 − posición / 40)` (posición desde 0); `because` = hasta dos títulos de semilla con aporte positivo, del mayor al menor; afuera las claves de `exclude`, `vote_count < minVotes` y puntaje ≤ 0; empate por `popularity`.
  - `genreNames`: mapa fijo de géneros de TMDB en `es-MX` (películas y series), por ejemplo `18: 'Drama'`, `36: 'Historia'`, `12: 'Aventura'`, `10765: 'Ciencia ficción y fantasía'`.
  - `isNewSeasonSeries`: serie con `first_air_date` anterior a `since`.
  - `mergePlatformResults`: une por clave; `platforms` en orden de aparición; las claves de `watched` no se sacan aunque estén en `exclude` y llevan `newSeason: true` y `watchedTitleId`; orden por `popularity` descendente; hasta `limit`.
  - `hasNewSeason`: temporadas con `season_number > 0` y `air_date ≤ today`; la más reciente tiene que empezar después de `watchedAt`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run supabase/functions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/recommendations/lib.ts supabase/functions/recommendations/lib.test.ts supabase/functions/tmdb-search/lib.ts
git commit -m "feat: lógica de las recomendaciones (pesos, orden, novedades, temporadas nuevas)"
```

---

### Task 3: Función `recommendations`

**Files:**
- Create: `supabase/functions/recommendations/index.ts`
- Modify: `supabase/config.toml` (sumar `[functions.recommendations]` con `verify_jwt = false`, junto a las otras)
- Test: `tests/security/recommendations.test.ts` (sumar)

**Interfaces:**
- Consumes: todo lo de la tarea 2; `pickImdbId` no hace falta.
- Produces: `POST /functions/v1/recommendations`
  - `{ discover: true }` → `Discover`
  - `{ similarTo: uuid }` → `{ results: Recommendation[] }`
  - `{ providers: true }` → `{ providers: ProviderOption[] }`
  - 400 `invalid_request`, 401 `unauthorized`, 403 `no_couple`, 404 `not_found` (título de otro espacio o inexistente), 502 `upstream` (fallaron todas las consultas a TMDB).

- [ ] **Step 1: Write the failing tests** (suman al archivo de la tarea 1; llaman a la función como `tests/security/search.test.ts`):

```ts
test('anonymous callers get 401', async () => {
  expect((await recs(anonClient(), { discover: true })).status).toBe(401)
})
test('a bad body gets 400', async () => {
  expect((await recs(A.client, { nothing: true })).status).toBe(400)
})
test('similarTo a title of another couple is 404', async () => {
  const { data } = await adminClient().from('titles').insert({ couple_id: otherCouple, tmdb_id: 27205, media_type: 'movie', title: 'El origen', added_by: C.id }).select('id').single()
  expect((await recs(A.client, { similarTo: data!.id })).status).toBe(404)
})
test('similarTo a watched title returns TMDB recommendations without what is already in the list', async () => {
  // El origen (27205) visto; Interestelar (157336) en la lista
  const { data } = await recs(A.client, { similarTo: originId })
  expect(data.results.length).toBeGreaterThan(0)
  expect(data.results.find((r) => r.tmdbId === 157336)).toBeUndefined()
})
test('discover returns the four sections; no platforms means onPlatforms null', async () => {
  const { data } = await recs(A.client, { discover: true })
  expect(Object.keys(data).sort()).toEqual(['forBoth', 'forEach', 'inTheaters', 'onPlatforms', 'platformNames'])
  expect(data.onPlatforms).toBeNull()
  expect(data.platformNames).toEqual([])
  expect(data.forBoth.find((r) => r.tmdbId === 157336)).toBeUndefined()
})
test('providers lists Argentine platforms with Netflix among them', async () => {
  const { data } = await recs(A.client, { providers: true })
  expect(data.providers.find((p) => p.id === 8)?.name).toBe('Netflix')
})
```

En `beforeAll`: un segundo espacio `otherCouple` para C (`createCouple(C)`); cargar con `adminClient()` "El origen" (27205, vista, puntaje 9 de A; su id en `originId`) e "Interestelar" (157336, por ver) en el espacio de A y B. Helper `recs(client, body)` que devuelve `{ data, status }` como `search()` en `tests/security/search.test.ts`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx supabase functions serve --no-verify-jwt` en otra terminal, y `npm run test:security -- recommendations`
Expected: FAIL (la función no existe).

- [ ] **Step 3: Implement `index.ts`** con el esquema de `tmdb-search/index.ts` (cors, `json()`, `getClaims`, cliente con la sesión del usuario):
  - Lee con la sesión: `couple_members` (espacio, `user_id`, `display_name`), `couples.platforms`, `titles` (`id, tmdb_id, media_type, title, status, watched_at`), `title_scores` (`title_id, user_id, score`), `dismissed_titles`.
  - `exclude` = claves de toda la lista + descartadas.
  - Discover: semillas = vistas con puntaje → `pickSeeds` → una consulta `/{tipo}/{id}/recommendations?language=es-MX&page=1` por semilla, en paralelo, con `.catch(() => null)`; `forBoth` con los pesos del promedio; `forEach` por miembro con sus puntajes y `exclude` + claves de `forBoth`, solo si tiene alguna semilla; `inTheaters` = `byPopularity` de `/movie/now_playing?region=AR` páginas 1 y 2 (sin `minVotes`); `onPlatforms` = `null` sin plataformas, si no por cada plataforma `/discover/movie` (`primary_release_date.gte=since`) y `/discover/tv` (`air_date.gte=since`, `without_genres=` `LONG_RUNNING_GENRES` unidos con `|`), los dos con `watch_region=AR`, `with_watch_providers=<id>`, `with_watch_monetization_types=flatrate`, `sort_by=popularity.desc`; nombres de plataforma de `/watch/providers/movie?watch_region=AR`; `watched` = series vistas (clave → id); después de `mergePlatformResults`, una consulta `/tv/{id}` por cada una con `watchedTitleId` y `hasNewSeason(details, watched_at, today)`; las que no, afuera. `since` = hoy − 90 días (`YYYY-MM-DD`).
  - Similar: `.eq('id', titleId).maybeSingle()` con la sesión (si no viene, 404); `/recommendations`, y si viene vacío `/similar`; `inOrder` con hasta 20.
  - Providers: `/watch/providers/movie` y `/tv` con `watch_region=AR`, `toProviderOptions`.
  - Si todas las consultas a TMDB de un modo fallan: 502.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:security -- recommendations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/recommendations/index.ts supabase/config.toml tests/security/recommendations.test.ts
git commit -m "feat: función recommendations (Descubrir, Parecidas a esta y plataformas)"
```

---

### Task 4: API de Descubrir en la app

**Files:**
- Create: `src/features/discover/discoverApi.ts`, `src/features/discover/discoverApi.test.ts`

**Interfaces:**
- Consumes: tipos de `supabase/functions/recommendations/lib.ts`; `callRpc`, `CodedError` de `src/lib/rpc.ts`; `Title` de `titlesApi`.
- Produces:

```ts
export type { Discover, ProviderOption, Recommendation }
export class DiscoverError extends CodedError<'network'> {}
export function discoverKey(titles: Title[]): string
export function fetchDiscover(key: string): Promise<Discover>       // en memoria por key
export function fetchSimilar(titleId: string): Promise<Recommendation[]>
export function fetchProviders(): Promise<ProviderOption[]>
export function fetchPlatforms(coupleId: string): Promise<number[]>
export const setPlatforms: (ids: number[]) => Promise<void>
export const dismissTitle: (mediaType: 'movie' | 'tv', tmdbId: number) => Promise<void>
export const undismissTitle: (mediaType: 'movie' | 'tv', tmdbId: number) => Promise<void>
export function forgetDiscover(): void                               // para tests y al cambiar plataformas
```

- [ ] **Step 1: Write the failing tests** (mockeando `supabase` como `src/features/titles/searchApi.test.ts`):

```ts
test('discoverKey changes with what was watched and the scores, not with the order or the to-watch ones', () => {
  const vista = makeTitle({ id: 'a', status: 'watched', watchedAt: '2026-10-01T00:00:00Z', scores: [{ userId: 'u1', score: 8, note: null, updatedAt: '' }] })
  const otra = makeTitle({ id: 'b', status: 'watched', watchedAt: '2026-10-02T00:00:00Z', scores: [] })
  const porVer = makeTitle({ id: 'c' })
  expect(discoverKey([vista, otra, porVer])).toBe(discoverKey([otra, vista]))
  expect(discoverKey([{ ...vista, scores: [{ ...vista.scores[0], score: 9 }] }, otra])).not.toBe(discoverKey([vista, otra]))
})
test('fetchDiscover calls once per key and again when the key changes', async () => {
  invoke.mockResolvedValue({ data: empty, error: null })
  await fetchDiscover('k1'); await fetchDiscover('k1'); await fetchDiscover('k2')
  expect(invoke).toHaveBeenCalledTimes(2)
  expect(invoke).toHaveBeenCalledWith('recommendations', { body: { discover: true } })
})
test('a failed discover is not remembered', async () => {
  invoke.mockResolvedValueOnce({ data: null, error: new Error('502') })
  await expect(fetchDiscover('k3')).rejects.toThrow()
  invoke.mockResolvedValueOnce({ data: empty, error: null })
  await expect(fetchDiscover('k3')).resolves.toEqual(empty)
})
test('fetchSimilar and fetchProviders unwrap their lists', async () => {
  invoke.mockResolvedValueOnce({ data: { results: [rec] }, error: null })
  expect(await fetchSimilar('t1')).toEqual([rec])
  expect(invoke).toHaveBeenLastCalledWith('recommendations', { body: { similarTo: 't1' } })
  invoke.mockResolvedValueOnce({ data: { providers: [{ id: 8, name: 'Netflix', logoPath: null }] }, error: null })
  expect(await fetchProviders()).toEqual([{ id: 8, name: 'Netflix', logoPath: null }])
})
test('dismiss, undismiss and setPlatforms call their SQL functions', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  await dismissTitle('movie', 27205); await undismissTitle('movie', 27205); await setPlatforms([8, 337])
  expect(rpc.mock.calls).toEqual([
    ['dismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 }],
    ['undismiss_title', { p_media_type: 'movie', p_tmdb_id: 27205 }],
    ['set_platforms', { p_ids: [8, 337] }],
  ])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/discover/discoverApi.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implement `discoverApi.ts`**: `discoverKey` = ids de vistas ordenados, cada uno con sus puntajes `userId=score` ordenados, unido en un string. La memoria guarda un solo resultado (la última key); se borra al fallar. `fetchPlatforms` lee `couples.platforms` por `id`. Las tres RPC con `callRpc` y `DiscoverError`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/discover`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/discover/discoverApi.ts src/features/discover/discoverApi.test.ts
git commit -m "feat: API de Descubrir en la app"
```

---

### Task 5: Lista de tarjetas de recomendación

**Files:**
- Create: `src/features/discover/RecommendationList.tsx`, `src/features/discover/RecommendationList.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `Recommendation`, `dismissTitle`, `undismissTitle` (tarea 4); `addTitle`, `removeTitle`, `TitleError`, `Title` (`titlesApi`); `searchDetails`, `Extra` (`searchApi`); `TitleCard`; `imdbScore`.
- Produces:

```tsx
export function RecommendationList(props: {
  items: Recommendation[]
  titles: Title[]                                  // la lista: lo que ya está no se ofrece para agregar
  originNote: (r: Recommendation) => string        // "De Descubrir" o "Parecida a <título>"
  hidden: Set<string>                              // claves descartadas o agregadas en otra sección
  onHide: (key: string, hide: boolean) => void     // avisa al padre para sacarla de las otras secciones
  onOpenWatched?: (titleId: string) => void
}): JSX.Element
```

Textos exactos: "Ver detalle" / "Ocultar detalle", "No me interesa", "Descartada · Deshacer" (el botón es "Deshacer"), "✓ Agregada · tocala de nuevo para sacarla", "Ya la vieron · salió una temporada nueva", "Temporada nueva", "Porque vieron A y B" (o "Porque vieron A"), "Ver más". Errores: "Ya está en la lista", "No se pudo agregar. Probá de nuevo.", "No se pudo descartar. Probá de nuevo."

- [ ] **Step 1: Write the failing tests** (mockeando `titlesApi`, `searchApi` y `discoverApi` como `src/features/titles/AddTitle.test.tsx`):

```tsx
test('shows 10, Ver más adds 10, and asks details only for the visible ones', async () => { /* 25 items: 10 → 20 → 25, sin "Ver más" al final */ })
test('a card shows runtime, IMDb, why and genres only when its detail is open', async () => {
  // extras { runtime: 144, imdb: '7.8/10' }; because ['Relatos salvajes', 'Argentina, 1985']; genres ['Drama', 'Historia']
  // ve "2023 · Película · 2 h 24", "IMDb 7.8", "Porque vieron Relatos salvajes y Argentina, 1985"
  // "Ver detalle" muestra el overview completo y "Drama · Historia"; pasa a "Ocultar detalle"
})
test('tapping adds it with the origin note and tapping again takes it out', async () => {
  // addTitle('c1', rec, 'De Descubrir'); "✓ Agregada · tocala de nuevo para sacarla"; removeTitle(id); onHide(key, true) y luego (key, false)
})
test('if the other one added it a moment ago it says Ya está en la lista', async () => {
  // addTitle rechaza con new TitleError('duplicate') → alert "Ya está en la lista"; la tarjeta no queda como agregada
})
test('No me interesa replaces the card with Deshacer, and Deshacer brings it back', async () => {
  // dismissTitle('movie', id); "Descartada · Deshacer"; onHide(key, true); click Deshacer → undismissTitle, tarjeta de vuelta, onHide(key, false)
})
test('if dismissing fails the card stays and an alert says so', async () => { /* "No se pudo descartar. Probá de nuevo." */ })
test('a watched series with a new season opens its detail instead of adding, without No me interesa', async () => {
  // { watchedTitleId: 't9', newSeason: true } → "Ya la vieron · salió una temporada nueva"; click → onOpenWatched('t9'); sin "No me interesa"
})
test('items in hidden do not show', async () => { /* hidden con una clave → esa tarjeta no está */ })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/discover/RecommendationList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `RecommendationList.tsx`**: cada `li` lleva el `button.result` con `TitleCard` (como `resultList` en `AddTitle.tsx`) y, debajo, una fila `.rec-actions` con "Ver detalle" y "No me interesa" (`button.small`). El detalle abierto es un `div.rec-detail` con el overview completo y los géneros unidos con " · ". Estilos nuevos en `styles.css`: `.rec-actions`, `.rec-detail`, `button.small` (fuente 13 px, borde `var(--border)`, fondo transparente), siguiendo la maqueta aprobada.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/discover`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/discover/RecommendationList.tsx src/features/discover/RecommendationList.test.tsx src/app/styles.css
git commit -m "feat: tarjetas de recomendación (agregar, ver detalle, no me interesa)"
```

---

### Task 6: Pestaña Descubrir

**Files:**
- Create: `src/features/discover/Discover.tsx`, `src/features/discover/Discover.test.tsx`
- Modify: `src/app/Home.tsx`, `src/app/App.test.tsx` o `src/app/Home.test.tsx` (la barra tiene 4 pestañas), `src/app/styles.css`

**Interfaces:**
- Consumes: `fetchDiscover`, `discoverKey` (tarea 4); `RecommendationList` (tarea 5); `useTitles`, `TitleDetail`; `useCouple`.
- Produces: `export function Discover(): JSX.Element`. En `Home`, el tipo de pestaña pasa a `'lista' | 'descubrir' | 'elegir' | 'ajustes'`; orden de botones: Lista, Descubrir, Elegir, Ajustes.

Textos exactos: título "Descubrir"; selector "Para los dos", nombre de cada miembro, "Novedades"; subtítulos "En cines" y "En sus plataformas"; "Buscando recomendaciones…"; "Cuando marquen títulos como vistos y les pongan puntaje, acá van a aparecer recomendaciones"; "No se pudieron cargar las recomendaciones" + botón "Reintentar"; sin conexión: "Sin conexión: no se pueden buscar recomendaciones ahora."; sin plataformas: "Elijan sus plataformas en Ajustes para ver lo nuevo que tienen". Nota de origen: "De Descubrir".

- [ ] **Step 1: Write the failing tests:**

```tsx
test('the tab bar has Lista, Descubrir, Elegir and Ajustes', () => { /* en Home */ })
test('shows Para los dos first, then each member by name and Novedades', async () => { /* selector con aria-pressed */ })
test('a member without scores has no option', async () => { /* forEach sin Juli → no hay botón "Juli" */ })
test('Novedades shows En cines and En sus plataformas, with the chosen platforms under the subtitle', async () => { /* platformNames ['Netflix', 'Max'] → "Netflix · Max" */ })
test('without platforms Novedades invites to choose them in Ajustes', async () => { /* onPlatforms null */ })
test('nothing watched with scores shows the empty text', async () => {})
test('loading, offline and error with Reintentar', async () => { /* Reintentar vuelve a llamar */ })
test('the same key comes from memory: switching tabs does not call again', async () => {})
test('dismissing in one section hides the same title in the others', async () => {
  // el mismo título en forBoth y onPlatforms; descartarlo en "Para los dos" → en "Novedades" no aparece
})
test('a watched series with a new season opens its detail inside Descubrir', async () => { /* TitleDetail del título t9 */ })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/discover/Discover.test.tsx src/app`
Expected: FAIL.

- [ ] **Step 3: Implement `Discover.tsx` y la pestaña en `Home.tsx`**: `useTitles(coupleId)` da la lista; `discoverKey(titles)` decide si se pide de nuevo; un `Set` de claves ocultas compartido por todas las secciones; el título visto abierto se muestra con `TitleDetail` (al cerrarlo vuelve a Descubrir). Sin conexión (`navigator.onLine` y eventos `online`/`offline`, como en `AddTitle`) no pide.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/discover/Discover.tsx src/features/discover/Discover.test.tsx src/app
git commit -m "feat: pestaña Descubrir"
```

---

### Task 7: Parecidas a esta, en la ficha de las vistas

**Files:**
- Create: `src/features/discover/SimilarTitles.tsx`, `src/features/discover/SimilarTitles.test.tsx`
- Modify: `src/features/titles/TitleDetail.tsx`, `src/features/titles/TitleDetail.test.tsx`

**Interfaces:**
- Consumes: `fetchSimilar` (tarea 4), `RecommendationList` (tarea 5).
- Produces: `export function SimilarTitles({ title, titles }: { title: Title; titles: Title[] }): JSX.Element`. Nota de origen: `Parecida a ${title.title}`.

`TitleDetail` necesita la lista para `titles`: sumar la prop `titles: Title[]` y pasarla desde `TitleList` y `Discover`.

- [ ] **Step 1: Write the failing tests:**

```tsx
test('a watched title shows Parecidas a esta with its recommendations', async () => { /* h3 "Parecidas a esta"; fetchSimilar(title.id) */ })
test('a to-watch title does not ask for or show similar ones', () => { /* fetchSimilar no se llama */ })
test('adding from Parecidas a esta uses the origin note Parecida a <título>', async () => { /* addTitle('c1', rec, 'Parecida a El origen') */ })
test('if it fails it says so with Reintentar', async () => { /* "No se pudieron cargar las parecidas" + "Reintentar" */ })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/discover/SimilarTitles.test.tsx src/features/titles/TitleDetail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `SimilarTitles.tsx`** y sumarlo al final de `TitleDetail`, antes de "Quitar", solo si `title.status === 'watched'`. Si no hay ninguna: "TMDB no tiene parecidas para este título".

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/discover/SimilarTitles.tsx src/features/discover/SimilarTitles.test.tsx src/features/titles
git commit -m "feat: Parecidas a esta en la ficha de las vistas"
```

---

### Task 8: Nuestras plataformas en Ajustes

**Files:**
- Create: `src/features/settings/Platforms.tsx`, `src/features/settings/Platforms.test.tsx`
- Modify: `src/features/settings/Settings.tsx`, `src/app/styles.css`

**Interfaces:**
- Consumes: `fetchProviders`, `fetchPlatforms`, `setPlatforms`, `forgetDiscover` (tarea 4); `useCouple`.
- Produces: `export function Platforms(): JSX.Element`, en `Settings` entre `ThemePicker` y `ShareShortcut`.

Textos exactos: h2 "Nuestras plataformas"; "Las que pagan. Se usan en Novedades."; error al guardar: "No se pudo guardar. Probá de nuevo."; si no cargan: "No se pudieron cargar las plataformas".

- [ ] **Step 1: Write the failing tests:**

```tsx
test('lists the Argentine platforms with logo and marks the chosen ones', async () => { /* botones con aria-pressed; logo w92 */ })
test('tapping one saves the new list right away and forgets the cached Descubrir', async () => {
  // elegidas [8]; tocar Disney Plus (337) → setPlatforms([8, 337]); forgetDiscover llamado
})
test('if saving fails it goes back to how it was and says so', async () => {})
test('if the platforms do not load it says so', async () => {})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/settings/Platforms.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `Platforms.tsx`**: grilla de dos columnas (`.platforms-grid`), cada plataforma un `button` con `aria-pressed`, logo (`https://image.tmdb.org/t/p/w92${logoPath}`) y nombre; guardado optimista; un toque a la vez (botones deshabilitados mientras guarda).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings src/app/styles.css
git commit -m "feat: Nuestras plataformas en Ajustes"
```

---

### Task 9: Revisión en pantalla y publicación

**Files:**
- Modify: `docs/superpowers/notes/2026-10-decisiones.md` (decisiones tomadas al construir, si las hubo)

- [ ] **Step 1: Checks completos**

Run: `npm test && npm run typecheck && npm run lint && npm run test:security`
Expected: todo en verde.

- [ ] **Step 2: Revisión visual** con el Supabase local (`npx supabase start`, `npx supabase functions serve`) y el servidor `dev-local`: Descubrir (las cuatro opciones, una tarjeta con detalle abierto, una descartada), Novedades sin plataformas y con plataformas, la ficha de una vista con "Parecidas a esta" y Ajustes, a 390×844 y 393×852. Capturas para Tomás.

- [ ] **Step 3: Publicar, con el OK de Tomás**, en este orden:

```bash
npx supabase db push
npx supabase functions deploy recommendations --use-api --no-verify-jwt
npm run test:security:remote
npm run deploy
git push origin main
```

Expected: la migración aplicada, la función respondiendo 401 sin sesión, los tests remotos en verde, la app nueva en vivo y la CI en verde.

- [ ] **Step 4: Commit de notas** (si hubo decisiones nuevas)

```bash
git add docs/superpowers/notes/2026-10-decisiones.md
git commit -m "docs: decisiones de las recomendaciones"
```
