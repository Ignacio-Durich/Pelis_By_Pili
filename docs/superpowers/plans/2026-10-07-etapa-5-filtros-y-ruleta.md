# Pelis By Pili — Etapa 5 (Filtros y ruleta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtrar la lista "Por ver" por tipo, duración, género, plataforma y puntaje mínimo de IMDb, y elegir qué ver con una ruleta que solo sugiere títulos que cumplen esos filtros, con un veto por persona.

**Architecture:**
- Para filtrar hacen falta datos que hoy no se guardan: la duración, los géneros y dónde se puede ver con suscripción o gratis.
  - La función `title-detail`, que ya consulta TMDB, los guarda en columnas nuevas de `titles` cada vez que se abre un detalle.
  - La lista completa en segundo plano los títulos sin esos datos, o con datos de más de 7 días, de a uno y hasta 10 por carga.
- El filtrado es una función pura, `matchesFilters`, que comparten la lista y la ruleta. Los filtros viven en `Home` y valen para las dos pantallas.
- La ruleta aparece en una pestaña nueva, "Elegir". Es para usarla juntos desde un celular. Los vetos se guardan solo en memoria y se renuevan al salir de la pestaña o al cambiar los filtros.

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas ni tablas nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 5, 7, 8 y Etapa 5). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Solo los miembros del espacio leen o cambian los datos de sus títulos. Las columnas nuevas las escribe solo la función, con la clave de servicio; el cliente sigue sin permiso de `update` sobre `titles`.
- Interfaz en español rioplatense; los textos exactos están en cada tarea.
- Alcance estricto. **No entra:** modos de a dos (swipe, revelación, torneo), preguntas rápidas del momento, lista sin conexión.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md`. Los puntos menores de la revisión final van a la Etapa 12 de la spec.
- **Decisión confirmada por Tomás el 2026-10-07: un veto por persona en cada sesión de ruleta.**
  - Debajo del resultado hay un botón por persona: "Veto de Tomás" y "Veto de Juli".
  - El título vetado no vuelve a salir en esa sesión, pero sigue en la lista.
  - Sin vetos disponibles, el resultado queda firme.
  - Al salir de la pestaña "Elegir", o al cambiar un filtro, la sesión empieza de nuevo.
- Decisiones confirmadas por Tomás el 2026-10-07:
  - **Se guarda dónde se puede ver cada título, como lista de nombres de plataformas.** La spec (sección 5) decía que la disponibilidad no se guardaba y se consultaba al abrir el detalle, pero para filtrar por plataforma toda la lista hace falta tenerla. Se guardan solo las de suscripción y las gratis, y se renuevan como mucho cada 7 días. El detalle sigue consultándolas en vivo.
  - **Duración:** las películas usan su duración y las series la de un episodio (TMDB no trae duración promedio, así que se toma la del último episodio emitido). El filtro es un máximo: "Cualquiera", "Hasta 1 h 30", "Hasta 2 h", "Hasta 2 h 30".
  - **Puntaje mínimo de IMDb:** "Cualquiera", "6 o más", "7 o más", "8 o más".
  - **Géneros y plataformas:** se eligen entre los que aparecen en la lista "Por ver"; un título pasa si tiene alguno de los elegidos.
  - **Con un filtro activo, un título sin ese dato no pasa.** Con "Netflix" elegido aparecen solo los títulos que están en Netflix (pedido de Tomás): ni los de otras plataformas ni los que no tienen plataformas conocidas. Con dos plataformas elegidas, aparecen los que están en alguna de las dos. Sin filtros, se ven todos.
  - **Los filtros aplican a "Por ver" y a la ruleta**, no a "Vistas". No se guardan entre usos de la app.
  - **"Elegir" es una pestaña nueva** de la barra de abajo (Lista, Elegir, Ajustes). Por ahora muestra solo la ruleta; el menú de modos llega cuando haya un segundo modo.
  - **Al vetar, la ruleta gira sola otra vez.** No hay otro "girar de nuevo": así los vetos sí cuentan.

## Review Focus

Entradas o fallas que la spec implica y que más pueden molestar, de la más a la menos probable:

1. **Títulos todavía sin datos** (recién agregados, o de etapas anteriores que nadie abrió): sin filtros se ven y entran en la ruleta; con un filtro que necesita ese dato quedan afuera. Se completan solos en segundo plano. Probado en las Tasks 2 y 3.
2. **Filtros que no dejan ningún título:** la lista dice "Ningún título cumple estos filtros" con "Limpiar filtros", y la ruleta no deja girar. Probado en las Tasks 3 y 4.
3. **Vetos:** cada uno veta una sola vez, lo vetado no vuelve a salir en la sesión, sin vetos el resultado queda firme, con un solo miembro hay un solo botón de veto, y si un veto deja la ruleta sin candidatos lo dice. Probado en la Task 4.
4. **Cambiar un filtro en medio de una sesión:** se borran el resultado y los vetos. Probado en la Task 4.
5. **La pareja quita o marca vista el título que salió en la ruleta:** el resultado se borra y aparece "Ese título ya no está en Por ver. Giren de nuevo.", sin gastar vetos. Probado en la Task 4.

---

### Task 1: Duración, géneros y plataformas guardados por la función de detalle

**Files:**
- Create: `supabase/migrations/20261011000000_title_filter_data.sql`
- Modify: `supabase/functions/title-detail/lib.ts`, `supabase/functions/title-detail/index.ts`
- Test: `supabase/functions/title-detail/lib.test.ts`, `tests/security/detail.test.ts`

**Interfaces:**
- Produces (SQL), columnas nuevas de `public.titles`, todas `null` por defecto:
  - `runtime smallint`, check entre 1 y 1000 (minutos).
  - `genres text[]`, check `cardinality(genres) <= 20`.
  - `streaming text[]`, check `cardinality(streaming) <= 50`.
  - `details_updated_at timestamptz`.
  - No hay permisos nuevos para `authenticated`.
- Produces, en `title-detail/lib.ts`:
  - `export function pickRuntime(details: { runtime?: number | null; episode_run_time?: number[]; last_episode_to_air?: { runtime?: number | null } | null }): number | null`: `runtime` si es mayor que 0; si no, el primer valor positivo de `episode_run_time`; si no, `last_episode_to_air.runtime`; si no, `null`.
  - `export function pickGenres(details: { genres?: { name: string }[] }): string[]`: los nombres, sin repetir.
  - `export function streamingNames(providers: Providers | null): string[]`: los nombres de `subscription` y `free`, sin repetir. Con `null`, `[]`.
- Produces, en `index.ts`: en cada llamada exitosa se actualizan `runtime`, `genres`, `streaming` y `details_updated_at = now()` con la clave de servicio, junto con los puntajes si corresponde. La respuesta (`TitleDetail`) no cambia.

- [ ] **Step 1: Escribir los tests que fallan**

- `lib.test.ts`:
  - `pickRuntime`:
    - `{ runtime: 132 }` → 132.
    - `{ runtime: 0, episode_run_time: [], last_episode_to_air: { runtime: 56 } }` → 56.
    - `{ episode_run_time: [45, 50] }` → 45.
    - `{}` → `null`.
  - `pickGenres`: `{ genres: [{ name: 'Drama' }, { name: 'Crimen' }, { name: 'Drama' }] }` → `['Drama', 'Crimen']`; `{}` → `[]`.
  - `streamingNames`: con suscripción Netflix y Prime Video, alquiler Apple TV y gratis Pluto TV → `['Netflix', 'Prime Video', 'Pluto TV']`; `null` → `[]`.
- `detail.test.ts`:
  - `the detail saves runtime, genres and streaming on the title`: después de pedir el detalle de Parásitos, B lee el título con `runtime` 132, `genres` que incluye "Drama", `streaming` con al menos un nombre y `details_updated_at` no nulo.
  - `members cannot write the filter data`: un `update({ runtime: 1 })` directo hecho por A → error.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- supabase/functions` y `npm run test:security -- tests/security/detail.test.ts`
Expected: FAIL.

- [ ] **Step 3: Migración, funciones puras y `index.ts`**

Run: `npx supabase db reset`, reiniciar las funciones locales, y después `npm test && npm run test:security`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase tests && git commit -m "feat: duración, géneros y plataformas guardados con el título"
```

### Task 2: Datos de filtro en el cliente y completado en segundo plano

**Files:**
- Create: `src/features/titles/useBackfillDetails.ts`
- Modify: `src/features/titles/titlesApi.ts`, `src/features/titles/TitleList.tsx`
- Test: `src/features/titles/useBackfillDetails.test.tsx`; tests nuevos en `titlesApi.test.ts`

**Interfaces:**
- Consumes: las columnas de la Task 1 y `fetchTitleDetail`.
- Produces:
  - **`Title` suma** `runtime: number | null`, `genres: string[]`, `streaming: string[]` y `detailsUpdatedAt: string | null`. `listTitles` los mapea; un `null` de la base en `genres` o `streaming` pasa a ser `[]`.
  - **`useBackfillDetails(titles: Title[] | null): void`:**
    - Elige los títulos con `detailsUpdatedAt` nulo o de hace 7 días o más.
    - Llama a `fetchTitleDetail` de a uno, esperando cada respuesta, hasta 10 por montaje del componente.
    - No reintenta un id que ya intentó, aunque falle.
    - Ignora los errores. Realtime trae los datos nuevos.
  - **`TitleList` llama a `useBackfillDetails(titles)`.**

- [ ] **Step 1: Escribir los tests que fallan**

- **`titlesApi`:** `listTitles` mapea `runtime`, `genres`, `streaming` y `details_updated_at`, y `genres: null` pasa a ser `[]`.
- **`useBackfillDetails`**, con `renderHook` y `fetchTitleDetail` simulado:
  - Pide el detalle de los títulos sin datos o con datos de 7 días o más. No lo pide para los que tienen datos de hace 2 días.
  - Va de a uno: el segundo pedido sale recién cuando termina el primero.
  - Como mucho 10 pedidos aunque falten 15.
  - Si se vuelve a renderizar con la misma lista, no repite ids.
  - Un pedido que falla no corta los siguientes.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/titles`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Además, sumar los campos nuevos a los títulos de ejemplo de los tests existentes.

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: datos de filtro en el cliente y completado en segundo plano"
```

### Task 3: Filtros de la lista

**Files:**
- Create: `src/features/titles/filters.ts`, `src/features/titles/FiltersPanel.tsx`
- Modify: `src/app/Home.tsx` (guarda los filtros y se los pasa a la lista), `src/features/titles/TitleList.tsx`, `src/app/styles.css`
- Test: `src/features/titles/filters.test.ts`, `src/features/titles/FiltersPanel.test.tsx`; tests nuevos en `TitleList.test.tsx`

**Interfaces:**
- Produces, en `filters.ts`:
  - `export type Filters = { type: 'all' | 'movie' | 'tv'; maxRuntime: number | null; minImdb: number | null; genres: string[]; platforms: string[] }`
  - `export const NO_FILTERS: Filters` (todo en "cualquiera").
  - `export function activeCount(f: Filters): number`: cuántos de los cinco filtros están activos.
  - `export function matchesFilters(t: Title, f: Filters): boolean`:
    - **Tipo:** `t.mediaType === f.type`, si `type` no es `'all'`.
    - **Duración:** `t.runtime !== null && t.runtime <= maxRuntime`.
    - **IMDb:** el número de `t.imdbRating` (por ejemplo, "8.5/10" → 8,5) tiene que ser `>= minImdb`; sin puntaje no pasa.
    - **Géneros:** algún género de `f.genres` está en `t.genres`.
    - **Plataformas:** alguna de `f.platforms` está en `t.streaming`.
  - `export function filterOptions(titles: Title[]): { genres: string[]; platforms: string[] }`: los géneros y plataformas que aparecen en esos títulos, sin repetir y en orden alfabético (`localeCompare` con `'es'`).
- Produces: `FiltersPanel(props: { value: Filters; options: { genres: string[]; platforms: string[] }; onChange: (f: Filters) => void }): JSX.Element`.
- `TitleList` recibe `filters: Filters` y `onFiltersChange: (f: Filters) => void` desde `Home`.

- [ ] **Step 1: Escribir los tests que fallan**

- **`filters.test.ts`:** cada filtro por separado, la combinación (tienen que cumplirse todos) y los casos sin dato:
  - sin `runtime` con `maxRuntime` → no pasa;
  - sin `imdbRating` con `minImdb` → no pasa;
  - sin `streaming` con plataformas elegidas → no pasa;
  - con `NO_FILTERS` pasa un título sin ningún dato.
  - También `activeCount` y `filterOptions`, con géneros repetidos y orden alfabético ("Ciencia ficción" antes que "Drama").
- **`FiltersPanel`:**
  - Un botón "Filtros", o "Filtros (2)" si hay 2 activos, abre y cierra el panel.
  - El panel tiene:
    - "Tipo", con tres botones `aria-pressed`: "Todo", "Películas" y "Series".
    - Un `select` "Duración" con "Cualquiera", "Hasta 1 h 30" (90), "Hasta 2 h" (120) y "Hasta 2 h 30" (150).
    - Un `select` "Puntaje IMDb" con "Cualquiera", "6 o más", "7 o más" y "8 o más".
    - "Géneros" y "Plataformas", como botones `aria-pressed` con las opciones recibidas. Sin opciones, cada grupo dice "Todavía no hay datos".
    - "Limpiar filtros", que llama a `onChange(NO_FILTERS)`.
  - Cada control llama a `onChange` con el filtro cambiado.
- **`TitleList`:**
  - En "Por ver" se ve el panel y la lista muestra solo lo que cumple los filtros.
  - Si nada cumple y hay títulos, dice "Ningún título cumple estos filtros" con el botón "Limpiar filtros".
  - En "Vistas" no aparece el panel y se ven todos los vistos.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: filtros de la lista Por ver"
```

### Task 4: Ruleta con un veto por persona

**Files:**
- Create: `src/features/choose/Roulette.tsx`, `src/features/choose/roulette.ts`
- Modify: `src/app/Home.tsx` (pestaña "Elegir"), `src/app/styles.css`
- Test: `src/features/choose/roulette.test.ts`, `src/features/choose/Roulette.test.tsx`; tests nuevos en `src/app/Home.test.tsx`

**Interfaces:**
- Consumes:
  - De la Task 3: `Filters`, `matchesFilters`, `filterOptions` y `FiltersPanel`.
  - De etapas anteriores: `listTitles`, `subscribeTitles`, `useCouple`, `useMemberName`, `TitleCard` y `ratings.ts`.
- Produces:
  - `roulette.ts`: `export function pick<T>(candidates: T[], random: () => number = Math.random): T | null`. Toma uno al azar: `candidates[Math.floor(random() * length)]`, o `null` si no hay.
  - `Roulette(props: { filters: Filters; onFiltersChange: (f: Filters) => void; random?: () => number }): JSX.Element`.
    - Carga la lista con `listTitles` y `subscribeTitles`, igual que `TitleList`.
    - Los candidatos son los títulos `to_watch` que cumplen los filtros, sin los vetados.
  - `Home`:
    - La barra de abajo pasa a tener "Lista", "Elegir" y "Ajustes".
    - Los filtros viven en `Home` y se comparten entre "Lista" y "Elegir".

- [ ] **Step 1: Escribir los tests que fallan** (APIs simuladas, `random` fijo)

- **`roulette.test.ts`:** `pick([a, b, c], () => 0.5)` → `b`; `pick([], …)` → `null`; `random` 0.999 → el último.
- **`Roulette.test.tsx`:**
  - **Pantalla inicial:** encabezado "Ruleta", el `FiltersPanel` y el texto "Hay 3 títulos que cumplen los filtros" (o "1 título"). El botón "Girar" está habilitado.
  - **Sin candidatos:** "Ningún título cumple estos filtros" y "Girar" deshabilitado.
  - **Girar:** muestra el resultado con `TitleCard` y el encabezado "Les tocó". El giro no anima si `matchMedia('(prefers-reduced-motion: reduce)')` lo pide; en el test se simula así.
  - **Botones de veto:**
    - Debajo del resultado están "Veto de Tomás" y "Veto de Juli", y desaparece "Girar".
    - Con un solo miembro, un solo botón de veto.
  - **Vetar:**
    - "Veto de Tomás" saca ese título de los candidatos, gira solo otra vez (sale otro título) y el botón queda deshabilitado con el texto "Tomás ya vetó".
    - Después del segundo veto no quedan botones habilitados y aparece "No quedan vetos: ¡a ver esta!".
  - **Un veto que deja sin candidatos:** aparece "No quedan títulos con estos filtros" y ningún resultado.
  - **Cambiar un filtro:** se borran el resultado y los vetos, y vuelve "Girar".
  - **La pareja quita o marca vista el resultado:** con `subscribeTitles` avisando un cambio, el resultado desaparece y se ve "Ese título ya no está en Por ver. Giren de nuevo.". Los vetos no se gastan y "Girar" vuelve.
  - **"Ver detalle"** en el resultado abre `TitleDetail`, y su "Volver" vuelve a la ruleta con el mismo resultado.
- **`Home.test.tsx`:**
  - La barra tiene "Lista", "Elegir" y "Ajustes".
  - Un filtro elegido en "Lista" sigue elegido al pasar a "Elegir".

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

- **Animación:** durante 1,2 s el nombre va cambiando entre candidatos (cada 80 ms) y después queda el elegido por `pick`. Con movimiento reducido, va directo al elegido.
- **Al salir de la pestaña "Elegir":** `Roulette` se desmonta y la sesión se pierde. Así se renuevan los vetos.

Run: `npm test && npm run typecheck && npx oxlint && npm run build`
Expected: PASS.

- [ ] **Step 4: Revisión visual en local**

Run: `npx vite --mode test` contra el Supabase local, con el stack reiniciado después del último `db reset` y las funciones servidas.
1. Agregar 4 títulos variados (película y serie, distintas plataformas).
2. Esperar a que se completen sus datos.
3. Filtrar por tipo y plataforma.
4. Girar, vetar dos veces y cambiar un filtro.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: ruleta con un veto por persona"
```

### Task 5: Publicación y aceptación

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-10-verificacion-fuentes.md`: sección "Cierre de la Etapa 5".
  - `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`: aclaración en la sección 5 sobre las plataformas guardadas, y los puntos menores en la Etapa 12.

- [ ] **Step 1: Migración en el proyecto real (Tomás, en su terminal) y despliegue de la función**

Run: `npx supabase db push`; después, `npx supabase functions deploy title-detail --use-api` y una sola corrida de `npm run test:security:remote`.
Expected: todo en verde.

- [ ] **Step 2: Suite completa y publicación**

Antes de publicar, revisar que `dist/` no contenga claves secretas ni `127.0.0.1:54321`.

Run: `npm test && npm run test:security && npm run typecheck && npm run build`, y después `npx netlify-cli deploy --prod --no-build --dir=dist`
Expected: todo en verde, `HTTP/2 200`, y el bundle publicado es el mismo que el local.

- [ ] **Step 3: Prueba de aceptación** (Tomás, y la cuenta de prueba en un celular prestado)

1. Con 4 o más títulos en "Por ver", después de abrir la app esperar unos segundos a que se completen los datos.
2. Filtrar por "Películas" y por una plataforma: la lista muestra solo lo que cumple.
3. En "Elegir", con los mismos filtros, girar: solo salen títulos que cumplen los filtros.
4. Vetar una vez cada uno: gira solo, y después de dos vetos el resultado queda firme.
5. Cambiar un filtro: los vetos vuelven.

Anotar el resultado en las notas.

- [ ] **Step 4: Commit**

```bash
git add docs && git commit -m "docs: cierre de la Etapa 5"
```

**Cierre de la Etapa 5:** la ruleta solo sugiere títulos que cumplen los filtros. **No entra** (no adelantar): modos de a dos, preguntas rápidas y lista sin conexión.

---

## Cambios pedidos por Tomás después de probar (2026-10-07)

Se hacen antes de la prueba de aceptación (Task 5, paso 3), que se repite al final con estos cambios.

### Task 6: Duración y puntaje IMDb como barras de rango

**Files:**
- Create: `src/features/titles/RangeSlider.tsx`
- Modify: `src/features/titles/filters.ts`, `src/features/titles/FiltersPanel.tsx`, `src/app/styles.css`
- Test: `src/features/titles/RangeSlider.test.tsx`; tests actualizados en `filters.test.ts` y `FiltersPanel.test.tsx`

**Interfaces:**
- `Filters` cambia `maxRuntime` y `minImdb` por:
  - `runtime: [number, number]`, en minutos, de 0 a 240, de a 30. `[0, 240]` es "cualquiera".
  - `imdb: [number, number]`, de 1 a 10, de a 1. `[1, 10]` es "cualquiera".
- `NO_FILTERS` tiene `runtime: [0, 240]` e `imdb: [1, 10]`.
- **`matchesFilters`:**
  - Si un rango no es el completo, un título sin ese dato no pasa.
  - El 0 de duración y el 1 de IMDb no ponen piso. El 240 de duración no pone techo ("4 h o más"). El 10 de IMDb sí, pero nada pasa de 10.
  - Si no, el valor tiene que estar entre los dos extremos, incluidos.
- **`activeCount`:** cada rango que no es el completo cuenta 1.
- **`RangeSlider(props: { label: string; min: number; max: number; step: number; value: [number, number]; format: (v: number) => string; onChange: (v: [number, number]) => void })`:**
  - Dos `input type="range"` superpuestos, con nombres "<label> mínimo" y "<label> máximo".
  - Un extremo no puede pasar al otro: se frena en el valor del otro.
  - Muestra el texto del rango elegido.
- **Textos:**
  - Duración: "Cualquier duración", "Hasta 2 h", "Desde 1 h 30" o "Entre 1 h y 2 h 30". Las horas se escriben "1 h", "1 h 30" y "30 min".
  - IMDb: "Cualquier puntaje", "6 o más", "Hasta 8" o "Entre 6 y 8".

- [ ] **Step 1: Tests que fallan.**
  - **`filters.test.ts`:** los rangos (dentro, fuera, extremos incluidos, sin dato con rango activo, 240 sin techo) y `activeCount`.
  - **`RangeSlider.test.tsx`:** mover cada extremo llama a `onChange`; un extremo no cruza al otro; muestra el texto.
  - **`FiltersPanel.test.tsx`:** las barras "Duración" e "IMDb", con sus textos, reemplazan a los `select`.
- [ ] **Step 2: Verificar que fallan.**
- [ ] **Step 3: Implementar y verificar.** Run: `npm test && npm run typecheck && npx oxlint`.
- [ ] **Step 4: Commit.**

### Task 7: Ruleta animada

**Files:**
- Create: `src/features/choose/Wheel.tsx`, `src/features/choose/wheel.ts`
- Modify: `src/features/choose/Roulette.tsx`, `src/app/styles.css`
- Test: `src/features/choose/wheel.test.ts`, `src/features/choose/Wheel.test.tsx`; tests actualizados en `Roulette.test.tsx`

**Interfaces:**
- **`wheel.ts`:**
  - `export function targetRotation(current: number, index: number, count: number, turns = 5): number`. Devuelve la rotación final en grados, siempre mayor que `current` y con al menos `turns` vueltas completas, tal que el centro del gajo `index` quede bajo la flecha de arriba.
  - `export function shortLabel(title: string, max = 14): string`. Recorta con "…".
- **`Wheel(props: { items: { id: string; label: string }[]; targetId: string | null; spinKey: number; onEnd: () => void })`:**
  - Dibuja un SVG con un gajo por ítem, en colores alternados del tema, y una flecha arriba.
  - Con hasta 12 ítems, cada gajo muestra `shortLabel`; con más, solo colores.
  - Cada vez que cambia `spinKey`, gira hasta `targetRotation` con una transición CSS de 4 s, frenando al final. Al terminar (`transitionend`, o un tiempo de resguardo de 4,5 s) llama a `onEnd` una sola vez.
  - Con `prefers-reduced-motion`, no anima y llama a `onEnd` enseguida.
- **`Roulette`:**
  - Muestra la rueda con los candidatos desde el principio.
  - "Girar" y cada veto hacen girar la rueda hacia el elegido por `pick`.
  - Mientras gira se muestra "Girando…" debajo de la rueda.
  - "Les tocó" aparece cuando la rueda para.

- [ ] **Step 1: Tests que fallan.**
  - **`wheel.test.ts`:** `targetRotation` para varios `index`/`count`: el gajo queda bajo la flecha, la rotación crece y da al menos 5 vueltas. Además, `shortLabel`.
  - **`Wheel.test.tsx`:** un gajo por ítem; nombres solo con 12 o menos; al cambiar `spinKey` aplica la rotación; `transitionend` llama a `onEnd` una vez; con movimiento reducido, `onEnd` enseguida.
  - **`Roulette.test.tsx`:** la rueda está desde el principio; el resultado aparece después de que la rueda termina.
- [ ] **Step 2: Verificar que fallan.**
- [ ] **Step 3: Implementar y verificar.** Run: `npm test && npm run typecheck && npx oxlint && npm run build`, y una revisión visual en local de que gira y para en el título que aparece en "Les tocó".
- [ ] **Step 4: Commit.**

Después de las Tasks 6 y 7 se repiten los pasos 2 y 3 de la Task 5 (publicar y probar en los celulares).

### Task 8: Cuántos títulos cumplen los filtros (pedido de Tomás, 2026-10-07)

**Files:** Modify `src/features/titles/FiltersPanel.tsx`, `src/features/titles/TitleList.tsx`, `src/features/choose/Roulette.tsx`. Test: `FiltersPanel.test.tsx`, `TitleList.test.tsx`, `Roulette.test.tsx`.

**Interfaces:** `FiltersPanel` suma `count: { matching: number; total: number }` (títulos "Por ver" que cumplen / todos los "Por ver"). Con al menos un filtro activo, debajo del botón "Filtros" (panel abierto o cerrado) muestra "3 de 12 títulos cumplen los filtros", "1 de 12 títulos cumple los filtros" o "0 de 12 títulos cumplen los filtros". Sin filtros activos no muestra nada.

- [ ] Tests que fallan (panel: textos y oculto sin filtros; lista y ruleta: pasan los números correctos) → implementar → `npm test && npm run typecheck && npx oxlint` → commit.
