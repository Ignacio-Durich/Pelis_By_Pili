# Pelis By Pili — Etapa 4 (Vistas y puntaje propio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Nacho o Pili marquen un título como visto (y lo puedan deshacer), que la lista tenga las pestañas "Por ver" y "Vistas", y que cada uno ponga su propio puntaje con una nota corta y vea el del otro.

**Architecture:**
- `titles` suma `status` y `watched_at`.
- Una tabla nueva, `title_scores`, guarda una fila por persona y título, con el `couple_id` copiado para filtrar Realtime y aplicar RLS sin joins.
- Como en la etapa 1, las escrituras pasan por funciones SQL `security definer`:
  - `set_watched` marca o desmarca, con la hora del servidor.
  - `set_my_score` guarda o cambia el puntaje propio de quien llama.
- El cliente no recibe permisos de escritura nuevos.
- La lista trae los puntajes en la misma consulta (embedding de PostgREST) y se recarga con los cambios de `title_scores` por Realtime.

**Tech Stack:** lo de las etapas anteriores (Vite, React, TypeScript, Vitest, Supabase con Realtime, Supabase local en Docker). Sin dependencias nuevas ni funciones Edge nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 5, 7, 9 y Etapa 4). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Solo los miembros del espacio marcan, desmarcan, puntúan o leen puntajes de sus títulos.
- Cada persona solo puede escribir su propio puntaje.
- Nadie ajeno ve nada, ni por consulta ni por Realtime.
- Interfaz en español rioplatense; los textos exactos están en cada tarea. Sin internet no se puede calificar (spec, sección 9).
- Alcance estricto. **No entra:** ningún modo para elegir qué ver, filtros ni lista sin conexión.
- Cada decisión fuera de este plan se anota en `docs/superpowers/notes/2026-10-decisiones.md`. Los puntos menores de la revisión final van a la Etapa 12 de la spec.
- Decisiones de este plan a confirmar con Nacho (la spec no las fija):
  - **Escala de 1 a 10, en números enteros:** se elige tocando un número. Es comparable con IMDb.
  - **Solo se puntúa lo que ya vieron.** Antes de marcarla vista, el detalle dice cómo hacerlo.
  - **"Marcar como vista" vale para los dos:** la lista es de los dos y se ve junta.
    - La fecha es el día en que se marca, sin elegir otra.
    - Se puede deshacer con "Volver a Por ver". Los puntajes se conservan y reaparecen si se vuelve a marcar.
  - **La nota del puntaje tiene hasta 200 caracteres**, igual que la nota de origen.
  - **La tarjeta de "Vistas"** muestra la fecha y los dos puntajes ("Nacho 8 · Pili —").

## Review Focus

Entradas o fallas que la spec implica y que más pueden molestar, de la más a la menos probable:

1. **Cambiar el puntaje propio después:** se actualiza la misma fila, sin duplicar, y al otro le llega el valor nuevo sin recargar. Probado en las Tasks 1 y 3.
2. **Se marcó vista por error:** "Volver a Por ver" la devuelve a la lista. Los puntajes no se pierden y vuelven a verse si se marca de nuevo. Probado en las Tasks 1 y 3.
3. **Guardar el puntaje sin conexión:** aparece "No se pudo guardar. Probá de nuevo." y el número elegido y la nota siguen en pantalla para reintentar. Probado en la Task 3.
4. **Los dos puntúan a la vez, o uno puntúa mientras el otro mira el detalle:** cada uno ve los dos puntajes actualizados, y ninguno puede pisar el del otro. Probado en las Tasks 1 y 3.
5. **El otro quita el título mientras uno lo está puntuando:** el guardado falla con "Este título ya no está en la lista" en vez de un error genérico. Probado en las Tasks 1 y 3.

---

### Task 1: Base de datos de vistas y puntajes

**Files:**
- Create: `supabase/migrations/20261009000000_watched_and_scores.sql`
- Test: `tests/security/scores.test.ts`

**Interfaces:**
- Consumes: `titles`, `is_member` y los helpers de `tests/security/helpers.ts` (`createTestUser`, `createCouple`, `adminClient`, `anonClient`, `cleanup`).
- Produces (SQL):
  - **En `titles`:**
    - Columnas `status text not null default 'to_watch' check (status in ('to_watch', 'watched'))` y `watched_at timestamptz`.
    - Check `(status = 'watched') = (watched_at is not null)`.
  - **Tabla `title_scores`:**
    - `title_id uuid not null`, referencia a `titles` con `on delete cascade`.
    - `couple_id uuid not null`, referencia a `couples` con `on delete cascade`.
    - `user_id uuid not null`, referencia a `auth.users` con `on delete cascade`.
    - `score smallint not null`, check entre 1 y 10.
    - `note text`, check largo ≤ 200.
    - `updated_at timestamptz not null default now()`.
    - `primary key (title_id, user_id)`.
    - RLS: solo `select` para `authenticated` con `is_member(couple_id)`.
    - Permisos: `revoke all` a `anon` y `authenticated`, `grant select` a `authenticated` y `grant all` a `service_role`.
    - Publicada en `supabase_realtime`.
  - **`set_watched(p_title_id uuid, p_watched boolean) returns void`:**
    - `security definer` con `set search_path = ''`, ejecutable solo por `authenticated`.
    - Si el título no existe o no es del espacio de quien llama, lanza `not_found`.
    - Con `true`: `status = 'watched'`, `watched_at = now()`. Con `false`: `status = 'to_watch'`, `watched_at = null`.
    - Volver a marcar un título que ya estaba visto no cambia la fecha.
  - **`set_my_score(p_title_id uuid, p_score smallint, p_note text) returns void`:**
    - Mismo encabezado de seguridad.
    - Validaciones, en este orden:
      1. Si el puntaje no está entre 1 y 10, lanza `invalid_score`.
      2. La nota se recorta y, si queda vacía, pasa a `null`. Si tiene más de 200 caracteres, lanza `invalid_note`.
      3. Si el título no existe o no es del espacio de quien llama, lanza `not_found`.
      4. Si el título no está visto, lanza `not_watched`.
    - Hace upsert sobre `(p_title_id, auth.uid())` con el `couple_id` del título y `updated_at = now()`.

- [ ] **Step 1: Escribir los tests de seguridad que fallan**

En `tests/security/scores.test.ts`: A y B comparten un espacio, C tiene uno propio, y `afterAll(cleanup)`. A agrega un título T con un `insert` directo.
- `marking as watched is shared and can be undone`:
  - A llama a `set_watched(T, true)`. B lee T con `status = 'watched'` y `watched_at` no nulo.
  - B llama a `set_watched(T, false)`. Queda `to_watch` con `watched_at` nulo.
  - Si A marca dos veces seguidas, la fecha de la primera no cambia.
- `outsiders cannot mark or read`:
  - C llama a `set_watched(T, true)` y recibe `not_found`; T no cambia.
  - C no ve filas de `title_scores` de ese espacio.
- `no direct writes`:
  - Un `update` directo de `status` en `titles` hecho por A falla.
  - Un `insert`, un `update` y un `delete` directos en `title_scores` hechos por A también fallan.
- `scoring needs the title to be watched`: `set_my_score(T, 8, null)` con T sin ver → `not_watched`.
- `each one scores separately and sees the other`:
  - Con T visto, A guarda `(8, '  Buenísima ')` y B guarda `(6, '')`.
  - Los dos leen dos filas: la de A con `note = 'Buenísima'` y la de B con `note = null`.
  - A cambia a 9: sigue habiendo una sola fila de A, con 9, y la de B sigue en 6.
- `invalid scores and notes are rejected`: 0 y 11 → `invalid_score`; una nota de 201 caracteres → `invalid_note`.
- `scores survive undoing watched and disappear with the title`:
  - `set_watched(T, false)` deja las filas de `title_scores`.
  - Borrar T, con A y un `delete` directo, las borra.
- `the partner receives score changes in realtime and an outsider does not`:
  - B y C se suscriben a `INSERT` y `UPDATE` de `title_scores` con filtro `couple_id=eq.<espacio de A>`, y esperan el aviso de sistema `ok`.
  - A guarda un puntaje: B lo recibe en menos de 10 s. 3 s después, C no recibió nada.
- `a title removed while scoring gives not_found`: A borra T2 (visto) y B llama a `set_my_score(T2, 7, null)` → `not_found`.
- `anonymous clients cannot call the functions`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm run test:security -- tests/security/scores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir la migración, aplicarla en local y verificar**

Run: `npx supabase db reset && npm run test:security`
Expected: PASS en todos. Después del reset, reiniciar el stack (`npx supabase stop && npx supabase start`) si se va a entrar a la app en local, por las plantillas de email (ver las decisiones de la etapa 3).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations tests/security && git commit -m "feat: vistas y puntajes propios en la base"
```

### Task 2: Vistas y puntajes en el cliente

**Files:**
- Modify: `src/features/titles/titlesApi.ts`
- Test: tests nuevos en `src/features/titles/titlesApi.test.ts`

**Interfaces:**
- Consumes: `set_watched`, `set_my_score` y la tabla `title_scores` (Task 1).
- Produces, en `titlesApi.ts`:
  - **`Title` suma:**
    - `status: 'to_watch' | 'watched'`
    - `watchedAt: string | null`
    - `scores: Score[]`, con `export type Score = { userId: string; score: number; note: string | null; updatedAt: string }`.
  - **`listTitles`:** pide `select('*, title_scores(user_id, score, note, updated_at)')`, mapea los puntajes y sigue ordenando por `created_at` de más nuevo a más viejo. El orden de "Vistas" lo resuelve la pantalla.
  - **`TitleErrorKind`** suma `'not_found' | 'not_watched' | 'invalid_score' | 'invalid_note'`.
  - **`setWatched(titleId: string, watched: boolean): Promise<void>`:** usa la RPC `set_watched`.
  - **`setMyScore(titleId: string, score: number, note: string): Promise<void>`:** usa la RPC `set_my_score`.
  - Las dos funciones toman el tipo de error del mensaje de Postgres, como `coupleApi`. Cualquier otro error es `network`.
  - **`subscribeTitles`** suma escuchas de `INSERT` y `UPDATE` en `public.title_scores` con filtro `couple_id=eq.<coupleId>`, que llaman a `onChange`.

- [ ] **Step 1: Escribir los tests que fallan** (cliente simulado)

- **`listTitles`:**
  - Pide el `select` con el embedding de `title_scores`.
  - Mapea `status`, `watched_at` y `title_scores` a `status`, `watchedAt` y `scores` (con `userId`, `score`, `note` y `updatedAt`).
- **`setWatched('t1', true)`** llama a `rpc('set_watched', { p_title_id: 't1', p_watched: true })`.
- **`setMyScore('t1', 8, 'buena')`** llama a `rpc('set_my_score', { p_title_id: 't1', p_score: 8, p_note: 'buena' })`.
- **Errores:** `not_found`, `not_watched`, `invalid_score` e `invalid_note` conservan su tipo; un mensaje desconocido es `network`.
- **`subscribeTitles`:** registra `INSERT` y `UPDATE` de `title_scores` con el filtro del espacio, y los dos llaman a `onChange`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/titles/titlesApi`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Además, sumar los campos nuevos a los títulos de ejemplo de los tests existentes (`TitleList.test.tsx`, `AddTitle.test.tsx` y `TitleDetail.test.tsx`), para que el typecheck pase.

Run: `npm test && npm run typecheck && npx oxlint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: vistas y puntajes en el cliente"
```

### Task 3: Pestañas, marcar vista y puntaje propio en pantalla

**Files:**
- Create: `src/features/titles/MyScore.tsx`
- Modify: `src/features/titles/TitleList.tsx`, `src/features/titles/TitleDetail.tsx`, `src/app/styles.css`
- Test: `src/features/titles/MyScore.test.tsx`; tests nuevos en `TitleList.test.tsx` y `TitleDetail.test.tsx`

**Interfaces:**
- Consumes:
  - De la Task 2: `setWatched`, `setMyScore`, `Title`, `Score` y `TitleError`.
  - De etapas anteriores: `useUserId`, `useCouple` (con `members`), `useMemberName` y `ratingsDate`.
- Produces: `MyScore(props: { titleId: string; current: Score | null }): JSX.Element`.

- [ ] **Step 1: Escribir los tests que fallan** (APIs simuladas)

- **`TitleList`:**
  - Arriba hay dos botones, "Por ver" y "Vistas" (`aria-pressed`). El encabezado `h2` dice el nombre de la pestaña elegida.
  - "Por ver" muestra solo los `to_watch`, como hoy. "Vistas" muestra solo los `watched`, del más reciente al más viejo según `watchedAt`.
  - Una tarjeta de "Vistas" dice "Vista el 7/10/2026" y "Nacho 8 · Pili —": los nombres van en el orden de `members` y "—" marca a quien no puntuó.
  - "Vistas" sin títulos dice "Todavía no vieron nada juntos".
  - El botón "+" está solo en "Por ver".
- **`TitleDetail`**, con un título `to_watch`:
  - Muestra el botón "Marcar como vista", que llama a `setWatched(id, true)`.
  - Muestra el texto "Márquenla como vista para puntuarla." y no muestra `MyScore`.
- **`TitleDetail`**, con un título `watched`:
  - Dice "Vista el 7/10/2026".
  - El botón "Volver a Por ver" llama a `setWatched(id, false)`.
  - Encabezado "Nuestros puntajes", con una fila por miembro: "Pili: 6" y su nota si tiene, o "Pili: todavía no puntuó".
  - `MyScore` recibe el puntaje propio, o `null` si no hay.
  - Si `setWatched` falla, muestra "No se pudo guardar. Probá de nuevo.".
- **`MyScore`:**
  - Encabezado "Tu puntaje".
  - Diez botones del 1 al 10 (`role="radio"`, `aria-checked` en el elegido), dentro de un `role="radiogroup"` con nombre "Tu puntaje".
  - Campo "Una nota (opcional)", con `maxLength` 200.
  - Botón "Guardar": deshabilitado sin número elegido o mientras guarda. Llama a `setMyScore(titleId, número, nota)`.
  - Con `current` arranca con ese número y esa nota.
  - Al guardar bien muestra "Guardado".
  - Errores:
    - `network` → "No se pudo guardar. Probá de nuevo.", y el número y la nota siguen en pantalla.
    - `not_found` → "Este título ya no está en la lista".
    - `not_watched` → "Márquenla como vista para puntuarla.".

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar y verificar**

Los botones del 1 al 10 entran en una fila de 390 px (32 px cada uno, separados 4 px). Después de marcar, desmarcar o guardar, la pantalla se actualiza sola por Realtime: el detalle recibe el `Title` actualizado de la lista.

Run: `npm test && npm run typecheck && npx oxlint && npm run build`
Expected: PASS.

- [ ] **Step 4: Revisión visual en local**

Run: `npx vite --mode test` contra el Supabase local, con el stack reiniciado después del último `db reset`.
1. Entrar con un usuario de prueba y agregar un título.
2. Marcarlo como visto: pasa a "Vistas".
3. Puntuarlo y volver a la lista: la tarjeta muestra el puntaje.
4. Desmarcarlo: vuelve a "Por ver".

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: pestañas Por ver y Vistas, marcar vista y puntaje propio"
```

### Task 4: Publicación y aceptación en los dos iPhones

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-10-verificacion-fuentes.md`: sección "Cierre de la Etapa 4".
  - `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`: los puntos menores de la revisión van a la Etapa 12.

- [ ] **Step 1: Migración en el proyecto real (Nacho, en su terminal) y suite completa**

Run: `npx supabase db push`; después, `npm test`, `npm run test:security`, una sola corrida de `npm run test:security:remote`, `npm run typecheck` y `npm run build`.
Expected: todo en verde.

- [ ] **Step 2: Publicar**

Antes de publicar, revisar que `dist/` no contenga claves secretas ni `127.0.0.1:54321`.

Run: `npx netlify-cli deploy --prod --no-build --dir=dist`
Expected: `HTTP/2 200`, y el bundle publicado es el mismo que el local.

- [ ] **Step 3: Prueba de aceptación con Nacho y Pili**

1. Nacho marca como vista una película: pasa a "Vistas" en los dos iPhones, con la fecha.
2. Nacho le pone 8 con una nota, y Pili le pone 6 desde su iPhone. Cada uno ve los dos puntajes en el detalle y en la tarjeta de "Vistas", sin recargar.
3. Pili cambia su puntaje a 7, y a Nacho le aparece el 7.
4. Uno la vuelve a "Por ver" y después la marca de nuevo: los puntajes siguen ahí.

Anotar el resultado en las notas.

- [ ] **Step 4: Commit**

```bash
git add docs && git commit -m "docs: cierre de la Etapa 4"
```

**Cierre de la Etapa 4:** cada uno califica por separado y ve el puntaje del otro. **No entra** (no adelantar): modos para elegir qué ver, filtros y lista sin conexión.
