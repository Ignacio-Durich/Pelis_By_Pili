# Pelis By Pili — Etapa 8 (Compartir desde otras apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde un reel (o cualquier link o texto) de otra app, "Compartir → Pelis By Pili" lo guarda en una bandeja de la pareja sin salir de esa app; en la lista aparece "📥 Compartidos" y un toque abre la búsqueda ya hecha, con el link como "de dónde vino".

**Architecture:**
- **Por qué una bandeja:** iOS no deja que una app web instalada aparezca en el menú Compartir (WebKit no soporta `share_target`), y un Atajo que abre un link lo abre en Safari, que tiene la sesión aparte de la app instalada. Por eso el Atajo no abre la app: manda lo compartido a una función del servidor con una **clave personal**, y la app lo muestra en la bandeja. (Elegido por Nacho el 2026-10-08.)
- **Base:** `share_keys` (el hash de la clave de cada uno; nadie la lee desde la app) y `shared_items` (la bandeja de la pareja, en Realtime). La clave se crea con una función `security definer` que la devuelve una sola vez.
- **Función `share`** (Edge Function, sin sesión): recibe la clave en el encabezado `x-share-key` y lo compartido; busca la clave por su hash y guarda el ítem con la clave de servicio.
- **App:** en Ajustes, "Atajo para compartir" con la clave y la guía para armar el Atajo; en la Lista, la bandeja; "Agregar" se abre con la búsqueda y la nota ya cargadas.

**Tech Stack:** lo de las etapas anteriores (Postgres con `pgcrypto` en `extensions`, Edge Functions en Deno, React). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 3, 7 y Etapa 8). Notas: `docs/superpowers/notes/2026-10-decisiones.md`.

## Global Constraints

- Interfaz en español rioplatense; textos exactos en cada tarea.
- La clave nunca se guarda en texto plano: solo su hash SHA-256 (hex). Se muestra una sola vez al crearla; crear otra invalida la anterior. Nunca va en la URL (los registros de las funciones guardan la URL), solo en el encabezado `x-share-key`.
- Nadie ajeno a la pareja lee ni borra ítems de su bandeja. Los ítems solo se crean desde la función `share`. Claves primarias al azar (Realtime manda la clave de las filas borradas a cualquiera).
- Pantallas que entran sin scroll en iPhone 13 (390×844) y 15 (393×852) (spec, sección 12).
- Alcance estricto. **No entra:** revelación simultánea, torneo, modo sin internet; tampoco leer el nombre de la peli del video o del texto del post (el nombre lo escribe la persona en el Atajo, o después en la búsqueda).
- Cada decisión fuera del plan va a `docs/superpowers/notes/2026-10-decisiones.md`; los menores de la revisión final, a la Etapa 12.
- **Decisiones confirmadas por Nacho el 2026-10-08:**
  1. **El Atajo** recibe "URLs y texto" del menú Compartir, pregunta "¿Qué peli o serie es? (opcional)" y lo manda; termina con la notificación "Guardado en Pelis By Pili". Son 3 toques: Compartir, Pelis By Pili, Listo.
  2. **Una clave por persona** (así la bandeja dice "lo compartió Pili"). Nacho puede pasarle el Atajo a Pili por iCloud y ella solo cambia la clave.
  3. **La bandeja es de los dos** y está arriba de "Por ver": "📥 Compartidos (n)". Cada ítem muestra el nombre escrito (si hay), "Reel de Instagram" (o la app que corresponda), quién lo compartió, "Ver el link", "Buscar" y "Descartar".
  4. **"Buscar"** abre Agregar con la búsqueda escrita y "¿De dónde vino?" con `Reel de Instagram · <link>` (si no entra en 200 letras, solo `Reel de Instagram`). El ítem sale de la bandeja cuando se agrega el primer título desde ahí; la pantalla sigue abierta, con la nota, por si el reel nombraba varias.
  5. **Tope de 100 ítems** en la bandeja de la pareja: el 101 se rechaza (para que una clave filtrada no la llene).

## Review Focus

1. **Lo que manda Instagram, TikTok o YouTube al compartir** (un link solo, link con texto, texto solo, links con `?igsh=` y otros rastreadores): se guarda el link limpio y el origen correcto. Probado en la Task 2.
2. **El Atajo sin nombre escrito:** el ítem se guarda igual y "Buscar" abre Agregar con la búsqueda vacía y la nota cargada. Probado en las Tasks 2 y 5.
3. **Clave vieja, clave de alguien que ya no está en el espacio, sin clave:** la función responde 401 y no guarda nada. Probado en la Task 2.
4. **Los dos abren el mismo ítem a la vez y los dos agregan:** el segundo borrado no falla, y el título repetido avisa como siempre ("ya está en la lista"). Probado en las Tasks 1 y 5.
5. **El ítem llega mientras la app está abierta** (la pareja comparte): aparece solo por Realtime. Probado en las Tasks 1 y 3.

---

### Task 1: Base de datos de claves y bandeja

**Files:**
- Create: `supabase/migrations/20261013000000_shared_items.sql`, `tests/security/shared.test.ts`

**Interfaces:**
- Produces:
  - `share_keys (user_id uuid pk → auth.users cascade, couple_id → couples cascade, key_hash text not null unique, created_at)`: RLS activado y ningún permiso para `anon`/`authenticated` (solo `service_role`).
  - `shared_items (id uuid pk, couple_id → couples cascade, shared_by uuid null → auth.users on delete set null, url text ≤ 2000, body text ≤ 500, query text ≤ 100, source text ≤ 40, created_at, check (url or body or query no nulo))`: RLS `is_member(couple_id)` para leer y borrar; `grant select, delete` a `authenticated`; en `supabase_realtime`.
  - `create_share_key() returns text` (`security definer`): `no_couple` sin espacio; genera `encode(extensions.gen_random_bytes(24), 'hex')` (48 caracteres), guarda `encode(extensions.digest(clave, 'sha256'), 'hex')` con `on conflict (user_id) do update` (la anterior deja de valer) y devuelve la clave.
  - `share_key_created_at() returns timestamptz`: la fecha de la clave de quien llama, o `null`.

- [ ] **Step 1: Write the failing tests** en `tests/security/shared.test.ts` (pareja A = Nacho y Pili, pareja C ajena; los ítems se insertan con `adminClient()` hasta que exista la función de la Task 2):
  - `create_share_key` devuelve 48 caracteres hex; en `share_keys` queda el SHA-256 y no la clave; una segunda llamada devuelve otra clave y reemplaza el hash; `share_key_created_at` devuelve una fecha (y `null` antes de crearla); sin espacio, `no_couple`.
  - Nadie lee `share_keys` desde la app (ni la propia fila) ni escribe en ella.
  - Pili lee los ítems de A y C no; Pili borra uno de A; C no puede borrar (sigue estando); borrar dos veces el mismo no da error; nadie inserta ni actualiza directo.
  - Realtime: Pili recibe el `INSERT` de un ítem de A con filtro `couple_id=eq.A`; C con el mismo filtro no recibe nada.
- [ ] **Step 2: Run** `npm run test:security -- shared` → FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx supabase migration up` y `npm run test:security` → todo en verde.
- [ ] **Step 5: Commit** `feat: claves para compartir y bandeja en la base`

### Task 2: Función `share`

**Files:**
- Create: `supabase/functions/share/lib.ts`, `supabase/functions/share/lib.test.ts`, `supabase/functions/share/index.ts`
- Modify: `supabase/config.toml` (`[functions.share] verify_jwt = false`), `tests/security/shared.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `parseShare(body: unknown): { url: string | null; body: string | null; query: string | null; source: string | null } | null`. `body` llega como `{ shared?: string, name?: string }`. Del texto compartido toma el primer link `https?://…` y lo limpia: sin `#…` y sin los parámetros `igsh`, `utm_*`, `si`, `fbclid`, `share_*`; el resto del texto, recortado, es `body`. `name` recortado es `query` (vacío o `-` cuenta como sin nombre). `source` sale del dominio: `instagram.com` → `Instagram`, `tiktok.com` → `TikTok`, `youtube.com`/`youtu.be` → `YouTube`, `x.com`/`twitter.com` → `X`, `facebook.com`/`fb.watch` → `Facebook`, `threads.net`/`threads.com` → `Threads`, otro → el dominio sin `www.`; sin link, `null`. Recorta a los largos de la tabla. Sin link, texto ni nombre → `null`.
  - `index.ts`: solo `POST` (y `OPTIONS`); 401 sin `x-share-key` o si su hash no está en `share_keys` o si esa persona ya no es miembro de ese espacio; 400 si `parseShare` da `null`; 429 si la pareja ya tiene 100 ítems; si no, guarda el ítem (`shared_by` = dueño de la clave) con la clave de servicio y responde `200 { ok: true }`.

- [ ] **Step 1: Write the failing tests:**
  - `lib.test.ts`: un link de Instagram con `?igsh=…` queda sin el parámetro y con origen `Instagram`; "Miren esto https://vm.tiktok.com/abc/ 🔥" da link de TikTok y `body` "Miren esto 🔥"; un link de `youtu.be` es `YouTube`; texto sin link da `url` y `source` `null`; `name` "  Dark  " da `query` "Dark" y "" o "-" dan `null`; todo vacío da `null`; un texto de 600 letras queda en 500.
  - `tests/security/shared.test.ts` (llamando a `${VITE_SUPABASE_URL}/functions/v1/share` con `fetch`, sin sesión): con la clave de Nacho guarda un ítem de A con `shared_by` Nacho y origen correcto; con la clave vieja (después de crear otra), con una inventada o sin clave, 401; sin contenido, 400; con la clave de alguien que dejó el espacio (borrar su fila de `couple_members` con `adminClient()`), 401; con 100 ítems en la bandeja, 429.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/share` y `npm run test:security -- shared` → FAIL.
- [ ] **Step 3: Implement** `lib.ts`, `index.ts` (cliente con `SUPABASE_SERVICE_ROLE_KEY`, que Supabase da a las funciones; hash con `crypto.subtle.digest('SHA-256', …)` en hex) y la entrada de `config.toml`. Reiniciar `npx supabase functions serve --env-file .env.local`.
- [ ] **Step 4: Run** los dos comandos → PASS, y `npm test` completo.
- [ ] **Step 5: Commit** `feat: función para guardar lo compartido`

### Task 3: API y bandeja en vivo

**Files:**
- Create: `src/features/shared/sharedApi.ts`, `src/features/shared/sharedApi.test.ts`, `src/features/shared/useShared.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `export type SharedItem = { id: string; url: string | null; body: string | null; query: string | null; source: string | null; sharedBy: string | null; createdAt: string }`
  - `listShared(coupleId): Promise<SharedItem[]>` (más nuevos primero), `dismissShared(id): Promise<void>`, `createShareKey(): Promise<string>`, `shareKeyCreatedAt(): Promise<string | null>`; errores de red como `Error('network')`.
  - `subscribeShared(coupleId, onChange): () => void`: `INSERT` con `couple_id=eq.<id>` y `DELETE` sin filtro, más la recarga con "Subscribed to PostgreSQL", como `subscribeTitles`.
  - `useShared(coupleId): { items: SharedItem[] | null; load: () => void }`, como `useBumble` (con el contador de pedidos para descartar respuestas viejas).
  - `export const SHARE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share``
  - `originNote(item: SharedItem): string`: `"Reel de Instagram · <url>"` para Instagram, `"Video de TikTok · <url>"`, `"Video de YouTube · <url>"`, `"Post de <origen> · <url>"` para el resto con link, y el `body` (recortado a 200) sin link; si con el link pasa de 200 letras, solo la primera parte.
- [ ] **Step 1: Write the failing tests** en `sharedApi.test.ts` (mock de `supabase` como `titlesApi.test.ts`): mapeo de filas, orden, `dismissShared` borra por id, las dos `rpc` con sus nombres, error de red, los dos filtros de `subscribeShared`, y `originNote` en los cinco casos (incluido el de más de 200).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: API de la bandeja de compartidos`

### Task 4: Ajustes — "Atajo para compartir"

**Files:**
- Modify: `src/features/settings/Settings.tsx`, `src/features/settings/Settings.test.tsx`, `src/app/styles.css`

Sección `<h2>Atajo para compartir</h2>` con: "Guardá en Pelis By Pili lo que ves en Instagram, TikTok o donde sea, desde el menú Compartir."; si no hay clave: botón "Crear mi clave"; si hay: "Tu clave se creó el <fecha>" y "Crear otra clave" (con "La clave anterior deja de funcionar"). Al crearla se muestra la clave en un campo de solo lectura con "Copiar clave" y "Guardala en el Atajo ahora: después no se vuelve a mostrar". Debajo, `<details><summary>Cómo armar el Atajo</summary>` con los pasos numerados (textos exactos):
1. Abrí la app Atajos y tocá "+".
2. Arriba, tocá el nombre y poné "Pelis By Pili".
3. Tocá ⓘ (o "Detalles"), activá "Mostrar en la hoja para compartir" y en "Tipos" dejá solo "URL" y "Texto".
4. Agregá la acción "Pedir entrada": tipo Texto, pregunta "¿Qué peli o serie es? (opcional)".
5. Agregá "Obtener contenido de URL" con la dirección `<SHARE_URL>` (botón "Copiar dirección"). Tocá "Mostrar más": Método POST; en Encabezados agregá `x-share-key` con tu clave; en Cuerpo de la solicitud elegí JSON y agregá `shared` = "Entrada del atajo" y `name` = "Entrada proporcionada".
6. Agregá "Mostrar notificación" con "Guardado en Pelis By Pili".
7. Probalo: en Instagram tocá Compartir → Pelis By Pili.
8. Para el otro iPhone: compartí el Atajo por iCloud, y en el otro celular cambiá la clave por la suya.

- [ ] **Step 1: Write the failing tests** en `Settings.test.tsx` (mock de `sharedApi`): sin clave muestra "Crear mi clave"; tocarlo llama a `createShareKey` y muestra la clave y "Copiar clave"; con clave muestra la fecha y "Crear otra clave"; la guía tiene la dirección de `SHARE_URL`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat: clave y guía del Atajo en Ajustes`

### Task 5: Bandeja en la lista y Agregar con la búsqueda hecha

**Files:**
- Create: `src/features/shared/SharedInbox.tsx`, `src/features/shared/SharedInbox.test.tsx`
- Modify: `src/features/titles/TitleList.tsx` (+ test), `src/features/titles/AddTitle.tsx` (+ test), `src/app/styles.css`, spec (sección 7)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `SharedInbox({ items, onSearch }: { items: SharedItem[]; onSearch: (item: SharedItem) => void })`: nada si no hay ítems; si hay, un `<details>` cerrado con `<summary>📥 Compartidos (n)</summary>` y por ítem: el nombre (`query`) en negrita si hay, `Reel de Instagram` (o el origen) · `lo compartió <nombre>`, "Ver el link" (si hay `url`, `target="_blank"`), "Buscar" y "Descartar" (`dismissShared`; si falla, "No se pudo descartar. Probá de nuevo.").
  - `AddTitle` suma `shared?: SharedItem`: arranca con `query = shared.query ?? ''` y `note = originNote(shared)`; con el primer título agregado borra el ítem (`dismissShared`, sin esperar ni mostrar error) y, con `shared`, no vacía la nota después de agregar.
  - `TitleList`: usa `useShared`, muestra `SharedInbox` arriba de las pestañas Por ver / Vistas y "Buscar" abre `AddTitle` con ese `shared`.
- [ ] **Step 1: Write the failing tests:**
  - `SharedInbox.test.tsx`: sin ítems no muestra nada; con dos, "📥 Compartidos (2)"; muestra nombre, "Reel de Instagram · lo compartió Pili" y "Ver el link" con el href; "Buscar" llama a `onSearch` con el ítem; "Descartar" llama a `dismissShared` y, si falla, el aviso.
  - `AddTitle.test.tsx`: con `shared` arranca con la búsqueda y la nota cargadas (y busca); al agregar un resultado llama a `dismissShared(id)` una sola vez aunque se agreguen dos y la nota sigue cargada; sin nombre, la búsqueda arranca vacía.
  - `TitleList.test.tsx`: con un ítem en la bandeja, "Buscar" abre Agregar con su búsqueda.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y sumar la bandeja a la sección 7 de la spec.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Revisión visual** en local a 390×844 y 393×852: Ajustes con la guía, la bandeja con dos ítems (creados con `curl` a la función local con una clave de prueba), "Buscar" con la búsqueda hecha y la nota.
- [ ] **Step 6: Commit** `feat: bandeja de compartidos en la lista`

### Task 6: Publicación y aceptación

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` ("Cierre de la Etapa 8").

- [ ] **Step 1:** `npm test && npm run test:security && npm run typecheck`.
- [ ] **Step 2 (Nacho):** `npx supabase db push`. Después: `npx supabase functions deploy share --use-api --no-verify-jwt`, una corrida de `npm run test:security:remote`, y un `curl` sin `apikey` a la función real para confirmar que el Atajo no necesita más encabezados que `x-share-key` (si los necesita, se suma a la guía).
- [ ] **Step 3:** `CI=true WRANGLER_SEND_METRICS=false npm run deploy < /dev/null` y comprobar el bundle publicado.
- [ ] **Step 4: Prueba de aceptación** (Nacho, y Pili de prueba): cada uno crea su clave y arma el Atajo con la guía; desde un reel real: Compartir → Pelis By Pili → (nombre o nada) → Listo; en la app aparece en "📥 Compartidos" en los dos celulares; "Buscar" abre la búsqueda hecha y al agregar sale de la bandeja.
- [ ] **Step 5: Commit** `docs: cierre de la Etapa 8`

**Cierre de la Etapa 8:** desde un reel real se llega a la búsqueda en unos 3 toques (Compartir, Pelis By Pili, Listo; después, "Buscar" en la bandeja). **No entra** (no adelantar): revelación simultánea, torneo ni modo sin internet.
