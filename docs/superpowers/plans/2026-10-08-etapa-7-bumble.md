# Pelis By Pili — Etapa 7 (Bumble: swipe y match) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Bumble": Nacho y Pili deslizan un mazo de títulos de "Por ver" con cartas tipo Tinder/Bumble; cuando a los dos les gusta el mismo hay match. Se juega con dos celulares (en vivo, el match aparece en los dos al mismo tiempo) o con uno solo pasándoselo. Con varios matches hay segunda vuelta.

**Architecture:**
- **Lógica pura** en `bumbleLogic.ts`: armar el mazo y, a partir de los votos, calcular en qué vuelta están, la próxima carta de cada uno, los matches y el resultado. Es la misma para uno y dos celulares: cambia solo de dónde salen los votos.
- **Dos celulares:** una sesión compartida por pareja en la base (`bumble_sessions`, `bumble_votes`), escrita solo por funciones `security definer` y escuchada por Realtime. Los dos celulares calculan lo mismo con los mismos votos, así que el match aparece en los dos apenas llega el voto que lo completa.
- **Un celular:** todo en el celular, sin base (los votos se guardan en `localStorage` para no perderlos si iOS recarga la app).
- **Pantalla** "Bumble" como primer modo del menú de "Elegir", con la carta (`BumbleCard`) aparte.

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas (deslizar con eventos de puntero y CSS; la rueda es la de la etapa 5).

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 5, 8 y Etapa 7). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; los textos exactos están en cada tarea. El modo se llama **"Bumble"** (pedido de Nacho; antes "Swipe y match").
- El mazo sale de "Por ver" (spec, sección 8), nunca de un catálogo general.
- Nadie ajeno a la pareja lee ni escribe sesiones o votos (mismo modelo de `is_member` y `revoke all` de la etapa 1). Claves primarias al azar (lección de la etapa 4: Realtime manda la clave de las filas borradas a cualquiera).
- Alcance estricto. **No entra:** Atajo de iOS, revelación simultánea ni torneo; tampoco avisos push ("Pili empezó un Bumble") ni guardar en la base las partidas de un celular.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md`. Los puntos menores de la revisión final van a la Etapa 12 de la spec.
- Decisiones confirmadas por Nacho el 2026-10-08:
  - **Mazo:** los de "Por ver" que cumplen los filtros (los mismos de la lista y la ruleta), mezclados al azar, **hasta 20** (con menos, todos; mínimo 2). Los dos ven las mismas cartas en el mismo orden.
  - **¿Uno o dos celulares?** Al empezar se pregunta "¿Cuántos celulares van a usar?": "📱 Uno" o "📱📱 Dos". Con un solo miembro en el espacio, "Dos" está deshabilitado con "Para usar dos celulares, tu pareja tiene que unirse". Si la pareja ya empezó un Bumble con dos celulares, se entra directo a esa partida, sin preguntar.
  - **Con un celular cada uno desliza el mazo entero:** primero quien tiene la sesión abierta, después aparece "Pasale el celu a <nombre>" (sin mostrar lo que votó el primero) y desliza el otro. Si el espacio tiene un solo miembro, el otro se llama "tu pareja".
  - **Se desliza el mazo entero** aunque haya matches. Con dos celulares cada match aparece al instante en los dos ("¡Match! <título>"); con uno, los matches se ven al terminar la vuelta.
  - **Varios matches → segunda vuelta:** se vuelven a deslizar solo los matches, en el mismo orden. Hasta **3 vueltas**. Al terminar una vuelta: 1 match → ganadora; varios → otra vuelta (o la ruleta si ya fue la tercera); ninguno → en la primera, "No hubo match esta vez"; en las siguientes, la ruleta entre las cartas de esa vuelta (todas habían sido match antes).
  - **Ruleta de desempate:** la rueda de la etapa 5 con esas cartas. El resultado sale del id de la sesión (o de la partida local) y la vuelta, así que los dos celulares ven la misma ganadora.
  - **Carta:** póster grande con título, año · tipo · duración, hasta 3 géneros, `IMDb x · RT y` y plataformas. Al tocarla se da vuelta y muestra la sinopsis (se pide con `fetchTitleDetail` recién ahí).
  - **Una sola partida de dos celulares abierta por pareja;** "Terminar" la cierra para los dos. Los votos no se deshacen.

## Review Focus

1. **Los dos votan casi a la vez la carta que completa un match:** los dos celulares lo ven (cada uno recarga ante el voto del otro). Probado en la Task 1 (Realtime de votos) y en la Task 2 (los matches salen solo de los votos).
2. **Los dos tocan "Dos" a la vez:** queda una sola partida y los dos terminan en ella. Probado en la Task 1.
3. **Un título del mazo se borra a mitad de partida:** se saltea en los dos celulares y no traba el fin de la vuelta. Probado en la Task 2.
4. **Tocar la carta para ver la sinopsis no vota, y un arrastre corto no da vuelta la carta.** Probado en la Task 4.
5. **La app se recarga a mitad de partida** (iOS la saca de memoria, se corta internet): con dos celulares se recarga la sesión y sigue; con uno, sigue desde `localStorage`. Probado en las Tasks 3 y 5.

---

### Task 1: Base de datos de las partidas de dos celulares

**Files:**
- Create: `supabase/migrations/20261012000000_bumble.sql`
- Test: `tests/security/bumble.test.ts`

**Interfaces:**
- Produces (tablas con `couple_id`, RLS `is_member(couple_id)` solo lectura, en `supabase_realtime`):
  - `bumble_sessions (id uuid pk, couple_id, created_by uuid null → auth.users on delete set null, deck uuid[] not null check cardinality 2..20, status text 'open'|'done'|'cancelled' default 'open', result_title_id uuid null → titles on delete set null, created_at, finished_at)`, índice único parcial `(couple_id) where status = 'open'`.
  - `bumble_votes (id uuid pk, session_id → bumble_sessions cascade, couple_id, user_id → auth.users cascade, round smallint check 1..3, title_id → titles cascade, liked boolean, created_at)`, único `(session_id, user_id, round, title_id)`.
- Produces (funciones `security definer`, `search_path = ''`, solo `authenticated`):
  - `start_bumble(p_title_ids uuid[]) returns uuid`: si la pareja ya tiene una abierta, devuelve esa. Si no: saca repetidos manteniendo el orden; `invalid_deck` con menos de 2 o más de 20, o si alguno no es de la pareja o no está en "Por ver"; `no_partner` con un solo miembro; `no_couple` sin espacio. Dos llamadas simultáneas terminan en la misma (atrapar `unique_violation` y devolver la abierta).
  - `bumble_vote(p_session_id uuid, p_round int, p_title_id uuid, p_liked boolean) returns void`: `not_found` si la sesión no es de su pareja; `closed` si no está abierta; `not_in_deck` si el título no está en el mazo o la vuelta no es 1..3. Repetido no hace nada (`on conflict do nothing`).
  - `finish_bumble(p_session_id uuid, p_result_title_id uuid) returns void`: con resultado `done`, con `null` `cancelled`, y `finished_at = now()`; `not_in_deck` si el resultado no está en el mazo; si ya estaba cerrada no hace nada.

- [ ] **Step 1: Write the failing tests** en `tests/security/bumble.test.ts` con los helpers de `tests/security/helpers.ts` (pareja A con títulos en "Por ver" y uno visto; pareja C ajena):
  - `start_bumble` devuelve un id; el otro miembro, con otro mazo, recibe el mismo; dos llamadas en `Promise.all` devuelven el mismo.
  - `invalid_deck` con 1 título, 21 títulos, uno visto y uno de C; `no_partner` en un espacio de uno solo.
  - `bumble_vote` guarda; repetido no falla y deja una fila; vuelta 4 da `not_in_deck`; C recibe `not_found`; un título fuera del mazo da `not_in_deck`; después de `finish_bumble`, `closed`.
  - `finish_bumble(id, título)` deja `done` con `result_title_id`; con `null`, `cancelled`; una segunda llamada no falla; después se puede empezar otra.
  - C no ve sesiones ni votos de A; nadie puede `insert`/`update`/`delete` directo (error de permisos).
  - Realtime: Pili recibe el `INSERT` del voto de Nacho en `bumble_votes` (filtro `couple_id=eq.A`) y C, con el mismo filtro, no recibe nada (patrón de espera de `scores.test.ts`).
- [ ] **Step 2: Run** `npm run test:security -- bumble` → FAIL (no existen las funciones).
- [ ] **Step 3: Write the migration** (tablas, índices por `couple_id` y `session_id`, RLS, `revoke all` + `grant select` a `authenticated` + `grant all` a `service_role`, las tres funciones, `alter publication supabase_realtime add table` de las dos).
- [ ] **Step 4: Run** `npx supabase db reset` (si después las plantillas de correo no andan: `npx supabase stop && npx supabase start`, y volver a levantar `npx supabase functions serve --env-file .env.local`) y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `feat: partidas de Bumble en la base`

### Task 2: Lógica de Bumble

**Files:**
- Create: `src/features/choose/bumbleLogic.ts`, `src/features/choose/bumbleLogic.test.ts`

**Interfaces:**
- Consumes: `Title`, `Filters`, `matchesFilters`.
- Produces:
  - `export const DECK_SIZE = 20`, `export const MAX_ROUNDS = 3`
  - `export type Vote = { userId: string; round: number; titleId: string; liked: boolean }`
  - `export function buildDeck(titles: Title[], filters: Filters, random?: () => number): string[]`: ids de "Por ver" que cumplen los filtros, mezclados (Fisher–Yates con `random`), los primeros `DECK_SIZE`.
  - `export type BumbleState = { kind: 'round'; round: number; cards: string[]; matches: string[]; next: [string | null, string | null]; done: [number, number] } | { kind: 'winner'; titleId: string } | { kind: 'roulette'; round: number; candidates: string[] } | { kind: 'none' }`
  - `export function bumbleState(deck: string[], votes: Vote[], players: [string, string]): BumbleState`. `deck` llega sin los títulos borrados. Vuelta 1 = `deck`; cada vuelta siguiente = los matches de la anterior, en el mismo orden. `next[i]` es la primera carta de la vuelta sin voto del jugador `i`; `done[i]` cuántas votó; `matches` los "sí" de los dos en esa vuelta. Cuando los dos votaron todas las cartas de la vuelta: 1 match → `winner`; varios → la vuelta siguiente, o `roulette` con ellos si era la `MAX_ROUNDS`; ninguno → `none` en la vuelta 1, `roulette` con las cartas de la vuelta en las demás.
  - `export function seededIndex(seed: string, count: number): number`: el mismo índice en `0..count-1` para la misma semilla (por ejemplo un hash FNV-1a del texto, módulo `count`). La semilla es `` `${sessionId}:${round}` ``.

- [ ] **Step 1: Write the failing tests:**
  - `buildDeck`: solo "Por ver" que cumplen los filtros; con 25, 20; con `random = () => 0` el orden es conocido; sin repetidos.
  - `bumbleState`: sin votos, vuelta 1 con `next` = primera carta para los dos y `done` [0, 0]; "sí" de los dos es match y "sí"/"no" no; con un jugador terminado y el otro no, sigue en la vuelta 1; los dos terminan con 1 match → `winner`; con 0 → `none`; con 3 matches → vuelta 2 con esas 3 cartas en el orden del mazo; vuelta 2 con 1 → `winner`; vuelta 2 con 0 → `roulette` con las 3; tercera vuelta con 2 → `roulette` con esas 2; votos de títulos que ya no están en el mazo no cuentan.
  - `seededIndex`: misma semilla, mismo resultado; siempre dentro de `0..count-1`; semillas distintas no dan todas el mismo índice (probar 20 semillas con `count = 5` y ver más de un valor).
- [ ] **Step 2: Run** `npx vitest run src/features/choose/bumbleLogic.test.ts` → FAIL.
- [ ] **Step 3: Implement** `bumbleLogic.ts`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: lógica de Bumble con segunda vuelta`

### Task 3: API y partida en vivo (dos celulares)

**Files:**
- Create: `src/features/choose/bumbleApi.ts`, `src/features/choose/bumbleApi.test.ts`, `src/features/choose/useBumble.ts`

**Interfaces:**
- Consumes: Task 1; `Vote` de la Task 2.
- Produces:
  - `export type BumbleSession = { id: string; deck: string[]; votes: Vote[] }`
  - `export type BumbleErrorKind = 'network' | 'closed' | 'invalid_deck' | 'no_partner' | 'not_found' | 'not_in_deck'` y `class BumbleError` como `TitleError`.
  - `loadOpenBumble(coupleId: string): Promise<BumbleSession | null>` (un `select` de la sesión `open` con `bumble_votes` embebidos).
  - `startBumble(titleIds: string[]): Promise<string>`, `bumbleVote(sessionId, round, titleId, liked): Promise<void>`, `finishBumble(sessionId, resultTitleId: string | null): Promise<void>`.
  - `subscribeBumble(coupleId, onChange): () => void`: `INSERT`/`UPDATE` de `bumble_sessions` e `INSERT` de `bumble_votes` con `couple_id=eq.<id>`, más la recarga con "Subscribed to PostgreSQL", como `subscribeTitles`.
  - `useBumble(coupleId): { session: BumbleSession | null | undefined; offline: boolean; load: () => void }` (`undefined` = cargando), como `useTitles`: carga al montar, ante cada cambio y al volver la app al frente.

- [ ] **Step 1: Write the failing tests** en `bumbleApi.test.ts` con el mock de `supabase` de `titlesApi.test.ts`: `loadOpenBumble` filtra por pareja y `status = 'open'` y mapea a `BumbleSession` (`null` sin filas); cada función llama a su `rpc` con los `p_…` exactos; `closed`, `invalid_deck`, `no_partner`, `not_found`, `not_in_deck` y "Failed to fetch" se traducen a su `kind`; `subscribeBumble` registra los tres filtros, llama a `onChange` en cada evento y en "Subscribed to PostgreSQL", y al cortar quita el canal.
- [ ] **Step 2: Run** `npx vitest run src/features/choose/bumbleApi.test.ts` → FAIL.
- [ ] **Step 3: Implement** `bumbleApi.ts` y `useBumble.ts`.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: API de las partidas de Bumble`

### Task 4: La carta

**Files:**
- Create: `src/features/choose/BumbleCard.tsx`, `src/features/choose/BumbleCard.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `Title`, `fetchTitleDetail` (etapa 3), `imdbScore`/`rtScore`, `formatMinutes`.
- Produces: `BumbleCard({ title, onVote }: { title: Title; onVote: (liked: boolean) => void })`.

Frente: póster grande (TMDB `w500`; sin póster, fondo liso con el título), encima con degradado: título, `año · Película|Serie · 1 h 45`, hasta 3 géneros, `IMDb 8.5 · RT 99%`, plataformas (o "Sin información de dónde verla"). Debajo, botones "👎 No" y "👍 Sí". Tocar la carta la da vuelta: "Sinopsis", el texto o "Cargando…", y si falla "No se pudo cargar la sinopsis"; tocar de nuevo vuelve al frente. Arrastrar más de 100 px a la derecha vota sí, a la izquierda no; menos vuelve a su lugar. Un toque es un `pointerUp` con menos de 10 px de recorrido. Mientras se arrastra: `transform: translateX(dx) rotate(dx/20 deg)` y la carta con `touch-action: pan-y`.

- [ ] **Step 1: Write the failing tests:** muestra título, año · tipo · duración, géneros (como mucho 3), puntajes y plataformas; "👍 Sí" llama `onVote(true)` y "👎 No" `onVote(false)`; arrastre de 0 a 150 vota sí, de 0 a -150 vota no, de 0 a 50 no vota ni da vuelta; un toque da vuelta la carta, pide `fetchTitleDetail` una sola vez y muestra la sinopsis; si falla, el aviso; otro toque vuelve al frente; una carta nueva (otro `title`) arranca de frente.
- [ ] **Step 2: Run** `npx vitest run src/features/choose/BumbleCard.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `BumbleCard.tsx` y los estilos.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat: carta de Bumble con datos y sinopsis`

### Task 5: Pantalla "Bumble"

**Files:**
- Create: `src/features/choose/Bumble.tsx`, `src/features/choose/Bumble.test.tsx`
- Modify: `src/features/choose/ChooseMenu.tsx` (+ test), `src/app/styles.css`, `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (sección 8)

**Interfaces:**
- Consumes: Tasks 2–4; `useTitles`, `useCouple`, `useMemberName`, `FiltersPanel`, `filterOptions`, `Wheel`, `targetRotation`.
- Produces: `Bumble({ filters, onFiltersChange, onBack }: { filters: Filters; onFiltersChange: (f: Filters) => void; onBack: () => void })`.

Pantallas (todas con "Volver a los modos" arriba, dentro de la sección):
- **Inicio** (sin partida abierta de dos celulares ni partida local guardada): `<h2>Bumble</h2>`, "Deslicen las cartas. Hay match cuando a los dos les gusta la misma.", `FiltersPanel` con el contador, "¿Cuántos celulares van a usar?" con "📱 Uno" y "📱📱 Dos" (deshabilitados con menos de 2 títulos que cumplen: "Hacen falta al menos 2 títulos"; "Dos" también con un solo miembro, con su aviso). "Dos" = `startBumble(buildDeck(...))` y recargar. "Uno" = partida local con `buildDeck` y un id al azar (`crypto.randomUUID()`), guardada en `localStorage` (`pelis-bumble-local`, lecturas y escrituras en `try/catch`).
- **Vuelta en curso:** "Vuelta r" (solo si r > 1, con "Vuelven a deslizar los matches"), la carta `next` del jugador que está en turno, y el avance: con dos celulares "Vos: 3 de 20 · Pili: 5 de 20"; con uno "Turno de Nacho · 3 de 20". El voto avanza al instante (estado local de pendientes mientras llega la recarga); si falla, la carta vuelve con "No se pudo guardar. Probá de nuevo.". Con dos celulares, cada match nuevo muestra "¡Match! <título>" (`role="status"`) y debajo "Matches: n". Botón "Terminar" (dos celulares: `finishBumble(id, null)`; uno: borra la partida local).
- **Un celular, terminó el primero:** "Pasale el celu a <nombre>" y el botón "Listo, soy <nombre>".
- **Dos celulares, terminé yo:** "Esperando a Pili (12 de 20)".
- **Fin de vuelta con varios matches (un celular):** "¡n matches! Vuelven a deslizar solo esos" y "Seguir", que empieza la vuelta siguiente con el primer jugador.
- **`none`:** "No hubo match esta vez" y "Otra partida" (cierra la actual).
- **`roulette`:** "Siguen empatados: decide la ruleta", la `Wheel` con los candidatos y "Girar", que gira hasta `seededIndex(`${id}:${round}`, n)`; al terminar, la ganadora.
- **`winner`:** "¡Ganó <título>!" con su carta (sin votar) y "Listo" (dos celulares: `finishBumble(id, ganadora)`; uno: borra la partida local).
- Los títulos del mazo que ya no están en la lista se sacan antes de calcular.

- [ ] **Step 1: Write the failing tests** en `Bumble.test.tsx`, con `useTitles`/`bumbleApi`/`detailApi` mockeados como en `QuickQuestions.test.tsx`:
  - Inicio: pregunta los celulares; "Dos" deshabilitado con un solo miembro y su aviso; con 1 título los dos deshabilitados; "Dos" llama a `startBumble` con los ids de "Por ver" que cumplen los filtros; si ya hay partida abierta, entra directo sin preguntar.
  - Dos celulares: muestra la primera carta sin voto mío y el avance; "👍 Sí" llama a `bumbleVote(id, 1, título, true)` y muestra la siguiente sin esperar la recarga; si falla, vuelve la misma carta con el aviso; un voto de Pili que llega por `notify` y completa un match muestra "¡Match! <título>"; terminé yo y Pili no: "Esperando a Pili (n de 20)"; con 1 match, "¡Ganó <título>!" y "Listo" llama a `finishBumble(id, título)`; con 2 matches, "Vuelta 2"; "Terminar" llama a `finishBumble(id, null)`.
  - Un celular: "Uno" arranca con "Turno de Nacho"; al votar todas aparece "Pasale el celu a Pili"; "Listo, soy Pili" muestra la primera carta otra vez con "Turno de Pili"; con un solo miembro dice "tu pareja"; después de un `unmount` y un render nuevo sigue en la misma carta (desde `localStorage`); con varios matches, "Seguir" arranca la vuelta 2.
  - `roulette`: "Girar" termina mostrando la ganadora de `seededIndex` (con movimiento reducido, como en `Roulette.test.tsx`).
  - Un título borrado del mazo no aparece ni traba el fin de la vuelta.
  - `ChooseMenu`: primer botón "Bumble" con "Deslicen y gana la que les guste a los dos", que abre el modo y vuelve.
- [ ] **Step 2: Run** `npx vitest run src/features/choose` → FAIL.
- [ ] **Step 3: Implement** `Bumble.tsx`, el botón en `ChooseMenu.tsx`, los estilos y la sección 8 de la spec (mazo, uno o dos celulares, segunda vuelta, ruleta de desempate).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local (390 px): con un celular, la partida entera; con dos, dos usuarios del Supabase local en dos pestañas: el match en las dos, la segunda vuelta y la ganadora.
- [ ] **Step 6: Commit** `feat: pantalla de Bumble`

### Task 6: Publicación y aceptación

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` ("Cierre de la Etapa 7").

- [ ] **Step 1:** `npm test && npm run test:security && npm run typecheck`.
- [ ] **Step 2 (Nacho):** `npx supabase db push`. Después, una sola corrida de `npm run test:security:remote`.
- [ ] **Step 3:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar que el bundle publicado es el local.
- [ ] **Step 4: Prueba de aceptación** (Nacho y la cuenta de prueba en el celular de su hermana): con dos celulares, uno empieza y el otro entra solo; un match aparece en los dos al mismo tiempo; varios matches llevan a la vuelta 2; "Listo" y "Terminar" vuelven al inicio en los dos. Con un celular, la partida entera pasándoselo. En la carta, los datos y la sinopsis al tocarla.
- [ ] **Step 5: Commit** `docs: cierre de la Etapa 7`

**Cierre de la Etapa 7:** dos celulares distintos detectan el match al mismo tiempo, y también se puede jugar con uno solo. **No entra** (no adelantar): Atajo de iOS, revelación simultánea ni torneo.
