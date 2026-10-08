# Pelis By Pili — Etapa 11 (Agregar y calificar sin internet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sin internet la app abre con la última lista guardada; se puede marcar como vista, poner el puntaje y anotar títulos para agregar. Todo queda en el celular y se manda solo al volver la conexión; lo anotado aparece en "📥 Compartidos" de los dos.

**Architecture:**
- **Lo último visto queda en el celular** (`localStorage`): la sesión (solo el id de la cuenta), la pareja y la lista de títulos. Al abrir sin red, los "portones" (sesión y pareja) y la lista usan eso en vez de mostrar "Sin conexión".
- **Cola de pendientes** (`localStorage`): marcar vista, puntaje y "agregar después". Se aplican al momento sobre la lista guardada (se ven con ⏳) y se mandan en orden al volver la conexión (evento `online`, volver la app al frente o una carga que sale bien).
- **"Agregar después" va a la bandeja de la etapa 8** con una función nueva para la persona con sesión (`add_shared_item`): al sincronizar aparece en "📥 Compartidos" de los dos, y desde ahí "Agregar" busca el título correcto. (Elegido por Nacho el 2026-10-08.)
- **La app abre sin red** gracias al service worker que ya existe (vite-plugin-pwa); se suma guardar los pósters ya vistos.

**Tech Stack:** lo de las etapas anteriores. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 9, 12 y Etapa 11). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; textos exactos en cada tarea.
- Nada nuevo en el celular que no sea de la cuenta que lo guardó: todo lo guardado va con el id de la cuenta y de la pareja, y si no coincide no se usa.
- La función nueva de la base sigue las reglas de siempre (`security definer`, `search_path = ''`, solo miembros, mismos límites y tope de 100 que la bandeja).
- Pantallas que entran en iPhone 13 (390×844) y 15 (393×852) (spec, sección 12).
- Alcance estricto. **No entra:** nada fuera de la carga y la calificación sin conexión (ni quitar títulos, ni Bumble o Top 3 secreto con dos celulares, ni buscar en TMDB sin red).
- Cada decisión fuera del plan va a `docs/superpowers/notes/2026-10-decisiones.md`; los menores de la revisión final, a la Etapa 12.
- **Decisiones** (1 y 2 confirmadas por Nacho el 2026-10-08; el resto, a confirmar):
  1. **Agregar sin internet** = anotar el nombre (y "de dónde vino"); al volver la conexión va a "📥 Compartidos" de los dos, y desde ahí "Agregar" busca el título.
  2. **Sin internet se ve la última lista** (Por ver, Vistas, detalle con lo guardado) y se puede **marcar como vista y puntuar**. Los modos de un celular (Ruleta, Preguntas rápidas, Bumble, Top 3 secreto y Torneo con un celular) también andan con la lista guardada.
  3. **Lo pendiente se ve al instante con ⏳** (en la tarjeta y en el detalle) y arriba de la lista un aviso: "Sin conexión. Lo que hagas se guarda cuando vuelva la conexión (n pendientes)".
  4. **Si algo pendiente no se puede guardar al volver** (por ejemplo, la pareja quitó ese título), se descarta y aparece "No se pudo guardar un cambio: ese título ya no está en la lista" (o el motivo que corresponda). Los errores de red no descartan: se reintenta.
  5. **Los pósters ya vistos quedan en el celular** (hasta 300) para verse sin red.
  6. **Al abrir sin red con la sesión vencida**, se entra igual con la última cuenta que se usó en ese celular; la sesión se renueva sola al volver la conexión.

## Review Focus

1. **Abrir la app en modo avión** después de haberla usado: entra directo a la lista guardada, sin pasar por "Sin conexión" ni por el inicio de sesión. Probado en las Tasks 3 y 4.
2. **Marcar vista y puntuar el mismo título sin red:** al volver se mandan en ese orden y el puntaje queda guardado. Probado en las Tasks 2 y 4.
3. **Volver la conexión a mitad de una sincronización, o dos sincronizaciones a la vez** (evento `online` y app al frente juntos): cada pendiente se manda una sola vez. Probado en la Task 2.
4. **Un pendiente que ya no aplica** (título quitado por la pareja, puntaje de un título que la pareja desmarcó como visto): se descarta con su aviso y no traba los demás. Probado en las Tasks 2 y 4.
5. **Otra cuenta en el mismo celular** (o la misma cuenta en otra pareja): no ve la lista ni los pendientes de la anterior. Probado en las Tasks 2 y 3.

---

### Task 1: Agregar a la bandeja con sesión

**Files:**
- Create: `supabase/migrations/20261015000000_add_shared_item.sql`
- Modify: `tests/security/shared.test.ts`

**Interfaces:**
- Produces: `add_shared_item(p_query text, p_body text) returns uuid` (`security definer`): `no_couple` sin espacio; recorta los dos textos (vacío = nulo); `invalid_item` si quedan los dos vacíos o pasan los largos de `shared_items` (100 y 500); `inbox_full` con 100 ítems en la bandeja de la pareja; guarda con `shared_by = auth.uid()`, sin link ni origen, y devuelve el id.
- [ ] **Step 1: Write the failing tests:** Pili agrega "Dark" con una nota y Nacho lo lee en la bandeja con `shared_by` Pili; vacío da `invalid_item`; 101 letras en el nombre, `invalid_item`; sin espacio, `no_couple`; anónimo, error; con 100 ítems, `inbox_full`; el `INSERT` llega a la pareja por Realtime (como el test de la etapa 8).
- [ ] **Step 2: Run** → FAIL. **Step 3: Write the migration.** **Step 4: Run** `npx supabase migration up` y `npm run test:security` → PASS.
- [ ] **Step 5: Commit** `feat: agregar a la bandeja con sesión`

### Task 2: Guardado local y cola de pendientes

**Files:**
- Create: `src/lib/offline.ts`, `src/lib/offline.test.ts`

**Interfaces:**
- Produces:
  - `saveCache<T>(key: string, owner: string, value: T): void` y `readCache<T>(key: string, owner: string): T | null`: guardan `{ owner, value }` en `localStorage` (`pelis-cache:<key>`), en `try/catch`; `readCache` devuelve `null` si el dueño no coincide o el contenido no es válido JSON.
  - `export type Pending = { id: string; kind: 'watched'; titleId: string; watched: boolean } | { id: string; kind: 'score'; titleId: string; score: number; note: string } | { id: string; kind: 'later'; query: string; note: string }`
  - `enqueue(owner: string, item: Omit<Pending, 'id'>): Pending`, `pendingFor(owner: string): Pending[]`, `subscribePending(cb: () => void): () => void` (avisa en cada cambio de la cola).
  - `flushPending(owner: string, send: (item: Pending) => Promise<void>, isNetwork: (e: unknown) => boolean): Promise<{ sent: number; dropped: { item: Pending; error: unknown }[] }>`: manda en orden; un error de red corta (queda todo lo que falta); otro error descarta ese y sigue; dos llamadas a la vez no mandan nada dos veces (la segunda espera a la primera).
  - `applyPending(titles: Title[], pending: Pending[]): (Title & { pending?: boolean })[]`: marca vista/no vista y pone o reemplaza el puntaje propio (`userId` del dueño) con `pending: true`.
- [ ] **Step 1: Write the failing tests:** guardar y leer con dueño; otro dueño lee `null`; JSON roto, `null`; la cola mantiene el orden y avisa a los suscriptos; `flushPending` manda en orden y vacía; un error de red deja el resto; un error que no es de red descarta ese y devuelve `dropped`; dos `flushPending` a la vez mandan cada uno una vez; `applyPending` aplica vista y puntaje con `pending`; la cola de otra cuenta no se ve.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: guardado local y cola de pendientes`

### Task 3: Abrir sin red

**Files:**
- Modify: `src/features/auth/AuthGate.tsx` (+ test), `src/features/couple/CoupleGate.tsx` (+ test), `vite.config.ts`

- `AuthGate`: con sesión, guarda `{ userId }` en el caché (`session`, dueño `device`). Si `getSession` falla por red y hay una cuenta guardada, entra con una sesión mínima (`{ user: { id } }`) en vez de "Sin conexión"; cuando `onAuthChange` trae la sesión real, la reemplaza.
- `CoupleGate`: guarda la pareja con dueño = id de la cuenta; si `getMyCouple` falla por red y hay pareja guardada de esa cuenta, la usa.
- `vite.config.ts`: confirmar que la app abre sin red (`navigateFallback` a `index.html`) y sumar `runtimeCaching` para `https://image.tmdb.org/` con `CacheFirst`, `maxEntries: 300`.
- [ ] **Step 1: Write the failing tests:** sin red y con cuenta guardada, `AuthGate` muestra la app; sin red y sin cuenta guardada, "Sin conexión"; `CoupleGate` sin red usa la pareja guardada de esa cuenta y no la de otra.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run typecheck && npm run build` → PASS (y en `dist/sw.js` aparecen el `navigateFallback` y la regla de `image.tmdb.org`).
- [ ] **Step 5: Commit** `feat: la app abre sin red con lo último guardado`

### Task 4: Lista, vista y puntaje sin red

**Files:**
- Modify: `src/features/titles/useTitles.ts`, `src/features/titles/titlesApi.ts` (`isNetworkError`), `src/features/titles/TitleList.tsx` (+ test), `src/features/titles/TitleDetail.tsx` (+ test), `src/features/titles/MyScore.tsx` (+ test), `src/app/styles.css`

- `useTitles`: guarda cada lista cargada (dueño = `coupleId`); sin red usa la guardada (`offline: true` igual) y devuelve la lista con los pendientes aplicados; se vuelve a calcular cuando cambia la cola. Al cargar bien, al evento `online` y al volver al frente, llama a `flushPending` con `setWatched`/`setMyScore`/`add_shared_item` y recarga; los descartados quedan en `dropped` (para el aviso).
- `TitleList`: sin red y con lista guardada, arriba: "Sin conexión. Lo que hagas se guarda cuando vuelva la conexión" y, si hay, "(n pendientes)"; las tarjetas con algo pendiente muestran "⏳". El aviso de descartados: "No se pudo guardar un cambio: ese título ya no está en la lista" (o "…: para puntuar, primero tiene que estar vista"), con "Entendido".
- `TitleDetail` / `MyScore`: si `setWatched` o `setMyScore` fallan por red, se encolan y se muestra "⏳ Se guarda cuando vuelva la conexión" en vez del error.
- [ ] **Step 1: Write the failing tests:** sin red, la lista guardada con el aviso; marcar vista sin red la deja en Vistas con ⏳ y "1 pendiente"; puntuar sin red muestra el puntaje con ⏳; al volver (`online`) se mandan en orden (vista y después puntaje) y desaparece el aviso; un descartado muestra su aviso; otra pareja no ve la lista guardada.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat: lista, vista y puntaje sin internet`

### Task 5: Anotar para agregar después

**Files:**
- Modify: `src/features/titles/AddTitle.tsx` (+ test), spec (secciones 9 y Etapa 11)

- Sin red (búsqueda que falla por red o `navigator.onLine === false`), Agregar muestra "Sin conexión: no se puede buscar ahora." y el botón "Guardar para agregar después" (con el nombre escrito y "¿De dónde vino?"); al tocarlo encola `later`, muestra "⏳ Guardado. Va a aparecer en Compartidos cuando vuelva la conexión" y limpia los campos.
- [ ] **Step 1: Write the failing tests:** sin red aparece el botón; tocarlo encola `later` con nombre y nota; con el nombre vacío está deshabilitado; al sincronizar se llama a `add_shared_item` con esos textos.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y actualizar la spec (sección 9: "Sin conexión": lo que funciona y cómo se sincroniza).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local a 390×844, simulando sin red (`navigator.onLine` falso y el Supabase local parado): abrir, ver la lista, marcar, puntuar, anotar; volver a levantarlo y ver que se sincroniza y que lo anotado aparece en Compartidos.
- [ ] **Step 6: Commit** `feat: anotar títulos sin internet`

### Task 6: Publicación y aceptación

- [ ] **Step 1:** `npm test && npm run test:security && npm run typecheck`.
- [ ] **Step 2 (Nacho):** `npx supabase db push`; después una corrida de `npm run test:security:remote` (repetir a los minutos los archivos que corte el límite de Auth).
- [ ] **Step 3:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar el bundle publicado.
- [ ] **Step 4: Prueba de aceptación** (Nacho y Pili de prueba): con la app ya abierta una vez, modo avión; abrirla desde la pantalla de inicio; marcar una como vista, puntuarla y anotar un título; sacar el modo avión; en el otro celular aparece lo anotado en Compartidos y la peli como vista con su puntaje.
- [ ] **Step 5: Commit** `docs: cierre de la Etapa 11`

**Cierre de la Etapa 11:** se agrega un título en modo avión y aparece en el otro celular al reconectar. **No entra:** nada fuera de la carga y la calificación sin conexión.
