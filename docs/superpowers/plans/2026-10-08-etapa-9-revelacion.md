# Pelis By Pili — Etapa 9 (Revelación simultánea) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada uno elige en secreto 3 títulos de "Por ver"; cuando los dos eligieron, se revelan a la vez y las coincidencias van primero. Con dos celulares o con uno solo pasándoselo.

**Architecture:**
- **El secreto lo cuida la base**, no la app: la elección de cada uno solo la puede leer su dueño hasta que la partida se revela (RLS). La revelación la hace la base sola cuando llega la segunda elección, y avisa por Realtime con un cambio en la partida, que sí ven los dos; recién ahí cada celular pide las elecciones. Las elecciones no van a Realtime.
- **Lógica pura** en `revealLogic.ts`: coincidencias, las de cada uno y si hay ganadora o ruleta. La ruleta de desempate es la de Bumble, que se saca a un componente propio.
- **Un celular:** como Bumble, todo en el celular (`localStorage`), con "Pasale el celu" sin mostrar lo elegido.
- **Pantalla** "Top 3 secreto" como modo del menú de "Elegir" (en el código, `Reveal`).

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 8, 12 y Etapa 9). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; textos exactos en cada tarea.
- **Ninguno ve la elección del otro antes de la revelación** (spec, Etapa 9): ni en la app, ni leyendo la base, ni por Realtime.
- Se elige de "Por ver" (spec, sección 8). Nadie ajeno a la pareja lee ni escribe partidas o elecciones; claves primarias al azar.
- Pantallas de juego que entran en iPhone 13 (390×844) y 15 (393×852) (spec, sección 12): la lista para elegir scrollea, pero el botón para confirmar queda siempre a la vista.
- Alcance estricto. **No entra:** torneo.
- Cada decisión fuera del plan va a `docs/superpowers/notes/2026-10-decisiones.md`; los menores de la revisión final, a la Etapa 12.
- **Decisiones confirmadas por Nacho el 2026-10-08:**
  1. **3 sin orden** por persona (o todos los de "Por ver" que cumplen los filtros, si son menos de 3).
  2. **Sin coincidencias:** se ven las elecciones de los dos y "Que decida la ruleta" gira entre todas (hasta 6). Con la misma ganadora en los dos celulares.
  3. **Con coincidencias:** una sola es la ganadora; si coinciden 2 o 3, la ruleta gira solo entre las coincidencias.
  4. **El modo se llama "Top 3 secreto"** (elegido por Nacho), con "Cada uno elige 3 en secreto y se muestran a la vez", segundo en el menú (después de Bumble).
  5. **Se elige de "Por ver" con los filtros** de la lista (como Bumble y la ruleta), tocando para marcar y desmarcar; "Listo" se habilita con 3.
  6. **Mientras el otro no eligió, se puede cambiar la elección** ("Cambiar mi elección"); el otro ve "Pili ya eligió", sin saber qué.
  7. **La revelación es automática** cuando eligen los dos, con una cuenta "3, 2, 1" en los dos celulares (con movimiento reducido, sin cuenta).
  8. **Uno o dos celulares** como en Bumble: "📱 Uno" (el primero elige, "Pasale el celu a Pili", elige ella, "Revelar") o "📱📱 Dos" (necesita a la pareja en el espacio; si la pareja ya empezó una, se entra directo).
  9. Una sola partida de dos celulares abierta por pareja; "Listo" (con la ganadora) o "Terminar" la cierran para los dos.

## Review Focus

1. **Alguien intenta ver la elección del otro antes de tiempo** (leyendo la tabla, escuchando Realtime, o mirando la respuesta de la partida): no hay forma. Probado en la Task 1.
2. **Los dos tocan "Listo" casi a la vez:** la partida se revela una sola vez y los dos ven las dos elecciones. Probado en la Task 1.
3. **Cambiar la elección después de la revelación** (un toque tardío o un reintento): se rechaza y la revelación no cambia. Probado en la Task 1.
4. **Un título elegido se borra o se marca como visto antes de revelar:** la revelación igual se muestra (con lo que quede) y la ruleta no se traba. Probado en las Tasks 2 y 4.
5. **La app se recarga a mitad de partida:** con dos celulares sigue (elegido, esperando o revelado); con uno, desde `localStorage`, sin mostrar la elección del primero. Probado en las Tasks 3 y 4.

---

### Task 1: Base de datos con el secreto

**Files:**
- Create: `supabase/migrations/20261014000000_reveal.sql`, `tests/security/reveal.test.ts`

**Interfaces:**
- Produces:
  - `reveal_sessions (id uuid pk, couple_id, created_by → auth.users on delete set null, ready uuid[] not null default '{}', revealed_at timestamptz, status 'open'|'done'|'cancelled', result_title_id → titles on delete set null, created_at, finished_at)`: índice único parcial `(couple_id) where status = 'open'`; RLS `is_member(couple_id)` solo lectura; en `supabase_realtime`.
  - `reveal_picks (id uuid pk, session_id → reveal_sessions cascade, couple_id, user_id → auth.users cascade, title_ids uuid[] not null check cardinality 1..3, created_at, updated_at)`, único `(session_id, user_id)`; RLS de lectura: `is_member(couple_id) and (user_id = auth.uid() or public.reveal_visible(session_id))`; **no** va a Realtime.
  - `reveal_visible(p_session_id uuid) returns boolean` (`security definer`, `stable`): la partida tiene `revealed_at`.
  - `start_reveal() returns uuid`: la abierta de la pareja o una nueva; `no_couple`, `no_partner`; dos a la vez terminan en la misma (como `start_bumble`).
  - `submit_reveal(p_session_id uuid, p_title_ids uuid[]) returns void`: bloquea la fila de la partida (`for update`); `not_found` si no es de su pareja; `closed` si no está abierta o ya se reveló; sin repetidos, `invalid_picks` si quedan 0 o más de 3 o alguno no es de la pareja o no está en "Por ver"; guarda o reemplaza su elección, suma su id a `ready` y, si ya están los dos miembros, pone `revealed_at = now()`.
  - `finish_reveal(p_session_id uuid, p_result_title_id uuid) returns void`: como `finish_bumble` (`done` con resultado, `cancelled` sin; si ya estaba cerrada no hace nada); `not_in_picks` si el resultado no está en ninguna elección.

- [ ] **Step 1: Write the failing tests** en `tests/security/reveal.test.ts` (pareja A = Nacho y Pili con títulos en "Por ver" y uno visto, pareja C ajena):
  - `start_reveal`: el otro miembro recibe la misma; dos en `Promise.all`, la misma; `no_partner` en un espacio de uno; `no_couple` sin espacio.
  - **Secreto:** Nacho elige; Pili lee `reveal_picks` de la partida y solo ve las suyas (ninguna); Nacho ve la suya; la partida muestra `ready` con Nacho y `revealed_at` nulo; Nacho cambia su elección (queda la nueva). Pili elige: `revealed_at` deja de ser nulo y los dos leen las dos elecciones. C nunca lee nada.
  - Después de revelar, `submit_reveal` da `closed` y las elecciones no cambian.
  - Los dos eligen en `Promise.all`: queda revelada una vez y las dos elecciones están.
  - `invalid_picks`: vacío, 4 títulos, uno visto, uno de C (los repetidos se juntan: `[a, a]` vale como `[a]`).
  - `finish_reveal`: `not_in_picks` con otro título; con uno elegido queda `done`; segunda llamada sin error; después se puede empezar otra.
  - Nadie escribe directo en las dos tablas.
  - Realtime: Pili, escuchando `reveal_sessions` con filtro `couple_id=eq.A`, recibe el `UPDATE` cuando Nacho elige (con `ready`), y escuchando `reveal_picks` no recibe nada; C no recibe nada.
- [ ] **Step 2: Run** `npm run test:security -- reveal` → FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx supabase migration up` y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `feat: revelación con secreto en la base`

### Task 2: Lógica y ruleta compartida

**Files:**
- Create: `src/features/choose/revealLogic.ts`, `src/features/choose/revealLogic.test.ts`, `src/features/choose/TieBreak.tsx`
- Modify: `src/features/choose/Bumble.tsx` (usa `TieBreak` del archivo nuevo)

**Interfaces:**
- Produces:
  - `export const PICKS = 3`
  - `export type RevealResult = { matches: string[]; only: [string[], string[]]; winner: string | null; roulette: string[] | null }`
  - `export function revealResult(picks: [string[], string[]], exists: (id: string) => boolean): RevealResult`: saca los que ya no existen; `matches` = los que están en las dos (en el orden de la primera); `only[i]` = los del jugador i que no coinciden; con 1 coincidencia, `winner`; con 2 o más, `roulette` = las coincidencias; con 0, `roulette` = todas las elegidas sin repetir (primero las del jugador 0); sin ninguna, las dos en `null`.
  - `TieBreak({ candidates, index, onEnd })` (la de `Bumble.tsx`, igual, en su archivo).
- [ ] **Step 1: Write the failing tests:** una coincidencia gana; dos coincidencias van a la ruleta solo con ellas; ninguna, ruleta con las 6 sin repetir; `only` sin las coincidencias; un título borrado no aparece y si era la única coincidencia ya no hay ganadora.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y mover `TieBreak`. **Step 4: Run** `npm test` → PASS (los de Bumble siguen en verde).
- [ ] **Step 5: Commit** `feat: lógica de la revelación y ruleta compartida`

### Task 3: API y partida en vivo

**Files:**
- Create: `src/features/choose/revealApi.ts`, `src/features/choose/revealApi.test.ts`, `src/features/choose/useReveal.ts`

**Interfaces:**
- Produces:
  - `export type RevealSession = { id: string; ready: string[]; revealed: boolean; picks: { userId: string; titleIds: string[] }[] }` (antes de revelar, `picks` trae solo la propia, por RLS).
  - `loadOpenReveal(coupleId): Promise<RevealSession | null>`, `startReveal(): Promise<string>`, `submitReveal(sessionId, titleIds): Promise<void>`, `finishReveal(sessionId, resultTitleId | null): Promise<void>`; `RevealError` con `'network' | 'closed' | 'invalid_picks' | 'no_partner' | 'not_found' | 'not_in_picks'`.
  - `subscribeReveal(coupleId, onChange)`: `INSERT`/`UPDATE` de `reveal_sessions` con filtro, más "Subscribed to PostgreSQL".
  - `useReveal(coupleId)`: como `useBumble` (con el contador de pedidos).
- [ ] **Step 1: Write the failing tests** (mock de `supabase` como `bumbleApi.test.ts`): mapeo con y sin elecciones, `null` sin partida, los `rpc` con sus parámetros, errores, las dos escuchas.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: API de la revelación`

### Task 4: Pantalla "Top 3 secreto"

**Files:**
- Create: `src/features/choose/Reveal.tsx`, `src/features/choose/Reveal.test.tsx`
- Modify: `src/features/choose/ChooseMenu.tsx` (+ test), `src/app/styles.css`, spec (sección 8)

**Interfaces:**
- Produces: `Reveal({ filters, onFiltersChange, onBack, random? })`.

Pantallas:
- **Inicio:** `<h2>Top 3 secreto</h2>`, "Cada uno elige 3 en secreto y se muestran a la vez.", filtros con contador, "¿Cuántos celulares van a usar?" con "📱 Uno" / "📱📱 Dos" (mismas reglas que Bumble: con menos de 1 título, deshabilitados; "Dos" pide a la pareja).
- **Elegir:** "Elegí tus 3" (o "Turno de Nacho: elegí tus 3"), la lista de "Por ver" que cumple los filtros como tarjetas chicas que se marcan y desmarcan (`aria-pressed`), y abajo, fija sobre las pestañas, "Listo (2 de 3)" habilitado al llegar a `min(3, cantidad)`. Si ya hay 3 marcadas, tocar otra no hace nada.
- **Dos celulares, ya elegí:** "Listo. Esperando a Pili…" (o "Pili ya eligió" si está en `ready`), y "Cambiar mi elección" (vuelve a Elegir con lo propio marcado).
- **Un celular:** después del primero, "Pasale el celu a Pili" y "Listo, soy Pili" (sin mostrar lo elegido); después del segundo, "Revelar".
- **Revelación:** "3", "2", "1" (un segundo cada uno; sin cuenta con movimiento reducido) y después: "Coinciden" con sus tarjetas, "Eligió Nacho" y "Eligió Pili" con el resto; `winner` → "¡Ganó <título>!" y "Listo"; `roulette` → "Que decida la ruleta" (TieBreak, semilla `${id}:reveal`) y después la ganadora y "Listo". "Terminar" arriba (como Bumble).
- [ ] **Step 1: Write the failing tests:** inicio y reglas de los botones; elegir marca hasta 3 y "Listo (3 de 3)" llama a `submitReveal` con esos ids; con dos celulares, esperando con "Cambiar mi elección" y "Pili ya eligió"; al llegar la revelación por `notify`, después de la cuenta (con temporizadores falsos) se ven "Coinciden" y las de cada uno, y con una coincidencia "¡Ganó…!" y "Listo" llama a `finishReveal`; sin coincidencias, "Que decida la ruleta" gira a la ganadora de `seededIndex`; con un celular, el pase sin mostrar lo elegido, "Revelar" y que sobrevive a un `unmount` (localStorage); `ChooseMenu` con "Top 3 secreto" segundo.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (y la sección 8 de la spec).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local a 390×844 y 393×852 (el botón "Listo" siempre a la vista): con un celular entero, y con dos usando la Pili local por script.
- [ ] **Step 6: Commit** `feat: pantalla de la revelación`

### Task 5: Publicación y aceptación

- [ ] **Step 1:** `npm test && npm run test:security && npm run typecheck`.
- [ ] **Step 2 (Nacho):** `npx supabase db push`; después una corrida de `npm run test:security:remote` (si el límite de pedidos de Auth corta, repetir los archivos afectados a los pocos minutos).
- [ ] **Step 3:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar el bundle publicado.
- [ ] **Step 4: Prueba de aceptación** (Nacho y Pili de prueba): con dos celulares, uno elige y el otro solo ve "ya eligió"; al elegir el segundo, la cuenta y la revelación en los dos a la vez; con y sin coincidencias. Con un celular, el pase sin espiar.
- [ ] **Step 5: Commit** `docs: cierre de la Etapa 9` (notas, "Cierre de la Etapa 9").

**Cierre de la Etapa 9:** ninguno ve la elección del otro antes de la revelación. **No entra** (no adelantar): torneo.
