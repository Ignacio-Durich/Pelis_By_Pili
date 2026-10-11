# Pelis By Pili — Etapa 12 (Refinamiento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar los puntos menores que dejaron las etapas 1 a 11, sumar un buscador dentro de la lista y un botón de comentarios.

**Architecture:**
- **Buscador de la lista:** se filtra en el celular sobre la lista que ya está cargada. No hace pedidos y anda sin internet. La lógica pura `matchesQuery` va en `filters.ts`, junto a `matchesFilters`.
- **Comentarios:** se guardan en una tabla `feedback` y se escriben con una función de la base. La app no los puede leer. Tomás los ve pidiéndomelos, porque los leo por SQL, o en el panel de Supabase.
- **Los menores van agrupados por zona, no por etapa:** base, funciones, lista y detalle, sesión y celular, ruleta y filtros, juegos, Compartidos. Cada uno lleva su test. Los que se dejan llevan una nota en las decisiones.

**Tech Stack:** el de siempre. No suma dependencias.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (Etapa 12). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- La interfaz va en español rioplatense. Cada tarea trae sus textos exactos.
- Etapa 12 está terminada cuando cada punto tiene su test y está arreglado, o tiene una decisión anotada de por qué se deja (spec).
- Funciones nuevas: solo el buscador de la lista y el botón de comentarios. Jugar con un solo celular ya está hecho desde las etapas 7, 9 y 10.
- Las pantallas de juego entran sin scroll en 390×844 y 393×852 (spec, sección 12).
- Escrituras: siempre con funciones `security definer` y `search_path = ''`, y RLS con `is_member`. Nadie fuera de la pareja lee ni escribe.
- Cada decisión fuera del plan va a `docs/superpowers/notes/2026-10-decisiones.md`, en la sección "Etapa 12 (2026-10-09)".
- **Decisiones confirmadas por Tomás el 2026-10-09:**
  1. Los comentarios quedan **guardados en la app**, no por mail.
  2. El buscador de la lista busca por **nombre, nombre original y director**. No busca en "De dónde vino" ni en la reseña.
  3. El buscador va en "Lista" y **busca solo en la pestaña abierta**: en "Por ver" busca entre las por ver y en "Vistas" entre las vistas.
- **Decisiones mías:** en "Por ver" la búsqueda se suma a los filtros activos. Lo escrito se mantiene al cambiar de pestaña y al abrir un título y volver. Tocar "Lista" lo vacía.

## Review Focus

1. **Tildes y mayúsculas en el buscador:** "amelie" encuentra "Amélie" y "NOLAN" encuentra "Christopher Nolan". Lo prueba la Task 1.
2. **Buscar sin internet o con títulos pendientes:** los títulos anotados sin red, que todavía no tienen director, igual aparecen por su nombre. Lo prueba la Task 1.
3. **Comentarios desde una cuenta sin espacio, anónima o mandando sin parar:** se rechazan (`no_couple`, sin permiso, `too_many` después de 20 en un día). Lo prueba la Task 2.
4. **Cerrar sesión sin internet:** la sesión se cierra igual y no queda en el celular la lista de esa cuenta. Lo prueba la Task 6.
5. **Dos cargas de la lista que terminan en desorden:** gana siempre la última que se pidió y un título borrado no reaparece. Lo prueba la Task 5.

---

### Task 1: Buscador dentro de la lista

**Files:**
- Modify: `src/features/titles/filters.ts`, `src/features/titles/TitleList.tsx`, `src/styles.css`
- Test: `src/features/titles/filters.test.ts`, `src/features/titles/TitleList.test.tsx`

**Interfaces:**
- Produces: `matchesQuery(t: Pick<Title, 'title' | 'originalTitle' | 'director'>, query: string): boolean`. Pasa a minúsculas y saca tildes (`normalize('NFD')` y `\p{Diacritic}`). Cada palabra de la búsqueda tiene que aparecer, como parte de una palabra, en el nombre, en el nombre original o en el director. Las palabras pueden estar en campos distintos. Una búsqueda vacía o solo de espacios devuelve `true`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - En `filters.test.ts`:
    - `'amelie'` encuentra `title: 'Amélie'`.
    - `'NOLAN'` encuentra `director: 'Christopher Nolan'`.
    - `'home alone'` encuentra `originalTitle: 'Home Alone'`.
    - `'padrino coppola'` encuentra `{ title: 'El padrino', director: 'Francis Ford Coppola' }`.
    - `'xyz'` da `false`.
    - `'  '` da `true`.
    - `director: null` no rompe nada.
  - En `TitleList.test.tsx`:
    - En "Por ver", escribir "nolan" en el campo `Buscar en la lista` muestra solo el título de Nolan que está por ver, no el de Nolan que está en "Vistas" ni los demás.
    - Pasar a "Vistas" con "nolan" escrito muestra solo el de Nolan visto.
    - En "Por ver", con un filtro activo que excluye al de Nolan, no aparece.
    - Con "zzz" se ve `Ningún título coincide con «zzz»`.
    - Abrir un resultado y volver conserva lo escrito.
- [ ] **Step 2: Correr** `npx vitest run src/features/titles/filters.test.ts src/features/titles/TitleList.test.tsx` → FAIL.
- [ ] **Step 3: Implementar.**
  - Estado `query` en `TitleList`.
  - Campo `<input type="search" aria-label="Buscar en la lista" placeholder="Buscar por nombre o director">` arriba de `.segmented`, debajo de la bandeja.
  - `shown` suma `matchesQuery(t, query)` al filtrado de cada pestaña; el orden no cambia.
  - El contador de filtros cuenta lo que se ve con la búsqueda incluida.
  - El mensaje de lista vacía por búsqueda va antes que el de filtros.
  - "Lista" ya remonta `TitleList` con `key`, así que se vacía solo.
  - CSS: el campo ocupa todo el ancho, con el estilo de los otros `input`.
- [ ] **Step 4: Correr** los mismos tests → PASS.
- [ ] **Step 5: Commit** `feat: buscador dentro de la lista por nombre y director`

### Task 2: Comentarios y errores

**Files:**
- Create: `supabase/migrations/20261017000000_feedback.sql`, `src/features/settings/feedbackApi.ts`, `src/features/settings/Feedback.tsx`, `tests/security/feedback.test.ts`, `src/features/settings/Feedback.test.tsx`
- Modify: `src/features/settings/Settings.tsx`

**Interfaces:**
- Produces:
  - Tabla `feedback`:
    - `id uuid pk default gen_random_uuid()`
    - `couple_id → couples on delete cascade`
    - `user_id → auth.users on delete set null`
    - `body text not null check (char_length between 1 and 2000)`
    - `user_agent text check (char_length <= 300)`
    - `created_at timestamptz default now()`
  - RLS activa, sin políticas: nadie la lee ni la escribe directo. Se revocan los permisos de `anon` y `authenticated`.
  - `send_feedback(p_body text, p_user_agent text) returns void`:
    - Es `security definer`.
    - Antes de guardar, recorta los espacios del texto y corta `p_user_agent` en 300 caracteres.
    - Errores: `no_couple`; `invalid_feedback` si el texto queda vacío o pasa de 2000; `too_many` si ese usuario ya mandó 20 en las últimas 24 horas.
    - Solo la puede llamar `authenticated`.
  - `sendFeedback(body: string): Promise<void>` en `feedbackApi.ts`. Usa `callRpc` y le pasa `navigator.userAgent`. Tira `FeedbackError` con los tipos `'invalid_feedback' | 'too_many' | 'network'`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `feedback.test.ts`:
    - Un miembro manda un comentario y el admin lo ve con su `couple_id`, su `user_id` y el texto recortado.
    - Ese miembro no puede leer la tabla (vuelve vacía) ni insertar directo (`42501`).
    - El anónimo no puede llamar la función.
    - Una cuenta sin espacio recibe `no_couple`.
    - `'   '` y un texto de 2001 caracteres dan `invalid_feedback`.
    - Después de insertar 20 filas con el admin, el siguiente da `too_many`.
  - `Feedback.test.tsx`:
    - "Mandar" está deshabilitado con el campo vacío.
    - Al mandar se ve `¡Gracias! Tomás lo va a leer.` y el campo se vacía.
    - Con `too_many` se ve `Mandaste muchos hoy. Probá mañana.`
    - Con un error de red se ve `No se pudo mandar. Probá de nuevo.` y el texto queda en el campo.
- [ ] **Step 2: Correr** `npm run test:security -- feedback` y `npx vitest run src/features/settings` → FAIL.
- [ ] **Step 3: Implementar.**
  - La migración.
  - `feedbackApi.ts`.
  - La sección `Feedback` en Ajustes, después de la del Atajo:
    - Título `<h2>Comentarios y errores</h2>`.
    - Texto `Contanos qué mejorar o qué falló.`
    - `<textarea rows={4} maxLength={2000} aria-label="Comentario">`.
    - Botón "Mandar", que muestra "Mandando…" mientras espera.
    - El aviso con `role="status"`.
- [ ] **Step 4: Correr** `npx supabase migration up` y los tests del Step 2 → PASS.
- [ ] **Step 5: Commit** `feat: comentarios y errores desde Ajustes`

### Task 3: Base de datos (etapas 1, 2, 4 y 8)

**Files:**
- Create: `supabase/migrations/20261017000001_refinamiento.sql`
- Modify: `supabase/functions/share/index.ts`
- Test: `tests/security/couples.test.ts`, `tests/security/names.test.ts`, `tests/security/titles.test.ts`, `tests/security/shared.test.ts`

**Interfaces:**
- Produces:
  - **Insert sobre `titles` limitado a columnas:**
    - `revoke insert on titles from authenticated`.
    - `grant insert (couple_id, tmdb_id, media_type, title, original_title, year, poster_path, origin_note)`, las columnas exactas que manda `addTitle`. `added_by` toma su `default auth.uid()`, y la política sigue exigiendo que sea uno mismo.
    - La política RLS de insert no cambia.
  - **Tope de la bandeja en la base:**
    - Trigger `before insert` en `shared_items` con la función `shared_items_cap()`. Bloquea la fila de la pareja (`for update`) y tira `inbox_full` si ya hay 100.
    - Se saca el conteo de `add_shared_item`, porque el trigger lo cubre.
    - La función `share` deja de contar. Si el insert da `inbox_full`, responde 429 con el mismo texto que hoy.
  - **Nombres sin tabulaciones:**
    - `set_display_name`, y cualquier función que reciba un nombre, usan `btrim(p_name, E' \t\r\n')`.
    - El `check` de `couple_members.display_name` pasa a `display_name = btrim(display_name, E' \t\r\n')`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `titles.test.ts`: un miembro inserta directo con `status: 'watched'`, `watched_at` o `imdb_rating` → `42501`. Insertar con las columnas de la app sigue andando.
  - `shared.test.ts`: con 99 ítems, dos `add_shared_item` en `Promise.all` dejan exactamente 100 y uno da `inbox_full`. Lo mismo con dos POST a `share` en paralelo: uno da 201 y el otro 429.
  - `names.test.ts`: `'\tJuli\t'` se guarda como `'Juli'`.
  - `couples.test.ts`:
    - El anónimo recibe `42501` específicamente en cada función y tabla.
    - Un miembro no puede borrar directo en `couple_members` ni en `invites`: la fila sigue.
    - Dos cuentas que se unen al mismo espacio con la misma invitación en `Promise.all`: entra una sola, y la otra recibe el error de invitación usada o de espacio lleno.
- [ ] **Step 2: Correr** `npm run test:security -- titles shared names couples` → FAIL en los nuevos.
- [ ] **Step 3: Escribir la migración y el cambio en `share`.**
- [ ] **Step 4: Correr** `npx supabase migration up` y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `fix: permisos por columna, tope de bandeja en la base y nombres sin tabulaciones`

### Task 4: Funciones (etapas 2, 3, 5 y 8)

**Files:**
- Modify:
  - `supabase/functions/tmdb-search/index.ts`, `supabase/functions/title-detail/index.ts`, `supabase/functions/title-detail/lib.ts`
  - `supabase/functions/share/index.ts`, `supabase/functions/share/lib.ts`
- Test:
  - `supabase/functions/title-detail/lib.test.ts`, `supabase/functions/share/lib.test.ts`
  - `tests/security/search.test.ts`, `tests/security/detail.test.ts`

**Interfaces:**
- Produces:
  - Las tres funciones importan `npm:@supabase/supabase-js@2.117.2`.
  - `tmdb-search` responde 403 `no_couple` si quien llama no es miembro de un espacio. Lo revisa con su propio cliente: `couple_members` filtrado por `user_id`.
  - `mergeRatings(stored, omdb, tmdb, now)`:
    - Si OMDb responde cualquier error y hay puntajes guardados, devuelve los guardados con `stale: true`, igual que con el límite.
    - Con `stale`, igual guarda el puntaje de TMDB recién obtenido: devuelve `save: true` y `ratings` con `tmdb` nuevo y el resto como estaba.
    - El `updatedAt` no cambia, así sigue intentando OMDb.
  - `clampDetails(d)` en `title-detail/lib.ts`:
    - Si `runtime` está fuera de 1–1000, queda `null`.
    - Deja como mucho 20 géneros y 50 plataformas.
    - `index.ts` lo aplica antes del `update`.
    - Si el `update` falla, se registra con `console.error('title-detail update', error.message)`.
  - En `share/lib.ts`:
    - `TRACKING` suma `_t`, `_r`, `is_from_webapp`, `sender_device`, `pp` y `feature`.
    - `cleanLink` saca `.,;:!?)` del final si no hay un `(` que lo abra en el link.
    - Si `body` contiene el link crudo, se reemplaza por el link limpio una sola vez, o se saca si queda igual a `link`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `lib.test.ts` de `title-detail`:
    - `mergeRatings` con un error que no es el límite y puntajes guardados → `stale: true` y los guardados.
    - Con el límite y TMDB 7.9 → `save: true` y `tmdb: 7.9`.
    - `clampDetails` con runtime 0, 1001 y 120, y con 25 géneros.
  - `lib.test.ts` de `share`:
    - `https://vm.tiktok.com/x?_t=1&_r=2&is_from_webapp=1&sender_device=pc` queda sin parámetros.
    - `?v=abc&pp=x&feature=share` deja solo `v`.
    - `(https://a.com/x).` da `https://a.com/x`.
    - `https://es.wikipedia.org/wiki/Foo_(bar)` queda igual.
    - Un texto que repite el link no lo muestra crudo.
  - `search.test.ts`: el usuario de los tests crea su espacio en `beforeAll` (`createCouple`). Una cuenta sin espacio recibe 403.
- [ ] **Step 2: Correr** `npx vitest run supabase/functions` y `npm run test:security -- search` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** los mismos comandos → PASS. Esperar ~8 s si la función local responde 502 por la recarga.
- [ ] **Step 5: Commit** `fix: búsqueda solo para parejas, OMDb con errores, datos recortados y links más limpios`

### Task 5: Lista y detalle (etapas 2, 3 y 4)

**Files:**
- Modify:
  - `src/features/titles/useTitles.ts`, `TitleList.tsx`, `TitleDetail.tsx`
  - `MyScore.tsx`, `titleText.ts` (si hace falta para la etiqueta)
- Test:
  - `src/features/titles/useTitles.test.ts`, `TitleList.test.tsx`
  - `TitleDetail.test.tsx`, `MyScore.test.tsx`

**Interfaces:**
- Consumes: `useTitles(coupleId)` devuelve `load`.
- Produces:
  - `TitleDetail` recibe la prop `onChanged: () => void`. `TitleList` le pasa `load`. Se llama después de "Quitar", "Marcar como vista", "Volver a Por ver" y "Guardar".
  - En `TitleList`, `remove` también llama `load`.
  - `useTitles` lleva un contador de pedidos (`useRef`). Una respuesta que no es la última pedida se descarta.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `useTitles.test.ts`: dos `load` seguidos donde el primero responde último → queda la lista del segundo.
  - `TitleList.test.tsx`:
    - Con `subscribeTitles` sin disparar, "Quitar" saca el título igual porque `listTitles` se vuelve a pedir.
    - Si el título abierto desaparece, se vuelve a la lista con el aviso `Juli quitó «X» de la lista` (`role="alert"`, con el nombre de quien agregó o "Lo quitaron" si no se sabe) y la lista vuelve a su posición.
  - `TitleDetail.test.tsx`:
    - Un doble toque en "Marcar como vista" manda un solo pedido.
    - Después de marcar se llama `onChanged`.
    - "Reintentar" muestra `Cargando el detalle…` mientras espera.
  - `MyScore.test.tsx`:
    - "Guardado" desaparece al cambiar el puntaje o la nota.
    - Lo que uno está escribiendo se conserva cuando llega un cambio de la pareja (nuevo `score` por props).
    - El aviso de puntaje inválido está en `aria-describedby` del campo.
    - "Guardado" tiene `role="status"`.
  - `TitleList.test.tsx`: la tarjeta se puede encontrar por `getByRole('button', { name: /Ver X/ })` y su nombre accesible incluye `IMDb` y `La agregó`.
- [ ] **Step 2: Correr** `npx vitest run src/features/titles` → FAIL en los nuevos.
- [ ] **Step 3: Implementar.**
  - Banderas `busy` en las acciones del detalle.
  - `setFailed(false)` antes de reintentar.
  - El aviso de título que desapareció vive en `TitleList`: ahí se guarda el último título abierto.
  - Tarjeta: se saca el `aria-label` del botón `.open` y se agrega un `<span className="visually-hidden">Ver </span>` al principio, así el nombre accesible es todo el contenido.
- [ ] **Step 4: Correr** `npx vitest run src/features/titles` → PASS.
- [ ] **Step 5: Commit** `fix: la lista se actualiza sola después de cada cambio y avisa si quitan el título abierto`

### Task 6: Sesión, pareja y modo sin internet (etapas 1, 2 y 11)

**Files:**
- Modify:
  - `src/features/auth/authApi.ts`, `src/features/auth/AuthGate.tsx`
  - `src/features/settings/Settings.tsx`, `src/features/couple/CoupleGate.tsx`
  - `src/lib/offline.ts`, `src/features/titles/useTitles.ts`, `vite.config.ts`
- Test:
  - `src/features/auth/AuthGate.test.tsx`, `src/features/settings/Settings.test.tsx`
  - `src/features/couple/CoupleGate.test.tsx`
  - `src/lib/offline.test.ts`, `src/features/titles/useTitles.test.ts`

**Interfaces:**
- Produces:
  - `signOut()` hace `supabase.auth.signOut({ scope: 'local' })` y después `clearCaches(userId)`.
  - `clearCaches(owner: string): void` en `offline.ts`. Borra lo guardado con dueño: `titles`, `couple`, `shared` y las partidas de un celular. **No** borra los pendientes: se mandan cuando esa cuenta vuelve a entrar.
  - `Pending` suma `attempts: number`. `flushPending` lo incrementa cuando el error no es de red. A los 20 intentos el pendiente pasa a `dropped`, con el aviso que ya existe en `droppedMessage`.
  - Después de un `flushPending` con envíos, `useTitles` mantiene los ítems enviados como `pending` hasta que llega la lista nueva. Así la tarjeta no vuelve a como estaba.
  - `AuthGate`: si `getUser()` responde que no hay sesión (no un error de red), se muestra el ingreso y se olvida `lastAccount`. `useTitles` no guarda una lista vacía si el pedido falló por permisos.
  - `CoupleGate` vuelve a leer el espacio en `visibilitychange` (cuando queda visible) y en `online`.
  - En `vite.config.ts`, la caché de pósters lleva `purgeOnQuotaError: true`.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `Settings.test.tsx`:
    - Si falla `clipboard.writeText`, se ve `No se pudo copiar. Mantené apretado el enlace para copiarlo.`
    - "Cerrar sesión" con `signOut` de red caída igual vuelve al ingreso.
  - `offline.test.ts`:
    - `clearCaches` borra lo de esa cuenta y deja lo de otra y los pendientes.
    - Un pendiente con 20 errores no reconocidos pasa a `dropped`, y el de atrás se manda.
  - `CoupleGate.test.tsx`: al disparar `visibilitychange` con la página visible, se vuelve a pedir el espacio y se ve el nombre nuevo de la pareja.
  - `AuthGate.test.tsx`: con `lastAccount` guardado y `getUser` respondiendo sin sesión, se ve el ingreso.
  - `useTitles.test.ts`: después de mandar un pendiente, el título sigue con `pending` hasta la próxima `listTitles`.
- [ ] **Step 2: Correr** `npx vitest run src/features/auth src/features/settings src/features/couple src/lib src/features/titles/useTitles.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** el mismo comando → PASS.
- [ ] **Step 5: Commit** `fix: cerrar sesión sin internet, pendientes que no se traban y la pareja al día`

### Task 7: Ruleta, filtros y preguntas (etapas 5 y 6)

**Files:**
- Modify:
  - `src/features/choose/wheelMath.ts`, `Wheel.tsx`, `Roulette.tsx`, `QuickQuestions.tsx`, `ChooseMenu.tsx` (o donde se cargan los títulos de "Elegir")
  - `src/features/titles/RangeSlider.tsx`, `FiltersPanel.tsx`, `useBackfillDetails.ts`
  - `src/styles.css`
- Test:
  - `src/features/choose/wheelMath.test.ts`, `Roulette.test.tsx`, `QuickQuestions.test.tsx`
  - `src/features/titles/RangeSlider.test.tsx`, `useBackfillDetails.test.ts`

**Interfaces:**
- Produces:
  - `labelTransform(center: number, rotation: number): string` en `wheelMath.ts`. El volteo se decide con `(center + rotation) mod 360 > 180`. `Wheel` lo usa con su `rotation`.
  - `sliceColor(i: number, n: number, colors: string[]): string` en `wheelMath.ts`. Ningún gajo tiene el mismo color que el de al lado, incluidos el último y el primero. Cuando `n % 6 === 1`, el último toma el color del medio de la paleta.
  - `RangeSlider` llama los extremos `${label} mínima` / `${label} máxima`. Quienes lo usan pasan nombres femeninos: "Duración", "Puntaje de IMDb" pasa a "Nota de IMDb", "Año de estreno" pasa a "Fecha de estreno". El rango nunca se cierra: `low` queda a por lo menos un `step` de `high`.
  - `useBackfillDetails`:
    - Lleva una traba a nivel módulo, así dos montajes no corren a la vez.
    - Se usa también en la pestaña "Elegir".
    - Sigue completando los títulos vistos, porque el director y las temporadas se ven en "Vistas". Se anota en decisiones.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `wheelMath.test.ts`:
    - `labelTransform(90, 180)` sale volteado.
    - `labelTransform(90, 0)` no sale volteado.
    - Para n de 2 a 13, `sliceColor` nunca repite el color con el vecino, incluido el último con el primero.
  - `Roulette.test.tsx`:
    - La región `aria-live` existe antes de girar.
    - Con un filtro activo se ve un solo contador.
  - `RangeSlider.test.tsx`:
    - Los nombres son "Duración mínima" y "Duración máxima".
    - Llevar el mínimo hasta el máximo deja un `step` de diferencia.
  - `useBackfillDetails.test.ts`: dos hooks montados a la vez piden `fetchDetail` una sola vez por título.
  - `QuickQuestions.test.tsx`:
    - Con "Por ver" vacía se ve `No hay títulos en "Por ver". Agreguen alguno desde la lista.`
    - Cada pregunta es un `role="group"` con el nombre de la pregunta.
    - Lo mismo para los grupos de chips de `FiltersPanel` (géneros, plataformas).
- [ ] **Step 2: Correr** `npx vitest run src/features/choose src/features/titles` → FAIL en los nuevos.
- [ ] **Step 3: Implementar.**
  - Sacar `.filters-panel select` y `.roulette-spin` de `styles.css`, después de un `grep` que confirme que nadie los usa.
  - La lista de "No quedan títulos con estos filtros" se actualiza sola porque los modos ya reciben los títulos de `useTitles` con Realtime. Si alguno toma una copia al empezar, se anota por qué se deja.
- [ ] **Step 4: Correr** el mismo comando → PASS.
- [ ] **Step 5: Commit** `fix: rueda legible después de girar, colores sin repetir y rangos que no se cierran`

### Task 8: Juegos (etapas 7, 9 y 10)

**Files:**
- Modify: `src/features/choose/BumbleCard.tsx`, `src/features/choose/Bumble.tsx`, `src/features/choose/Reveal.tsx`, `src/features/choose/TitlePicker.tsx`, `src/features/choose/Tournament.tsx`
- Test: `BumbleCard.test.tsx`, `Bumble.test.tsx`, `Reveal.test.tsx`, `Tournament.test.tsx` (en `src/features/choose`)

**Interfaces:**
- Produces:
  - Carta de Bumble:
    - `aria-label` = `` `${title} — ver sinopsis` `` / `` `${title} — volver al frente` ``.
    - La barra espaciadora hace `preventDefault`.
  - Ganadora de Bumble: se muestra con la carta grande (`BumbleCard` sin votos) y el botón "Ver detalle", que abre `TitleDetail` y vuelve a la ganadora.
  - En "Cambiar mi elección", `TitlePicker` saca de lo marcado los títulos que ya no están en "Por ver". "Listo" está deshabilitado si no hay ningún título disponible.
  - La ganadora del torneo es un `<div className="duel-card winner">`, no un botón.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `BumbleCard.test.tsx`:
    - `getByRole('button', { name: /Matrix — ver sinopsis/ })`.
    - Un `keydown` de espacio tiene `defaultPrevented`.
  - `Bumble.test.tsx`: la ganadora muestra "Ver detalle". Tocarlo muestra el detalle, y "Volver" vuelve a la ganadora.
  - `Reveal.test.tsx`:
    - Con una elección guardada que incluye un título ya visto, "Cambiar mi elección" lo muestra sin marcar, y "Listo" manda solo los que quedan.
    - Con filtros sin títulos, "Listo" está deshabilitado.
  - `Tournament.test.tsx`: la ganadora no tiene `role="button"`.
- [ ] **Step 2: Correr** `npx vitest run src/features/choose` → FAIL en los nuevos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** `npx vitest run src/features/choose` → PASS. Revisar a 390×844 y 393×852 que la ganadora grande de Bumble entra sin scroll.
- [ ] **Step 5: Commit** `fix: cartas que dicen qué título son y ganadoras con detalle`

### Task 9: Compartidos (etapa 8)

**Files:**
- Modify: `src/features/shared/ShareShortcut.tsx`, `src/features/shared/SharedInbox.tsx`, `src/features/shared/useShared.ts`
- Test: `src/features/shared/ShareShortcut.test.tsx`, `src/features/shared/SharedInbox.test.tsx`

**Interfaces:**
- Produces:
  - `ShareShortcut`: si falla leer la fecha de la clave, se ve `No se pudo ver tu clave.` con "Reintentar", y no aparece "Crear mi clave".
  - `useShared` devuelve también `remove(id: string): void`. Saca el ítem de la lista local. `SharedInbox` recibe `onDismissed(id)` y lo llama después de descartar bien.

- [ ] **Step 1: Escribir los tests que fallan.**
  - `ShareShortcut.test.tsx`: con `shareKeyCreatedAt` rechazado se ve "Reintentar" y no "Crear mi clave". "Reintentar" vuelve a pedir la fecha.
  - `SharedInbox.test.tsx`: con Realtime sin disparar, "Descartar" saca el ítem de la pantalla.
- [ ] **Step 2: Correr** `npx vitest run src/features/shared` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** `npx vitest run src/features/shared` → PASS.
- [ ] **Step 5: Commit** `fix: la clave del Atajo no se pisa por un error de red y descartar se ve al toque`

### Task 10: Notas, decisiones y cierre

**Files:**
- Modify: `docs/superpowers/notes/2026-10-decisiones.md`, `docs/superpowers/notes/2026-10-verificacion-fuentes.md`, `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`

- [ ] **Step 1: Agregar la sección "Etapa 12 (2026-10-09)" a las decisiones, con los puntos que se dejan y por qué.**
  - **`bumble_undo` sin revisar la vuelta en la base:** las vueltas se calculan en el celular con los votos, así que la base no sabe cuándo terminó una. Al final queda coherente. Revisarlo pide guardar las vueltas en la base, que es una función nueva.
  - **"Listo" antes de que el otro gire en la ruleta de desempate:** mostrar la última partida es una función nueva y el caso es raro.
  - **Animación de salida de la carta:** es una función nueva.
  - **OMDb consultado dos veces al agregar y abrir enseguida:** cuesta una consulta de 1000 por día. Evitarlo pide coordinar las dos llamadas.
  - **Un título dos veces en Compartidos** si la app se cierra justo entre mandarlo y borrarlo de la cola: se descarta a mano. Evitarlo pide un id del lado del celular.
  - **El completado sigue con los vistos:** el director y las temporadas se ven en "Vistas".
  - **Los demás puntos que se dejen durante la ejecución.**
- [ ] **Step 2: Anotar en `2026-10-verificacion-fuentes.md`:**
  - El SMTP de Gmail y las plantillas con `{{ .Token }}`.
  - Que el hosting es Cloudflare Workers, no Netlify, con los límites del plan gratis.
  - La regla de pausa de Supabase: un proyecto gratis se pausa después de 7 días sin actividad. Confirmarlo en el panel con Tomás.
- [ ] **Step 3: En la spec, marcar como hechos** jugar con un solo celular y el botón de comentarios, y agregar el buscador de la lista.
- [ ] **Step 4: Correr todo:** `npx vitest run`, `npx tsc -b`, `npx oxlint` y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `docs: decisiones y notas de la etapa 12`

### Después de las tareas (proceso de siempre)

1. Revisión visual a 390×844 y 393×852: el buscador, Ajustes con los comentarios, la ganadora de Bumble y la rueda después de girar.
2. Tomás corre `npx supabase db push`. Hay dos migraciones nuevas.
3. Despliego las funciones:
   - `npx supabase functions deploy tmdb-search --use-api --no-verify-jwt`
   - `npx supabase functions deploy share --use-api --no-verify-jwt`
   - `npx supabase functions deploy title-detail --use-api`
4. `npm run test:security:remote`, y vuelvo a correr los que choquen con el límite de pedidos unos 8 minutos después.
5. `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null`, y reviso que el bundle publicado sea el nuevo.
6. Revisión final con opus, arreglo de lo Importante y merge a `main`.
