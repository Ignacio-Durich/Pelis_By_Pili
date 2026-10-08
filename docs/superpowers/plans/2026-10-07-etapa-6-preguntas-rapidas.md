# Pelis By Pili — Etapa 6 (Preguntas rápidas del momento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Nacho y Pili respondan cuánto tiempo tienen, qué ánimo tienen (uno o varios) y en qué plataforma quieren ver, y que la app sugiera los 3 mejores títulos de su lista "Por ver" para ese momento.

**Architecture:**
- **Lógica pura** en `quickPick.ts`, sin red ni base. Recibe la lista y las respuestas y devuelve hasta 3 títulos, y si hubo que completar con otros que no coinciden con el ánimo. Usa los datos que ya se guardan desde la etapa 5: duración, géneros, plataformas y puntajes.
- **Pantalla** "Preguntas rápidas" en la pestaña "Elegir". Como ya hay dos modos, "Elegir" pasa a mostrar un menú: "Ruleta" y "Preguntas rápidas" (spec, sección 7: "Elegir qué ver: menú con los modos").
- **Las sugerencias se recalculan** al cambiar cualquier respuesta, sin botón de confirmar.
- **Sin cambios en la base ni en las funciones.**

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 7, 8 y Etapa 6). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; los textos exactos están en cada tarea.
- Solo se sugieren títulos de "Por ver" (spec, sección 8: el mazo sale de la lista, no de un catálogo general).
- Alcance estricto. **No entra:** sesiones en tiempo real entre los dos celulares (swipe, revelación, torneo) ni lista sin conexión.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md`. Los puntos menores de la revisión final van a la Etapa 12 de la spec.
- Decisiones confirmadas por Nacho el 2026-10-07:
  - **Ánimos y los géneros de TMDB que cuentan para cada uno** (nombres reales de TMDB en `es-AR`; las series usan algunos propios):

    | id | Texto | Géneros |
    |---|---|---|
    | `laugh` | 😂 Reírnos | Comedia, Animación, Familia, Kids |
    | `romantic` | 💕 Algo romántico | Romance, Comedia, Música |
    | `moved` | 😢 Emocionarnos | Drama, Romance, Historia, Música |
    | `adrenaline` | 💥 Adrenalina | Acción, Aventura, Action & Adventure, Bélica, War & Politics, Western |
    | `intrigue` | 🕵️ Intriga | Misterio, Crimen, Suspense |
    | `mindbending` | 🚀 Volar la cabeza | Ciencia ficción, Fantasía, Sci-Fi & Fantasy |
    | `scary` | 👻 Miedo | Terror, Suspense |
    | `learn` | 🧠 Aprender algo | Documental, Historia |
    | `relax` | 😌 Relax | Animación, Comedia, Familia, Documental, Música, Kids, Reality |

  - Se pueden elegir **varios ánimos**. Un título coincide si tiene algún género de alguno de los ánimos elegidos.
  - Si hay menos de 3 que cumplen todo, **se completa** con títulos que cumplen el tiempo y la plataforma aunque no coincidan con el ánimo, con el aviso "No encontramos 3 con ese ánimo; sumamos estas".
- También confirmadas por Nacho el 2026-10-07:
  - **Géneros de Relax** (lo pidió Nacho "para antes de dormir o de fondo"): los de la tabla. No se excluye nada intenso: un drama que también es "Música" cuenta como Relax.
  - **Tiempo:** "Hasta 1 h 30" (90 min), "Hasta 2 h" (120), "Hasta 2 h 30" (150) o "Sin apuro" (sin límite, opción por defecto). En series cuenta la duración de un capítulo.
  - **Plataforma:** "Cualquiera" (por defecto) o una sola de las que aparecen en "Por ver".
  - **Orden:**
    1. Primero los que coinciden con más ánimos elegidos.
    2. A igualdad, el mejor puntaje: IMDb, o TMDB si no hay IMDb. Los que no tienen puntaje van al final.
    3. A igualdad de puntaje, el agregado más recientemente.
  - **Sin ánimos elegidos,** se sugieren los 3 mejores por puntaje que cumplen el tiempo y la plataforma.
  - **"Elegir" pasa a ser un menú** con dos botones, "Ruleta" y "Preguntas rápidas". Cada modo tiene "Volver" al menú. Los filtros de la etapa 5 siguen siendo solo de la lista y la ruleta.

## Review Focus

Entradas o fallas que la spec implica y que más pueden molestar, de la más a la menos probable:

1. **Varios ánimos elegidos:** primero los que coinciden con más ánimos, después por puntaje. Probado en la Task 1.
2. **Menos de 3 coincidencias:** se completa con otros que cumplen tiempo y plataforma, con el aviso. Si ni siquiera hay títulos que cumplan tiempo y plataforma, aparece "Ningún título entra en ese tiempo y plataforma". Probado en las Tasks 1 y 2.
3. **Títulos sin datos** (sin duración, géneros o plataformas): con un tiempo o una plataforma elegidos no entran. Sin géneros, no coinciden con ningún ánimo, pero pueden aparecer para completar. Probado en la Task 1.
4. **Títulos sin puntaje o con empate:** van al final y el orden es siempre el mismo, nunca al azar. Probado en la Task 1.
5. **Títulos vistos o que la pareja quita mientras se mira:** nunca se sugieren, y las sugerencias se actualizan solas por Realtime. Probado en las Tasks 1 y 2.

---

### Task 1: Lógica de las sugerencias

**Files:**
- Create: `src/features/choose/quickPick.ts`
- Test: `src/features/choose/quickPick.test.ts`

**Interfaces:**
- Produces:
  - `export type MoodId = 'laugh' | 'romantic' | 'moved' | 'adrenaline' | 'intrigue' | 'mindbending' | 'scary' | 'learn' | 'relax'`
  - `export const MOODS: { id: MoodId; label: string; genres: string[] }[]`, con los textos y géneros de la tabla, en ese orden.
  - `export const TIME_OPTIONS: { minutes: number | null; label: string }[]`: `[90, 'Hasta 1 h 30'], [120, 'Hasta 2 h'], [150, 'Hasta 2 h 30'], [null, 'Sin apuro']`.
  - `export type Answers = { maxMinutes: number | null; moods: MoodId[]; platform: string | null }` y `export const NO_ANSWERS: Answers = { maxMinutes: null, moods: [], platform: null }`.
  - `export function quickPick(titles: Title[], answers: Answers): { picks: Title[]; filled: boolean }`:
    1. Parte de los títulos `to_watch`.
    2. Se quedan los que cumplen el tiempo y la plataforma. Si hay un tiempo elegido, hace falta `runtime !== null && runtime <= maxMinutes`; si hay una plataforma, `streaming` tiene que incluirla.
    3. Ordena por: cantidad de ánimos elegidos con los que coincide (de más a menos), después puntaje (IMDb, o TMDB si no hay, o sin puntaje al final), y después `createdAt` (más nuevo primero).
    4. Si hay ánimos elegidos:
       - toma hasta 3 de los que coinciden con al menos uno;
       - si son menos de 3, completa con los que no coinciden, en el mismo orden, y `filled = true`.
    5. Sin ánimos elegidos, toma los 3 primeros y `filled = false`.

- [ ] **Step 1: Escribir los tests que fallan** (con `makeTitle` de `src/test/titles.ts`)

- `MOODS` tiene los 9 ánimos de la tabla, con sus géneros exactos.
- **Tiempo:** con `maxMinutes: 120` entra uno de 119 min y no uno de 132 ni uno sin duración. Con `null` entran todos.
- **Plataforma:** con `'Netflix'` entran solo los que tienen Netflix; con `null`, todos.
- **Un ánimo:** con `['scary']`, uno de "Terror" va antes que uno de "Comedia" aunque este tenga mejor puntaje.
- **Varios ánimos:** con `['laugh', 'romantic']`, uno de "Comedia" y "Romance" (coincide con los dos) va antes que uno de solo "Comedia", aunque tenga peor puntaje.
- **Desempate por puntaje:** se usa IMDb ("8.5/10" → 8,5), o TMDB si no hay IMDb; sin puntaje va al final; a igual puntaje, va primero el de `createdAt` más reciente.
- **Completar:** con un solo título que coincide con el ánimo y otros 4 que cumplen tiempo y plataforma, `picks` tiene 3, el primero es el que coincide y `filled` es `true`. Con 3 o más que coinciden, `filled` es `false`.
- **Sin ánimos:** los 3 mejores por puntaje, con `filled` en `false`.
- **Vistos:** un título `watched` nunca aparece.
- **Sin candidatos:** con lista vacía, o nada que cumpla tiempo y plataforma, devuelve `{ picks: [], filled: false }`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/choose/quickPick`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: lógica de las preguntas rápidas"
```

### Task 2: Menú de "Elegir" y pantalla de preguntas rápidas

**Files:**
- Create: `src/features/choose/ChooseMenu.tsx`, `src/features/choose/QuickQuestions.tsx`
- Modify: `src/app/Home.tsx` (la pestaña "Elegir" muestra `ChooseMenu`), `src/app/styles.css`
- Test: `src/features/choose/ChooseMenu.test.tsx`, `src/features/choose/QuickQuestions.test.tsx`; actualizar `src/app/Home.test.tsx`

**Interfaces:**
- Consumes:
  - De la Task 1: `quickPick`, `MOODS`, `TIME_OPTIONS`, `NO_ANSWERS` y `Answers`.
  - De etapas anteriores: `useTitles`, `useCouple`, `filterOptions` (para las plataformas), `TitleCard`, `TitleDetail` y `ratings.ts`.
  - El patrón de la ruleta: ocultar la pantalla con `hidden`, y subir y volver el scroll al abrir y cerrar el detalle.
- Produces:
  - `ChooseMenu(props: { filters: Filters; onFiltersChange: (f: Filters) => void }): JSX.Element`:
    - Muestra el encabezado "¿Qué vemos?" y dos botones: "Ruleta" (texto de ayuda "Gira entre los títulos que cumplen los filtros") y "Preguntas rápidas" (texto de ayuda "Respondan tres preguntas y les sugerimos 3").
    - Al elegir uno, muestra ese modo con un botón "Volver" que regresa al menú.
  - `QuickQuestions(): JSX.Element`:
    - **"¿Cuánto tiempo tienen?":** botones `aria-pressed` con `TIME_OPTIONS`. "Sin apuro" está elegido por defecto.
    - **"¿Qué ánimo tienen?":** botones `aria-pressed` con `MOODS`. Se pueden elegir varios o ninguno.
    - **"¿Dónde lo ven?":** "Cualquiera", elegido por defecto, más las plataformas de los títulos "Por ver"; se elige una sola.
    - **"Les sugerimos":** hasta 3 resultados.
      - Cada uno con `TitleCard`, "IMDb x · RT y" y un botón "Ver detalle".
      - Si `filled`, el aviso "No encontramos 3 con ese ánimo; sumamos estas".
      - Sin resultados, "Ningún título entra en ese tiempo y plataforma".
      - Mientras carga, "Cargando…". Sin conexión, "Sin conexión. Probá de nuevo." con "Reintentar".

- [ ] **Step 1: Escribir los tests que fallan** (APIs simuladas)

- **`ChooseMenu`:**
  - Muestra los dos modos con sus textos.
  - "Ruleta" abre la ruleta (encabezado "Ruleta") y "Volver" vuelve al menú.
  - "Preguntas rápidas" abre la pantalla de preguntas y "Volver" vuelve al menú.
- **`QuickQuestions`:**
  - Muestra las tres preguntas con sus opciones; están elegidos "Sin apuro" y "Cualquiera".
  - Sin elegir nada, sugiere los 3 mejores por puntaje.
  - Elegir "👻 Miedo" cambia las sugerencias: primero las de terror.
  - Elegir dos ánimos los deja a los dos marcados, y tocar uno de nuevo lo desmarca.
  - Elegir "Hasta 1 h 30" saca una de 132 min.
  - Elegir una plataforma deja solo las de esa plataforma.
  - Con una sola coincidencia de ánimo, aparece el aviso de que se completó.
  - Si nada entra en el tiempo y la plataforma, aparece "Ningún título entra en ese tiempo y plataforma".
  - **Realtime:** si la pareja marca vista una sugerida, `subscribeTitles` avisa y desaparece de las sugerencias.
  - **Detalle:** "Ver detalle" abre el detalle arriba, y "Volver" vuelve a las mismas respuestas y sugerencias.
- **`Home`:** la pestaña "Elegir" muestra el menú "¿Qué vemos?". El test de la etapa 5 que pasaba por "Elegir" ahora entra a "Ruleta" desde el menú.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Run: `npm test && npm run typecheck && npx oxlint && npm run build`
Expected: PASS.

- [ ] **Step 4: Revisión visual en local**

Run: `npx vite --mode test` contra el Supabase local.
1. Con un usuario de prueba y unos 6 títulos variados que ya tengan sus datos (cargarlos con un script, como en la etapa 5).
2. Responder las preguntas y comprobar que las sugerencias cambian, que aparece el aviso de completar y que "Ver detalle" abre arriba.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: menú de Elegir y preguntas rápidas"
```

### Task 3: Publicación y aceptación

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-10-verificacion-fuentes.md`: sección "Cierre de la Etapa 6".
  - `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`: la sección 8 se actualiza con los ánimos, y los puntos menores de la revisión van a la Etapa 12.

- [ ] **Step 1: Suite completa y publicación**

Run: `npm test && npm run test:security && npm run typecheck`, y después `npm run deploy` (compila, revisa que `dist/` no tenga claves ni la URL local, y publica en Cloudflare).
Expected: todo en verde, `HTTP/2 200` en la dirección de la app, y el bundle publicado es el mismo que el local. No hace falta `db push` ni desplegar funciones.

- [ ] **Step 2: Prueba de aceptación** (Nacho, y la cuenta de prueba en el celular de su hermana)

1. "Elegir" muestra el menú. "Ruleta" sigue funcionando igual.
2. En "Preguntas rápidas", con "Hasta 2 h", "😂 Reírnos" y una plataforma, las 3 sugerencias son coherentes: entran en el tiempo, están en la plataforma, y las primeras son comedias.
3. Sumar "😌 Relax": las sugerencias cambian.
4. Elegir un ánimo que casi no tengan en la lista: aparece el aviso y se completa con otras.

Anotar el resultado en las notas.

- [ ] **Step 3: Commit**

```bash
git add docs && git commit -m "docs: cierre de la Etapa 6"
```

**Cierre de la Etapa 6:** devuelve 3 opciones coherentes con las respuestas. **No entra** (no adelantar): sesiones en tiempo real y lista sin conexión.
