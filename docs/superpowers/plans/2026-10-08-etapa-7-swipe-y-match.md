# Pelis By Pili — Etapa 7 (Swipe y match) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Nacho y Pili deslicen, cada uno en su celular, un mazo de títulos de "Por ver"; cuando a los dos les gusta el mismo hay match y aparece al instante en los dos celulares; si hay varios matches, se definen en una final de a pares.

**Architecture:**
- **Base:** una sesión compartida por pareja (`swipe_sessions`) con el mazo fijo, los votos de cada uno (`swipe_votes`) y las elecciones de la final (`swipe_picks`). Toda escritura pasa por funciones `security definer`, como en las etapas anteriores. Las tres tablas van a Realtime.
- **Lógica pura** en `swipeLogic.ts`: armar el mazo, calcular la próxima carta, el avance de cada uno, los matches y el estado de la final. Los dos celulares calculan lo mismo con los mismos datos, así que no hace falta que el servidor "decida" nada: el match se ve en los dos apenas llega el voto que lo completa.
- **Pantalla** "Swipe y match" como tercer modo del menú de "Elegir".

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas (el deslizamiento es con eventos de puntero y CSS).

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 5, 8 y Etapa 7). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; los textos exactos están en cada tarea.
- El mazo sale de "Por ver" (spec, sección 8), nunca de un catálogo general.
- Nadie ajeno a la pareja lee ni escribe sesiones, votos o elecciones (mismo modelo de `is_member` y `revoke all` de la etapa 1). Las claves primarias son ids al azar (lección de la etapa 4: Realtime manda la clave de las filas borradas a cualquiera).
- Alcance estricto. **No entra:** Atajo de iOS, revelación simultánea ni torneo; tampoco avisos push ("Pili empezó un swipe").
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md`. Los puntos menores de la revisión final van a la Etapa 12 de la spec.
- **Decisiones a confirmar por Nacho** (propuestas):
  1. **Mazo:** los títulos de "Por ver" que cumplen los filtros (los mismos de la lista y la ruleta), mezclados al azar, **hasta 20** (la spec dice de 20 a 30; con menos títulos van todos, mínimo 2). Los dos ven el mismo mazo en el mismo orden.
  2. **Se desliza el mazo entero.** Cada match aparece al instante en los dos celulares ("¡Match! Dark"). Cuando los dos terminan: sin matches, "No hubo match esta vez"; con uno, esa es la ganadora; con varios, final de a pares.
  3. **Final de a pares:** los dos ven el mismo par y cada uno toca la que prefiere. Si coinciden, pasa esa. Si no, pasa la de mejor puntaje (IMDb, o TMDB si no hay; a igualdad, la que estaba antes en el mazo). Si quedan impares, la última pasa sola de ronda.
  4. **Una sola sesión abierta por pareja.** El que entra primero la empieza; el otro, al abrir "Swipe y match", se suma solo. "Terminar" la cierra para los dos.
  5. **Los votos no se deshacen** (ni en el mazo ni en la final).
  6. Hace falta que **los dos estén en el espacio**: con uno solo, el modo avisa "Para el swipe hace falta que tu pareja se una".

## Review Focus

1. **Los dos votan casi a la vez el último título que faltaba para un match:** los dos celulares ven el match (cada uno recarga ante el voto del otro). Probado en la Task 1 (Realtime de votos) y en la Task 2 (los matches salen solo de los votos).
2. **Los dos tocan "Empezar" a la vez:** queda una sola sesión y los dos terminan en ella. Probado en la Task 1.
3. **Un título del mazo se borra a mitad de sesión:** se saltea en los dos celulares y no traba el "terminaron los dos". Probado en la Task 2.
4. **Doble toque o reintento después de un corte** al votar o elegir en la final: no duplica ni falla. Probado en la Task 1.
5. **Se corta la conexión o la app pasa a segundo plano** a mitad de sesión: al volver se recarga la sesión y sigue donde estaba. Probado en las Tasks 3 y 4.

---

### Task 1: Base de datos de las sesiones

**Files:**
- Create: `supabase/migrations/20261012000000_swipe.sql`
- Test: `tests/security/swipe.test.ts`

**Interfaces:**
- Produces (tablas, todas con `couple_id` y RLS `is_member(couple_id)` solo para leer, en `supabase_realtime`):
  - `swipe_sessions (id uuid pk, couple_id, created_by uuid null → auth.users on delete set null, deck uuid[] not null check cardinality 2..30, status text 'open'|'done'|'cancelled' default 'open', result_title_id uuid null → titles on delete set null, created_at, finished_at)`. Índice único parcial `(couple_id) where status = 'open'`.
  - `swipe_votes (id uuid pk, session_id → swipe_sessions cascade, couple_id, user_id → auth.users cascade, title_id → titles cascade, liked boolean, created_at)`, único `(session_id, user_id, title_id)`.
  - `swipe_picks (id uuid pk, session_id cascade, couple_id, user_id cascade, round smallint 1..5, slot smallint 0..15, title_id → titles cascade, created_at)`, único `(session_id, user_id, round, slot)`.
- Produces (funciones, `security definer`, `search_path = ''`, solo `authenticated`):
  - `start_swipe(p_title_ids uuid[]) returns uuid`. Si la pareja ya tiene una abierta, devuelve esa (sin mirar el mazo). Si no: saca repetidos manteniendo el orden; error `invalid_deck` si quedan menos de 2 o más de 30, o si alguno no es de la pareja o no está en "Por ver"; `no_partner` si el espacio tiene un solo miembro; `no_couple` si quien llama no tiene espacio. Dos llamadas simultáneas terminan en la misma sesión (atrapar `unique_violation` y devolver la abierta).
  - `swipe_vote(p_session_id uuid, p_title_id uuid, p_liked boolean) returns void`. `not_found` si la sesión no es de su pareja; `closed` si no está abierta; `not_in_deck`. Un segundo voto al mismo título no hace nada (`on conflict do nothing`).
  - `swipe_pick(p_session_id uuid, p_round int, p_slot int, p_title_id uuid) returns void`. Mismos errores; repetido no hace nada.
  - `finish_swipe(p_session_id uuid, p_result_title_id uuid) returns void`. Con resultado: `status = 'done'`; con `null`: `'cancelled'`; `finished_at = now()`. `not_in_deck` si el resultado no está en el mazo. Si ya estaba cerrada no hace nada (los dos pueden tocar "Listo").

- [ ] **Step 1: Write the failing tests** en `tests/security/swipe.test.ts`, con los helpers de `tests/security/helpers.ts` (pareja A = Nacho y Pili con títulos en "Por ver" y uno visto; pareja C ajena):
  - `start_swipe` devuelve un id; la segunda llamada (del otro miembro, con otro mazo) devuelve el mismo; dos llamadas en `Promise.all` devuelven el mismo id.
  - `start_swipe` rechaza con `invalid_deck`: 1 título, 31 títulos, un título visto, un título de C; con `no_partner` en un espacio de uno solo.
  - `swipe_vote` guarda el voto; repetirlo no falla ni duplica (una fila); C recibe `not_found`; un título fuera del mazo da `not_in_deck`; después de `finish_swipe` da `closed`.
  - `swipe_pick`: igual que el voto (guarda, repetido sin error, `not_found` para C).
  - `finish_swipe(id, título)` deja `done` con `result_title_id`; `finish_swipe(id, null)` deja `cancelled`; una segunda llamada no falla; después se puede empezar otra sesión.
  - Lectura: C no ve sesiones, votos ni elecciones de A; nadie puede `insert`/`update`/`delete` directo en las tres tablas (error de permisos).
  - Realtime: Pili recibe el `INSERT` del voto de Nacho en `swipe_votes` (filtro `couple_id=eq.A`) y C, suscripto con el mismo filtro, no recibe nada. Usar el patrón de espera de `scores.test.ts` (listo con el mensaje de sistema "Subscribed to PostgreSQL").
- [ ] **Step 2: Run** `npm run test:security -- swipe` → FAIL (las funciones no existen).
- [ ] **Step 3: Write the migration** con las tablas, índices (`couple_id` y `session_id`), RLS, `revoke all` + `grant select` a `authenticated` + `grant all` a `service_role`, las cuatro funciones y `alter publication supabase_realtime add table` de las tres.
- [ ] **Step 4: Run** `npx supabase db reset` (después `npx supabase stop && npx supabase start` si las plantillas de correo dejan de andar, y volver a levantar `npx supabase functions serve --env-file .env.local`) y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `feat: sesiones de swipe en la base`

### Task 2: Lógica del swipe

**Files:**
- Create: `src/features/choose/swipeLogic.ts`, `src/features/choose/swipeLogic.test.ts`
- Modify: `src/features/choose/quickPick.ts` (exportar `titleScore`, hoy `score`)

**Interfaces:**
- Consumes: `Title`, `Filters`, `matchesFilters` (etapa 5).
- Produces:
  - `export const DECK_SIZE = 20`
  - `export type Vote = { userId: string; titleId: string; liked: boolean }`
  - `export type Pick = { userId: string; round: number; slot: number; titleId: string }`
  - `export function buildDeck(titles: Title[], filters: Filters, random?: () => number): string[]`: ids de "Por ver" que cumplen los filtros, mezclados (Fisher–Yates con `random`), los primeros `DECK_SIZE`.
  - `export function deckState(deck: string[], votes: Vote[], me: string, partner: string): { next: string | null; mine: number; theirs: number; total: number; matches: string[]; bothDone: boolean }`. `deck` llega ya sin los títulos borrados (lo filtra la pantalla). `matches` en el orden del mazo.
  - `export type FinalState = { kind: 'pair'; round: number; slot: number; pair: [string, string]; myPick: string | null; partnerPicked: boolean } | { kind: 'winner'; titleId: string } | { kind: 'none' }`
  - `export function finalState(matches: string[], picks: Pick[], me: string, partner: string, rank: (titleId: string) => number): FinalState`. Ronda 1 = `matches`; pares `(0,1), (2,3)…`, `slot` = índice del par; si sobra uno, pasa solo. Un par se decide cuando hay elección de los dos: si coinciden, esa; si no, la de mayor `rank`, y a igualdad la primera del par. Devuelve el primer par sin decidir; cuando queda una, `winner`; sin matches, `none`.
  - `export function titleScore(t: Title): number | null` (en `quickPick.ts`, el mismo de hoy).

- [ ] **Step 1: Write the failing tests:**
  - `buildDeck`: solo "Por ver" y que cumplen los filtros; nunca más de 20 (con 25 títulos, 20); con `random = () => 0` el orden es estable y conocido; sin repetidos.
  - `deckState`: `next` es la primera del mazo sin voto mío; `mine`/`theirs` cuentan votos de cada uno; un título con "sí" de los dos es match y uno con "sí" y "no" no; `bothDone` solo cuando los dos votaron todo el mazo; votos de títulos que ya no están en el mazo no cuentan.
  - `finalState`: 0 matches → `none`; 1 → `winner` directo; 2 → un par en ronda 1 slot 0, con `myPick` y `partnerPicked`; si coinciden gana esa; si no, gana la de mejor `rank` y a igualdad la primera; 3 matches → par (a, b) y c pasa sola, la ronda 2 es (ganadora, c); 4 matches → dos pares en la ronda 1 y la final en la ronda 2.
- [ ] **Step 2: Run** `npx vitest run src/features/choose/swipeLogic.test.ts` → FAIL.
- [ ] **Step 3: Implement** las funciones de arriba y renombrar `score` → `titleScore` exportada en `quickPick.ts`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: lógica del swipe y la final de a pares`

### Task 3: API y sesión en vivo

**Files:**
- Create: `src/features/choose/swipeApi.ts`, `src/features/choose/swipeApi.test.ts`, `src/features/choose/useSwipe.ts`

**Interfaces:**
- Consumes: tablas y funciones de la Task 1; `Vote`, `Pick` de la Task 2.
- Produces:
  - `export type SwipeSession = { id: string; deck: string[]; votes: Vote[]; picks: Pick[] }`
  - `export type SwipeErrorKind = 'network' | 'closed' | 'invalid_deck' | 'no_partner' | 'not_found' | 'not_in_deck'` y `class SwipeError` como `TitleError`.
  - `loadOpenSwipe(coupleId: string): Promise<SwipeSession | null>`: la sesión `open` de la pareja con sus votos y elecciones (un `select` con las dos tablas embebidas).
  - `startSwipe(titleIds: string[]): Promise<string>`, `swipeVote(sessionId, titleId, liked): Promise<void>`, `swipePick(sessionId, round, slot, titleId): Promise<void>`, `finishSwipe(sessionId, resultTitleId: string | null): Promise<void>`, que llaman a las funciones de la Task 1 y traducen los errores.
  - `subscribeSwipe(coupleId: string, onChange: () => void): () => void`: `INSERT`/`UPDATE` de `swipe_sessions` e `INSERT` de `swipe_votes` y `swipe_picks`, todos con `couple_id=eq.<id>`, más la recarga con el mensaje de sistema, igual que `subscribeTitles`.
  - `useSwipe(coupleId: string): { session: SwipeSession | null | undefined; offline: boolean; load: () => void }` (`undefined` = cargando), igual que `useTitles`: carga al montar, ante cada cambio y al volver la app al frente.

- [ ] **Step 1: Write the failing tests** en `swipeApi.test.ts` con el mock de `supabase` de `titlesApi.test.ts`: `loadOpenSwipe` filtra por pareja y `status = 'open'` y mapea filas a `SwipeSession` (y `null` sin filas); cada función llama a su `rpc` con los parámetros `p_…` exactos; los códigos `closed`, `invalid_deck`, `no_partner`, `not_found`, `not_in_deck` y "Failed to fetch" se traducen a su `kind`; `subscribeSwipe` registra los cuatro filtros, llama a `onChange` en cada evento y en "Subscribed to PostgreSQL", y al cortar quita el canal.
- [ ] **Step 2: Run** `npx vitest run src/features/choose/swipeApi.test.ts` → FAIL.
- [ ] **Step 3: Implement** `swipeApi.ts` y `useSwipe.ts`.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: API de las sesiones de swipe`

### Task 4: Pantalla "Swipe y match"

**Files:**
- Create: `src/features/choose/Swipe.tsx`, `src/features/choose/Swipe.test.tsx`
- Modify: `src/features/choose/ChooseMenu.tsx` (+ test), `src/app/styles.css`

**Interfaces:**
- Consumes: Tasks 2 y 3; `useTitles`, `useCouple`, `useMemberName`, `FiltersPanel`, `filterOptions`, `matchesFilters`, `TitleCard`.
- Produces: `Swipe({ filters, onFiltersChange, onBack }: { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void })`.

Pantallas (todas con "Volver a los modos" arriba, dentro de la sección, como Ruleta):
- **Un solo miembro:** "Para el swipe hace falta que tu pareja se una".
- **Sin sesión abierta:** `<h2>Swipe y match</h2>`, "Cada uno desliza en su celular. Hay match cuando a los dos les gusta el mismo.", `FiltersPanel` con el contador, y "Empezar" (deshabilitado con menos de 2 que cumplen, con "Hacen falta al menos 2 títulos"). Empezar = `startSwipe(buildDeck(...))` y recargar.
- **Deslizando:** la carta `next` (póster grande, título, año · tipo · duración, `IMDb x`), botones "👎 No" y "👍 Sí", y avance "Vos: 3 de 20 · Pili: 5 de 20". Arrastrar la carta más de 100 px a la derecha vota sí, a la izquierda no; menos, vuelve a su lugar. El voto avanza al instante (se guarda en un estado local de pendientes mientras llega la recarga); si falla, la carta vuelve con "No se pudo guardar. Probá de nuevo.". Cada match nuevo muestra "¡Match! <título>" (`role="status"`). Debajo, "Matches: n" y el botón "Terminar" (`finishSwipe(id, null)`).
- **Terminé yo y falta la pareja:** "Esperando a Pili (12 de 20)".
- **Terminaron los dos:** `none` → "No hubo match esta vez" y "Otra ronda" (`finishSwipe(id, null)`); `pair` → "Final: elijan una", "Ronda r", las dos cartas como botones; después de elegir, "Esperando a Pili…"; `winner` → "¡Ganó <título>!" con su carta y "Listo" (`finishSwipe(id, winner)`).
- Los títulos del mazo que ya no están en la lista se sacan antes de calcular (`deck.filter(id => existe)`); `rank` = `titleScore` o `-1`.

- [ ] **Step 1: Write the failing tests** en `Swipe.test.tsx`, con `useTitles`/`swipeApi` mockeados como en `QuickQuestions.test.tsx`:
  - Un solo miembro muestra el aviso. Sin sesión, "Empezar" llama a `startSwipe` con los ids de "Por ver" que cumplen los filtros; con 1 título está deshabilitado.
  - Con sesión: muestra la primera carta sin voto mío y el avance; "👍 Sí" llama a `swipeVote(id, título, true)` y muestra la siguiente sin esperar la recarga; si `swipeVote` falla, vuelve la misma carta con el aviso.
  - Arrastre: `pointerDown` en x=0, `pointerMove` a x=150 y `pointerUp` vota sí; a x=-150, no; a x=50, no vota.
  - Cuando llega (por `notify`) un voto de Pili que completa un match, aparece "¡Match! <título>".
  - Terminé y Pili no: "Esperando a Pili (n de 20)". Los dos terminaron sin matches: "No hubo match esta vez". Con dos matches: "Final: elijan una"; tocar una llama a `swipePick(id, 1, 0, título)`. Con un match: "¡Ganó <título>!" y "Listo" llama a `finishSwipe(id, título)`.
  - Un título borrado del mazo no aparece ni traba el final.
  - `ChooseMenu`: tercer botón "Swipe y match" con "Cada uno desliza; gana lo que les guste a los dos", primero en el menú, que abre el modo y vuelve.
- [ ] **Step 2: Run** `npx vitest run src/features/choose` → FAIL.
- [ ] **Step 3: Implement** `Swipe.tsx`, el botón en `ChooseMenu.tsx` y los estilos (carta con `touch-action: pan-y`, `transform: translateX(dx) rotate(dx/20 deg)` mientras se arrastra).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local (390 px) con dos usuarios del Supabase local en dos pestañas: empezar, votar con botones y arrastrando, ver el match en las dos, la final y la ganadora.
- [ ] **Step 6: Commit** `feat: pantalla de swipe y match`

### Task 5: Publicación y aceptación

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` ("Cierre de la Etapa 7"), `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (sección 8 con el mazo y la final).

- [ ] **Step 1:** `npm test && npm run test:security && npm run typecheck`.
- [ ] **Step 2 (Nacho):** `npx supabase db push` para subir la migración al proyecto real. Después, una sola corrida de `npm run test:security:remote`.
- [ ] **Step 3:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar que el bundle publicado es el local.
- [ ] **Step 4: Prueba de aceptación** (Nacho y la cuenta de prueba en el celular de su hermana, a la vez): uno empieza y el otro se suma solo; deslizan con el dedo y con los botones; un match aparece en los dos celulares al mismo tiempo; con varios matches juegan la final; "Listo" y "Terminar" vuelven al inicio en los dos.
- [ ] **Step 5: Commit** `docs: cierre de la Etapa 7`

**Cierre de la Etapa 7:** dos celulares distintos detectan el match al mismo tiempo. **No entra** (no adelantar): Atajo de iOS, revelación simultánea ni torneo.
