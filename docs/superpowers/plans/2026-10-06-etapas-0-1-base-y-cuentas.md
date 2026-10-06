# Pelis By Pili — Etapas 0 y 1 (Preparación y Cuentas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar publicada una web instalable (PWA) en los dos iPhones, con login por email y un espacio privado para dos personas, y con verificadas las fuentes externas de las que dependen las etapas siguientes.

**Architecture:** App de una sola página (React + TypeScript + Vite) instalable como PWA, desplegada en hosting estático gratuito. Supabase aporta cuentas (Auth) y base de datos (Postgres con Row Level Security); toda escritura sobre parejas e invitaciones pasa por funciones SQL, nunca por inserts directos del cliente. Las claves de TMDB y OMDb nunca van al cliente (en estas etapas solo se usan en scripts locales).

**Tech Stack:** Vite, React, TypeScript, Vitest + Testing Library (jsdom), vite-plugin-pwa, @supabase/supabase-js, Supabase CLI (migraciones), Netlify (hosting), tsx (scripts), npm.

**Spec:** `docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md` (secciones 3, 4, 5, 7, 9, 10, 11 y 12; etapas 0 y 1).

## Global Constraints

- Costo cero: solo planes gratuitos de Supabase, TMDB, OMDb y Netlify.
- Dos personas por espacio, máximo; nadie ajeno puede leer ni modificar nada del espacio.
- Dispositivos: los dos usuarios tienen iPhone; la app debe funcionar instalada (modo `standalone`) y en el navegador de la compu.
- Interfaz en español rioplatense; los textos exactos de cada pantalla están en cada tarea.
- Claves: al cliente solo llegan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY` y `OMDB_API_KEY` viven solo en `.env.local` (ignorado por git) y jamás en el build del cliente.
- Alcance estricto: no construir nada que figure en "No entra" de las etapas 0 y 1 (sin buscador, lista de películas, puntajes ni detalle).
- Decisión que se aparta de la spec (a confirmar al revisar este plan): el login es por **código de 6 dígitos por email** y no por link. Motivo: en iPhone, una app instalada en la pantalla de inicio no comparte sesión con Safari, así que un link abriría Safari y dejaría la sesión fuera de la app. La invitación a la pareja sí es un link, que se abre en Safari y se acepta ahí.
- Decisiones de herramientas que tomé yo y que no figuran en la spec: Netlify como hosting, Vite + Vitest, npm.

## Review Focus

Entradas o fallas que la spec implica pero no detalla, de la más a la menos probable:

1. Email escrito con mayúsculas o espacios (así se crearían dos cuentas distintas para la misma persona): se normaliza. Probado en Task 6.
2. Invitación usada dos veces, vencida o inventada: no suma a nadie y el mensaje no revela cuál de los tres casos fue. Probado en Task 5.
3. Alguien que ya está en un espacio abre una invitación de otro: se rechaza y no lo mueve de espacio. Probado en Tasks 5 y 8.
4. Doble toque en "Crear nuestro espacio": se crea un solo espacio. Probado en Tasks 5 y 8.
5. Arranque de la app sin conexión o con sesión vencida: muestra "Sin conexión" con reintento, sin parpadear la pantalla de login. Probado en Task 6.

---

## Etapa 0 — Preparación

### Task 1: Esqueleto de la web instalable

**Files:**
- Create: proyecto Vite en la raíz de `Pelis_By_Pili` (`package.json`, `vite.config.ts`, `index.html`, `tsconfig*.json`), `src/main.tsx`, `src/app/App.tsx`, `src/test/setup.ts`, `public/icon.svg`, `netlify.toml`, `.gitignore`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `export function App(): JSX.Element` en `src/app/App.tsx`; scripts npm `dev`, `build`, `test` (Vitest en modo run) y `typecheck`.

- [ ] **Step 1: Inicializar el repositorio y el proyecto**

Ejecutar `git init`, crear el proyecto con la plantilla `react-ts` de Vite en la carpeta actual (conservando `docs/`), e instalar `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vite-plugin-pwa`, `@vite-pwa/assets-generator`, `tsx`. `.gitignore` debe incluir `node_modules`, `dist`, `.env.local`, `.env.test.local`.

- [ ] **Step 2: Escribir el test que falla**

En `src/app/App.test.tsx`: `renders the app name`: renderizar `<App />` y esperar `screen.getByRole('heading', { name: 'Pelis By Pili' })` en el documento.

- [ ] **Step 3: Verificar que falla**

Run: `npm test`
Expected: FAIL (el heading no existe).

- [ ] **Step 4: Implementar `App` y la configuración PWA**

`App` renderiza un `<h1>` con el texto "Pelis By Pili". En `vite.config.ts` configurar Vitest (`environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`) y `vite-plugin-pwa` con manifest: `name` "Pelis By Pili", `short_name` "Pelis", `display` "standalone", `start_url` "/", `lang` "es-AR", `theme_color` y `background_color` a elección. Generar los íconos (192, 512 y apple-touch-icon 180) desde `public/icon.svg` (un ícono placeholder simple) con `@vite-pwa/assets-generator`, y enlazar el apple-touch-icon en `index.html`. `netlify.toml`: comando de build `npm run build`, carpeta `dist`, y redirect `/*` a `/index.html` con estado 200 (rutas de la SPA).

- [ ] **Step 5: Verificar**

Run: `npm test && npm run typecheck && npm run build`
Expected: test PASS; en `dist/` existen `manifest.webmanifest` y el service worker.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: esqueleto PWA con Vite, React y Vitest"
```

### Task 2: Cuentas, claves y entorno

**Files:**
- Create: `.env.example`, `scripts/lib/env.ts`
- Test: `scripts/lib/env.test.ts`

**Interfaces:**
- Produces: `export function requireEnv(names: string[], source?: Record<string, string | undefined>): Record<string, string>` en `scripts/lib/env.ts`. Lanza `Error` con el mensaje `Faltan variables de entorno: A, B` (nombres separados por coma y espacio, en el orden recibido) si falta alguna o está vacía.

- [ ] **Step 1: Pasos manuales de Nacho (no los hace Claude Code)**

Crear, con cuenta gratuita: un proyecto en Supabase; una clave de API en TMDB (cuenta gratis, uso personal); una clave gratuita de OMDb (llega por email, límite de 1.000 consultas por día); una cuenta en Netlify. Copiar las claves a `.env.local` siguiendo `.env.example`. Anotar en `.env.local` pero no en ningún otro archivo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`, `OMDB_API_KEY`.

- [ ] **Step 2: Escribir los tests que fallan**

En `scripts/lib/env.test.ts`: `returns the requested values` (fuente con A y B, devuelve ambas); `throws naming every missing variable` (fuente sin B ni C, mensaje exacto `Faltan variables de entorno: B, C`); `treats empty strings as missing`.

- [ ] **Step 3: Verificar que fallan**

Run: `npm test -- scripts/lib/env.test.ts`
Expected: FAIL (`requireEnv` no existe).

- [ ] **Step 4: Implementar `requireEnv`**

Por defecto lee `process.env`. Crear `.env.example` con las cinco variables y valores vacíos, y un comentario por variable indicando dónde se obtiene.

- [ ] **Step 5: Verificar y confirmar que ningún secreto queda versionado**

Run: `npm test && git status --short && git check-ignore .env.local`
Expected: PASS; `.env.local` aparece como ignorado y no figura en `git status`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: variables de entorno y helper requireEnv"
```

### Task 3: Verificar las fuentes externas de puntajes y plataformas

**Files:**
- Create: `scripts/verify/omdb-ratings.ts`, `scripts/verify/tmdb-providers.ts`, `scripts/verify/lib.ts`, `docs/superpowers/notes/2026-10-verificacion-fuentes.md`
- Test: `scripts/verify/lib.test.ts`

**Interfaces:**
- Consumes: `requireEnv` (Task 2).
- Produces: en `scripts/verify/lib.ts`: `export type RatingsSummary = { imdb: string | null; rottenTomatoes: string | null; metacritic: string | null }` y `export function summarizeOmdb(json: { Ratings?: { Source: string; Value: string }[] }): RatingsSummary`. Las fuentes se reconocen por `Internet Movie Database`, `Rotten Tomatoes` y `Metacritic`.

- [ ] **Step 1: Escribir los tests que fallan**

En `scripts/verify/lib.test.ts` con un fixture hecho a mano de tres puntajes (IMDb "8.5/10", Rotten Tomatoes "99%", Metacritic "96/100"): `maps the three sources`; `returns null for a missing source` (fixture solo con IMDb: los otros dos son `null`); `handles a missing Ratings field` (todo `null`).

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- scripts/verify/lib.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `summarizeOmdb`**

- [ ] **Step 4: Verificar que pasan**

Run: `npm test -- scripts/verify/lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Script de OMDb**

`scripts/verify/omdb-ratings.ts`: consulta OMDb por ID de IMDb para una película (Parasite, `tt6751668`) y una serie (Breaking Bad, `tt0903747`), e imprime para cada una el `RatingsSummary` y el valor de `Response`. Se ejecuta con `npx tsx --env-file=.env.local scripts/verify/omdb-ratings.ts`.

- [ ] **Step 6: Script de TMDB**

`scripts/verify/tmdb-providers.ts`: (a) pide `/3/watch/providers/regions` e imprime si existe la región `AR`; (b) pide `/3/movie/496243/watch/providers` (Parasite) y `/3/tv/1396/watch/providers` (Breaking Bad) e imprime los nombres de proveedores de `results.AR` o "sin datos para AR". Se ejecuta con `npx tsx --env-file=.env.local scripts/verify/tmdb-providers.ts`.

- [ ] **Step 7: Ejecutar ambos con las claves reales y registrar resultados**

En `docs/superpowers/notes/2026-10-verificacion-fuentes.md` anotar, con la fecha: (1) si OMDb devuelve Rotten Tomatoes para la película y para la serie; (2) si TMDB tiene la región AR y proveedores para esos dos títulos; (3) de la documentación o el panel de Supabase, copiando el texto exacto: la política de pausa de proyectos gratuitos inactivos y el límite de emails por hora del servicio de email integrado. Cada punto termina con una línea "Impacto en el plan:" que diga qué cambia en las etapas 2 a 4 (por ejemplo, "ocultar Rotten Tomatoes en series").

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scripts de verificación de OMDb y TMDB y notas de resultados"
```

### Task 4: Publicar la app vacía y probar la instalación en los iPhones

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` (agregar sección "Publicación")

**Interfaces:**
- Produces: URL pública de la app (se anota en las notas); a partir de acá, `npm run build` y `npx netlify-cli deploy --prod --dir=dist` publican una versión nueva.

- [ ] **Step 1: Publicar**

Ejecutar `npm run build`, iniciar sesión en Netlify con `npx netlify-cli login`, crear el sitio y publicar con `npx netlify-cli deploy --prod --dir=dist`. Anotar la URL en las notas.

- [ ] **Step 2: Verificar que el sitio responde y es instalable**

Run: `curl -sI <URL> | head -n 1` y `curl -s <URL>/manifest.webmanifest`
Expected: `HTTP/2 200`; el manifest contiene `"display":"standalone"` y `"short_name":"Pelis"`.

- [ ] **Step 3: Prueba manual en los dos iPhones (Nacho y su novia)**

Abrir la URL en Safari, tocar Compartir, "Agregar a pantalla de inicio", abrir desde el ícono. Esperado: se abre a pantalla completa, sin la barra de Safari, mostrando "Pelis By Pili". Anotar en las notas el resultado de cada iPhone y la versión de iOS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: publicación de la app vacía y prueba de instalación"
```

**Cierre de la Etapa 0:** la app vacía abre desde el ícono en los dos iPhones y las notas de verificación están escritas.

---

## Etapa 1 — Cuentas y espacio de pareja

### Task 5: Base de datos de pareja y reglas de seguridad

**Files:**
- Create: `supabase/migrations/<timestamp>_couples.sql`, `tests/security/helpers.ts`, `vitest.security.config.ts`
- Test: `tests/security/couples.test.ts`

**Interfaces:**
- Produces (SQL, esquema `public`): tablas `couples(id uuid pk default gen_random_uuid(), created_at timestamptz)`, `couple_members(couple_id uuid, user_id uuid, joined_at timestamptz, primary key (couple_id, user_id), unique (user_id))`, `invites(token text pk, couple_id uuid, created_by uuid, created_at timestamptz, expires_at timestamptz, used_at timestamptz null, used_by uuid null)`; función auxiliar `is_member(p_couple_id uuid) returns boolean`; funciones RPC, solo ejecutables por `authenticated`: `create_couple() returns uuid`, `create_invite() returns text`, `accept_invite(p_token text) returns uuid`.
- Códigos de error (el mensaje de la excepción es exactamente el código): `already_in_couple`, `couple_full`, `invite_invalid`, `not_a_member`.
- Produces (tests): en `tests/security/helpers.ts`: `createTestUser(): Promise<{ id: string; client: SupabaseClient }>` (crea un usuario con el cliente admin, email `test-<uuid>@pelis.test`, y devuelve un cliente ya autenticado con contraseña) y `cleanup(): Promise<void>` (borra todos los usuarios y parejas creados por `createTestUser` y los tests).

- [ ] **Step 1: Escribir los tests de seguridad que fallan**

En `tests/security/couples.test.ts`, usando tres usuarios A, B y C creados con `createTestUser` y `afterAll(cleanup)`:
- `create_couple makes the caller a member`: A llama `create_couple`; A lee `couple_members` y ve una fila.
- `create_couple twice fails with already_in_couple`: segunda llamada de A y llamada simultánea doble (`Promise.all` de dos llamadas) terminan con un único espacio y el error `already_in_couple` en la sobrante.
- `outsiders see nothing`: B lee `couples`, `couple_members` e `invites` y obtiene cero filas.
- `no direct writes`: B hace `insert` directo en `couple_members` con el `couple_id` de A y falla; A hace `update` directo sobre `invites` y falla.
- `accept_invite joins the couple`: A crea invitación, B la acepta, B pasa a ver 2 miembros.
- `invite is single use`: C acepta el mismo token y recibe `invite_invalid`.
- `unknown and expired tokens look the same`: `accept_invite('inventado')` y una invitación con `expires_at` en el pasado (se vence con el cliente admin) devuelven ambos `invite_invalid`.
- `a full couple refuses more`: con A y B juntos, `create_invite` de A falla con `couple_full`.
- `a user already in a couple cannot accept another invite`: B (ya en el espacio de A) intenta aceptar una invitación de otro espacio de prueba y recibe `already_in_couple`, y sigue en el espacio de A.
- `non-members cannot create invites`: C llama `create_invite` y recibe `not_a_member`.
- `anonymous clients cannot call the functions`.

- [ ] **Step 2: Configuración de los tests de seguridad**

`vitest.security.config.ts` apunta a `tests/security/**`, `environment: 'node'`, timeout de 30 s y toma las variables de `.env.local`. Agregar el script npm `test:security`. Los tests hablan con el proyecto real de Supabase y solo crean y borran sus propios usuarios y filas: no ejecutarlos contra datos reales de la pareja una vez que existan.

- [ ] **Step 3: Verificar que fallan**

Run: `npm run test:security`
Expected: FAIL (las tablas y funciones no existen).

- [ ] **Step 4: Escribir la migración**

Crear las tablas, activar RLS en las tres, y políticas de solo lectura: `couples`, `couple_members` e `invites` visibles para quien cumpla `is_member(couple_id)`. Sin políticas de insert, update ni delete: toda escritura pasa por las tres funciones, definidas `security definer` con `set search_path = ''` y `revoke execute ... from public, anon` más `grant execute ... to authenticated`. Reglas: `create_couple` falla con `already_in_couple` si el usuario ya tiene fila en `couple_members`; `create_invite` exige membresía (`not_a_member`) y menos de 2 miembros (`couple_full`), genera un token aleatorio de al menos 32 caracteres hexadecimales y vence a los 7 días; `accept_invite` falla con `invite_invalid` si el token no existe, ya se usó o venció (mismo mensaje en los tres casos), con `already_in_couple` si el usuario ya tiene espacio, y con `couple_full` si ya hay dos miembros. Un trigger `before insert` en `couple_members` rechaza una tercera fila para el mismo `couple_id` con `couple_full`.

- [ ] **Step 5: Aplicar la migración**

Run: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`
Expected: la migración se aplica sin errores.

- [ ] **Step 6: Verificar que pasan**

Run: `npm run test:security`
Expected: PASS en los once tests.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: parejas, invitaciones y reglas de seguridad en Supabase"
```

### Task 6: Login por código de 6 dígitos

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/email.ts`, `src/features/auth/authApi.ts`, `src/features/auth/AuthGate.tsx`
- Test: `src/lib/email.test.ts`, `src/features/auth/authApi.test.ts`, `src/features/auth/AuthGate.test.tsx`

**Interfaces:**
- Consumes: variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Produces:
  - `src/lib/supabase.ts`: `export const supabase: SupabaseClient`.
  - `src/lib/email.ts`: `export function normalizeEmail(raw: string): string` (recorta espacios y pasa a minúsculas) y `export function isPlausibleEmail(value: string): boolean`.
  - `src/features/auth/authApi.ts`: `export type AuthErrorKind = 'invalid_email' | 'rate_limited' | 'wrong_code' | 'network'`; `export class AuthError extends Error { kind: AuthErrorKind }`; `requestCode(email: string): Promise<void>`, `verifyCode(email: string, code: string): Promise<void>`, `getSession(): Promise<Session | null>`, `onAuthChange(cb: (session: Session | null) => void): () => void` (devuelve la función para desuscribirse), `signOut(): Promise<void>`. Ambas funciones de código normalizan el email antes de llamar a Supabase; `requestCode` usa `signInWithOtp` y `verifyCode` usa `verifyOtp` con `type: 'email'`.
  - `src/features/auth/AuthGate.tsx`: `export function AuthGate(props: { children: ReactNode }): JSX.Element`; muestra los hijos solo con sesión.

- [ ] **Step 1: Escribir los tests que fallan**

- `email.test.ts`: `normalizeEmail('  Nacho@Gmail.COM ')` es `'nacho@gmail.com'`; `isPlausibleEmail` es falso para `'nacho'`, `'a@b'` y vacío, y verdadero para `'nacho@gmail.com'`.
- `authApi.test.ts` (con el cliente de Supabase simulado): `requestCode` llama a `signInWithOtp` con el email normalizado; un error de límite de Supabase se traduce a `AuthError` de tipo `rate_limited`; un código incorrecto en `verifyCode` es `wrong_code`; un fallo de red es `network`; un email no plausible lanza `invalid_email` sin llamar a Supabase.
- `AuthGate.test.tsx` (con `authApi` simulado): mientras `getSession` no resolvió se muestra "Cargando…" y no el formulario; sin sesión muestra el campo de email y el botón "Enviarme el código"; tras enviar el email muestra "Ingresá el código de 6 dígitos que te llegó por email" y un campo de código; un código incorrecto muestra "Código incorrecto o vencido"; `rate_limited` muestra "Pediste muchos códigos, esperá unos minutos"; si `getSession` falla por red muestra "Sin conexión. Probá de nuevo." con un botón "Reintentar" que vuelve a consultar; con sesión renderiza los hijos.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar los módulos y el componente**

En `AuthGate`, el campo de código acepta solo dígitos y se envía al completar los 6. `supabase.ts` crea el cliente con `persistSession: true` y `autoRefreshToken: true`.

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Configurar el email de Supabase para que envíe el código (manual, Nacho)**

En el panel de Supabase, Authentication → Email Templates: en las plantillas "Confirm signup" y "Magic Link" reemplazar el enlace por el código usando `{{ .Token }}`, con asunto "Tu código de Pelis By Pili". Dejar un solo código por email.

- [ ] **Step 6: Probar con un email real**

Run: `npm run dev`, abrir la app en el navegador, pedir el código con un email propio y completarlo.
Expected: llega el email con 6 dígitos y la app deja de mostrar el formulario.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: login por código de 6 dígitos con AuthGate"
```

### Task 7: API del espacio de pareja y enlaces de invitación

**Files:**
- Create: `src/features/couple/coupleApi.ts`, `src/features/couple/invite.ts`
- Test: `src/features/couple/coupleApi.test.ts`, `src/features/couple/invite.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 6) y las funciones RPC `create_couple`, `create_invite`, `accept_invite` y las tablas de Task 5.
- Produces:
  - `src/features/couple/coupleApi.ts`: `export type CoupleErrorKind = 'already_in_couple' | 'couple_full' | 'invite_invalid' | 'not_a_member' | 'network'`; `export class CoupleError extends Error { kind: CoupleErrorKind }`; `getMyCouple(): Promise<{ coupleId: string; memberCount: number } | null>`, `createCouple(): Promise<string>`, `createInvite(): Promise<string>` (devuelve el token), `acceptInvite(token: string): Promise<string>` (devuelve el `coupleId`). El código de error se toma del mensaje de la excepción de Postgres; cualquier mensaje desconocido se trata como `network`.
  - `src/features/couple/invite.ts`: `buildInviteLink(origin: string, token: string): string` (da `<origin>/?invite=<token>`) y `parseInviteToken(url: string): string | null` (lee el parámetro `invite`; `null` si falta o está vacío).

- [ ] **Step 1: Escribir los tests que fallan**

- `invite.test.ts`: `buildInviteLink('https://pelis.example', 'abc')` es `'https://pelis.example/?invite=abc'`; `parseInviteToken('https://pelis.example/?invite=abc')` es `'abc'`; sin parámetro o con `?invite=` vacío es `null`; ida y vuelta con un token de 32 caracteres hexadecimales.
- `coupleApi.test.ts` (cliente simulado): `getMyCouple` devuelve `null` sin filas y `{ coupleId, memberCount: 2 }` con dos filas del mismo espacio; cada código de error de Postgres se traduce a su `CoupleErrorKind`; un mensaje desconocido es `network`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -- src/features/couple`
Expected: FAIL.

- [ ] **Step 3: Implementar ambos módulos**

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: API del espacio de pareja y enlaces de invitación"
```

### Task 8: Pantallas de entrada, inicio y ajustes

**Files:**
- Create: `src/features/couple/CoupleGate.tsx`, `src/features/couple/Onboarding.tsx`, `src/app/Home.tsx`, `src/features/settings/Settings.tsx`
- Modify: `src/app/App.tsx` (compone `AuthGate` → `CoupleGate`)
- Test: `src/features/couple/CoupleGate.test.tsx`, `src/features/couple/Onboarding.test.tsx`, `src/app/Home.test.tsx`, `src/features/settings/Settings.test.tsx`

**Interfaces:**
- Consumes: `AuthGate`, `signOut` (Task 6); `getMyCouple`, `createCouple`, `createInvite`, `acceptInvite`, `CoupleError`, `buildInviteLink`, `parseInviteToken` (Task 7).
- Produces: `CoupleGate({ children }: { children: ReactNode })`: consulta `getMyCouple`; con espacio renderiza los hijos; sin espacio renderiza `Onboarding`. `Home(): JSX.Element` con las pestañas inferiores "Lista" y "Ajustes". El token de invitación se lee de la URL actual (`window.location.href`) en cada render, sin guardarlo en otro lado, de modo que sobrevive al login; al aceptarlo se limpia la URL con `history.replaceState`.

- [ ] **Step 1: Escribir los tests que fallan** (APIs simuladas)

- `Onboarding`: sin token en la URL muestra el botón "Crear nuestro espacio"; el botón se deshabilita mientras la llamada está en curso y dos toques seguidos llaman a `createCouple` una sola vez; con `?invite=abc` muestra "Te invitaron a un espacio" y el botón "Unirme", que llama a `acceptInvite('abc')`; los errores se muestran con estos textos: `invite_invalid` → "Esta invitación no es válida o ya se usó", `already_in_couple` → "Ya sos parte de un espacio", `couple_full` → "Ese espacio ya tiene dos personas", `network` → "Sin conexión. Probá de nuevo."; ante `already_in_couple` el usuario no pasa a otro espacio.
- `CoupleGate`: con `getMyCouple` en `null` muestra `Onboarding`; con espacio muestra los hijos; mientras carga muestra "Cargando…"; ante fallo de red muestra "Sin conexión. Probá de nuevo." con "Reintentar".
- `Home`: pestaña "Lista" muestra "Nuestra lista está vacía" (y nada más: sin buscador ni botón "+"); si `memberCount` es 1 muestra además "Esperando a tu pareja".
- `Settings`: con un solo miembro muestra el botón "Invitar a mi pareja", que llama a `createInvite` y muestra el enlace construido con `buildInviteLink(window.location.origin, token)` con un botón "Copiar enlace"; con dos miembros no muestra el botón de invitar y dice "Son dos personas en este espacio"; el botón "Cerrar sesión" llama a `signOut`.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar los componentes y componer `App`**

Orden en `App`: `AuthGate` → `CoupleGate` → `Home`. Estilos mínimos, pensados primero para celular (ancho de 390 px), con el contenido respetando las áreas seguras del iPhone (`env(safe-area-inset-*)`).

- [ ] **Step 4: Verificar que pasan**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS y build correcto.

- [ ] **Step 5: Probar el flujo completo en local con dos emails reales**

Run: `npm run dev`. Con el primer email, entrar y crear el espacio, tocar "Invitar a mi pareja" y copiar el enlace; abrir el enlace en una ventana privada, entrar con el segundo email y tocar "Unirme".
Expected: ambos ven "Nuestra lista está vacía"; el primero ya no ve "Esperando a tu pareja" tras recargar; abrir el mismo enlace con un tercer email muestra "Esta invitación no es válida o ya se usó".

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: pantallas de entrada, inicio y ajustes del espacio"
```

### Task 9: Publicación y aceptación en los dos iPhones

**Files:**
- Modify: `docs/superpowers/notes/2026-10-verificacion-fuentes.md` (agregar sección "Cierre de la Etapa 1")

- [ ] **Step 1: Suite completa antes de publicar**

Run: `npm test && npm run test:security && npm run typecheck && npm run build`
Expected: todo en verde.

- [ ] **Step 2: Publicar**

Run: `npx netlify-cli deploy --prod --dir=dist`
Expected: la URL pública responde `200`. Confirmar en el panel de Netlify que el build no contiene `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY` ni `OMDB_API_KEY` (buscar esos nombres en `dist/` con `grep -r`).

- [ ] **Step 3: Prueba de aceptación en los dos iPhones**

Nacho entra desde la app instalada con su email (código de 6 dígitos), crea el espacio y copia el enlace de invitación; su novia abre el enlace en Safari, entra con su email y toca "Unirme"; luego ella abre la app instalada, pide su código y entra directo. Esperado: los dos ven "Nuestra lista está vacía"; los dos pueden cerrar sesión y volver a entrar; cerrar la app y volver a abrirla conserva la sesión; un tercer email con el mismo enlace recibe "Esta invitación no es válida o ya se usó". Anotar el resultado en las notas.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: cierre de la Etapa 1"
```

**Cierre de la Etapa 1:** los dos entran desde su iPhone al mismo espacio, y una tercera persona no puede entrar ni ver nada (probado con los tests de seguridad y a mano). **No entra** (y no debe adelantarse): buscador, lista de películas, puntajes, detalle ni marcar vista.
