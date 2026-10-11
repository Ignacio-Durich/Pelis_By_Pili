# Pelis By Pili — Etapa 10 (Torneo de a pares) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada uno elige 4 títulos de "Por ver", y las 8 candidatas se enfrentan de a dos (cuartos, semis y final) hasta que queda una; cada duelo lo deciden juntos con un toque.

**Architecture:**
- **Todo en un celular:** como los duelos se deciden juntos, el torneo no necesita sesión compartida ni cambios en la base. La partida se guarda en el celular (`localStorage`) por si iOS recarga la app, como Bumble y Top 3 secreto con un celular.
- **Lógica pura** en `tournament.ts`: armar el cuadro (8 lugares, con huecos si hay menos) y, con los ganadores elegidos, decir qué duelo sigue o quién ganó.
- **Pantalla** "Torneo" en el menú de "Elegir". El selector de títulos de Top 3 secreto se saca a un componente propio y se reutiliza.

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas ni cambios en la base.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 8, 12 y Etapa 10). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; textos exactos en cada tarea.
- Las candidatas salen de "Por ver" (spec, sección 8).
- Cada duelo entra en una pantalla de iPhone 13 (390×844) y 15 (393×852) sin scroll (spec, sección 12).
- Alcance estricto. **No entra:** modo sin internet; tampoco torneo con dos celulares ni guardar el torneo en la base.
- Cada decisión fuera del plan va a `docs/superpowers/notes/2026-10-decisiones.md`; los menores de la revisión final, a la Etapa 12.
- **Decisiones confirmadas por Tomás el 2026-10-08:**
  1. **4 cada uno** de "Por ver" (con los filtros de la lista).
  2. **Cada duelo se decide juntos** con un toque, en un solo celular; sin desempates.
  3. **Dos cartas grandes por duelo** con póster, año, tipo, duración, géneros, `IMDb · RT` y plataformas.
  4. **El torneo es de un celular** (no pregunta "uno o dos"): elige el que lo abre, "Pasale el celu a Juli", elige ella. Las del primero se ven marcadas como "La eligió Tomás" y no se pueden volver a elegir (no son secretas).
  5. **En cuartos, cada duelo es una de Tomás contra una de Juli** (en orden al azar). Si entre los dos no llegan a 8 (lista corta o filtros), se completa al azar con otras de "Por ver" que cumplen los filtros; si ni así, hay huecos y esa candidata pasa sola de ronda.
  6. **"↩️ Deshacer"** vuelve al duelo anterior (como en Bumble).
  7. **El modo se llama "Torneo"**, con "Elijan 4 cada uno y que se enfrenten de a dos", tercero en el menú.

## Review Focus

1. **Menos de 8 candidatas** (lista corta, filtros, títulos borrados a mitad): el torneo termina igual, con huecos que pasan solos y sin duelos de uno contra nadie. Probado en las Tasks 1 y 3.
2. **Deshacer en el primer duelo de una ronda** (vuelve a la ronda anterior) y después de la final: se puede volver atrás siempre que haya algo decidido. Probado en las Tasks 1 y 3.
3. **La app se recarga en cualquier momento** (eligiendo, en el pase, en un duelo, en el resultado): sigue donde estaba. Probado en la Task 3.
4. **Un toque doble en una carta** decide un solo duelo, no dos. Probado en la Task 3.
5. **Un título del cuadro se marca como visto o se borra** a mitad del torneo: queda como hueco y su rival pasa solo. Probado en las Tasks 1 y 3.

---

### Task 1: Lógica del torneo

**Files:**
- Create: `src/features/choose/tournament.ts`, `src/features/choose/tournament.test.ts`

**Interfaces:**
- Produces:
  - `export const TOURNAMENT_PICKS = 4`, `export const BRACKET = 8`
  - `export function buildBracket(first: string[], second: string[], fill: string[], random?: () => number): (string | null)[]`: 8 lugares. Mezcla cada lista por separado (Fisher–Yates con `random`) y arma los pares `(first[i], second[i])`; los lugares que faltan se completan con `fill` mezclado (sin repetir nada de lo ya puesto) y después con `null`. El lugar 2i y 2i+1 forman el duelo i de cuartos.
  - `export type Round = 1 | 2 | 3`
  - `export type TournamentState = { kind: 'duel'; round: Round; index: number; total: number; pair: [string, string] } | { kind: 'winner'; titleId: string } | { kind: 'none' }`
  - `export function tournamentState(slots: (string | null)[], winners: string[], exists: (id: string) => boolean): TournamentState`: `winners` son los elegidos en orden de duelo jugado. Recorre las rondas: en cada par, un lado vacío (`null` o que ya no existe) hace pasar al otro sin duelo; dos vacíos dan vacío; si no, el duelo usa el próximo de `winners` (que tiene que ser uno de los dos; si no lo es, se ignora y el duelo queda pendiente). Devuelve el primer duelo pendiente con su ronda, su número dentro de la ronda (contando solo los duelos de verdad) y cuántos tiene la ronda; al final, la ganadora, o `none` si no quedó ninguna.
  - `export const ROUND_NAMES: Record<Round, string> = { 1: 'Cuartos de final', 2: 'Semifinal', 3: 'Final' }`
- [ ] **Step 1: Write the failing tests:** `buildBracket` con 4 y 4 da 8 lugares con un elemento de cada lista en cada par; con 3 y 2 completa con `fill` sin repetir y llega a 8; con 1 y 1 y sin `fill` deja `null`; con `random = () => 0.999` el orden es conocido. `tournamentState` sin ganadores da el duelo 1 de 4 de cuartos; 4 ganadores pasan a la semifinal 1 de 2; 7 dan la ganadora; un ganador que no está en el par se ignora; con 3 candidatas hay un hueco y la ronda tiene menos duelos; un título que dejó de existir hace pasar a su rival; con una sola candidata gana sin duelos; sin ninguna, `none`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: lógica del torneo de a pares`

### Task 2: Selector compartido

**Files:**
- Create: `src/features/choose/TitlePicker.tsx`
- Modify: `src/features/choose/Reveal.tsx` (usa `TitlePicker`), `src/features/choose/Reveal.test.tsx` (sigue en verde)

**Interfaces:**
- Produces: `TitlePicker({ heading, titles, matching, initial, need, locked, onDone })`: el `Picker` de `Reveal.tsx` con `need` como parámetro (en Top 3 secreto, `Math.min(3, opciones)`) y `locked?: { ids: string[]; label: string }`: esos títulos se ven con el texto `label` (por ejemplo "La eligió Tomás"), deshabilitados, y no cuentan en las opciones para `need`.
- [ ] **Step 1: Write the failing tests** en `src/features/choose/TitlePicker.test.tsx`: marca hasta `need`; "Listo (n de need)"; los `locked` se ven con su texto y no se pueden tocar; dos toques seguidos no se pisan.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y usar `TitlePicker` en `Reveal.tsx`. **Step 4: Run** `npm test` → PASS (Top 3 secreto sigue igual).
- [ ] **Step 5: Commit** `refactor: selector de títulos compartido`

### Task 3: Pantalla "Torneo"

**Files:**
- Create: `src/features/choose/Tournament.tsx`, `src/features/choose/Tournament.test.tsx`
- Modify: `src/features/choose/ChooseMenu.tsx` (+ test), `src/app/styles.css`, spec (sección 8)

**Interfaces:**
- Consumes: Tasks 1 y 2; `useTitles`, `useCouple`, `useMemberName`, `FiltersPanel`, `GameTop`, `formatMinutes`, `imdbScore`, `rtScore`.
- Produces: `Tournament({ filters, onFiltersChange, onBack, random? })`.

Pantallas (partida en `localStorage` con `pelis-tournament-local`: `{ id, players, picks: [string[] | null, string[] | null], active, slots: (string | null)[] | null, winners: string[] }`):
- **Inicio:** `<h2>Torneo</h2>`, "Elijan 4 cada uno y que se enfrenten de a dos.", filtros con contador, "Empezar" (deshabilitado con menos de 2 títulos: "Hacen falta al menos 2 títulos").
- **Elegir:** `TitlePicker` con "Turno de Tomás: elegí 4" y `need = min(4, opciones)`; después "Pasale el celu a Juli" / "Listo, soy Juli"; después `TitlePicker` "Turno de Juli: elegí 4" con las de Tomás en `locked` ("La eligió Tomás"). Al terminar se arma el cuadro (`fill` = el resto de "Por ver" que cumple los filtros) y empiezan los duelos. Si el espacio tiene un solo miembro, el otro es "tu pareja".
- **Duelo:** `GameTop` con "Terminar"; arriba "Cuartos de final · duelo 2 de 4"; dos cartas (`DuelCard`, botón entero con póster, título, `año · tipo · duración`, hasta 3 géneros, `IMDb x · RT y`, plataformas) una arriba de la otra, con "vs" en el medio; tocar una la hace pasar. "↩️ Deshacer" cuando hay algún ganador elegido. Las dos cartas y el resto entran sin scroll en 390×844 y 393×852 (cada carta con el alto que sobra, el póster a la izquierda).
- **Ganadora:** "¡Ganó <título>!" con su carta, "↩️ Deshacer" y "Listo" (vuelve al inicio y borra la partida). `none` → "No quedó ninguna candidata en la lista" y "Listo".
- [ ] **Step 1: Write the failing tests:** inicio y botón con pocos títulos; la elección de los dos con el pase (las de Tomás bloqueadas para Juli); con `random = () => 0.999`, el primer duelo es la primera de Tomás contra la primera de Juli; tocar una carta avanza y un doble toque decide un solo duelo; "Deshacer" vuelve; 7 duelos dan "¡Ganó…!" y "Listo" vuelve al inicio; con una lista de 3 títulos hay un hueco y el torneo termina; un título que se marca visto a mitad pasa a ser hueco; recargar (`unmount` y render) en un duelo sigue en el mismo; `ChooseMenu` con "Torneo" tercero.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (y la sección 8 de la spec).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local a 390×844 y 393×852: un torneo entero, midiendo que las dos cartas y los botones del duelo terminen arriba de las pestañas.
- [ ] **Step 6: Commit** `feat: pantalla del torneo`

### Task 4: Publicación y aceptación

- [ ] **Step 1:** `npm test && npm run typecheck && npm run lint` (no hay cambios en la base ni en las funciones).
- [ ] **Step 2:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar el bundle publicado.
- [ ] **Step 3: Prueba de aceptación** (Tomás, en su iPhone con Juli): eligen 4 cada uno pasándose el celular, juegan las tres rondas y queda una ganadora; prueban "Deshacer".
- [ ] **Step 4: Commit** `docs: cierre de la Etapa 10` (notas, "Cierre de la Etapa 10").

**Cierre de la Etapa 10:** de 8 títulos queda un ganador en tres rondas. **No entra** (no adelantar): modo sin internet.
