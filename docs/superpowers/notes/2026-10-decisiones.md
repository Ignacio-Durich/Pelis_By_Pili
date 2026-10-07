# Decisiones tomadas fuera del plan (etapas 0 y 1)

Cada línea: decisión — motivo — costo si está mal.

## Organización
- Repo con un commit inicial solo de docs en `main`; el trabajo va en la rama `etapas-0-1` — no implementar directo en main — un merge.
- Orden de tareas: 1, 2 y 3 (código), 6, 7, 8; después 5, los pasos con claves de 2 y 3, y al final 4 y 9 — avanzar sin claves mientras Nacho crea las cuentas — ninguno, las interfaces no cambian.

## Task 1
- Vitest solo incluye `src/**/*.test.{ts,tsx}` y `scripts/**/*.test.ts` — `npm test` no debe levantar `tests/security` (necesita claves y red; corre con `npm run test:security`) — ninguno.
- `src/test/setup.ts` hace `cleanup()` de Testing Library tras cada test — Vitest sin globals no lo hace solo y los tests de UI se contaminan — ninguno.
- `typecheck` es `tsc -b` (los tsconfig de la plantilla ya traen `noEmit`); `tsconfig.node.json` incluye `pwa-assets.config.ts` y `scripts/` — así el typecheck cubre los scripts — ninguno.
- Plantilla `react-ts` de Vite generada en una carpeta temporal y copiada sin pisar `docs/`; se descartó su contenido de demo (App.css, index.css, assets, favicon.svg) — YAGNI — ninguno.
- Íconos generados con `pwa-assets-generator` y `minimal2023Preset` (64, 192, 512, maskable 512, apple-touch 180, favicon.ico); script npm `generate-pwa-assets` para regenerarlos — es el preset estándar de la herramienta — ninguno.
- `viewport-fit=cover` en el meta viewport — necesario para usar las áreas seguras del iPhone en la Task 8 — ninguno.
- Colores: `theme_color` y `background_color` `#1b1b2f`; ícono placeholder "PP" amarillo sobre fondo oscuro — el plan los deja a elección — se cambian en dos líneas.
- `registerType: 'autoUpdate'` en vite-plugin-pwa — las nuevas versiones se toman solas, sin pantalla de "actualizar" — una versión vieja puede verse hasta recargar.
- El postinstall de esbuild quedó sin aprobar (npm 11 pide aprobar scripts); `tsx` y Vite funcionan igual con el binario opcional — no correr scripts de instalación sin necesidad — si algo falla, `npm install-scripts approve esbuild`.

## Task 6
- Errores de Supabase Auth (devuelve `{ error }`, no lanza): red = `name` `AuthRetryableFetchError` o `status` 0 (incluye 502/503/504); límite = `status` 429 o `code` que empieza con `over_`; cualquier otro error al pedir el código = `invalid_email` y al verificarlo = `wrong_code` — es lo que muestra el código de `@supabase/auth-js` 2.117 — confirmado contra el proyecto real: un código incorrecto devuelve `AuthApiError` 403 `otp_expired`, que se traduce a `wrong_code`.
- `getSession` con un error que no es de red (por ejemplo, sesión vencida) devuelve "sin sesión" y muestra el login — no hay nada que reintentar — ninguno.
- Texto para `invalid_email`: "Ese email no parece válido" — el plan no lo fija — una línea.
- Botón "Usar otro email" en el paso del código — en la app instalada no hay botón de recargar, así que un email mal escrito dejaba a la persona trabada — un botón de más.
- El campo del código usa `inputMode="numeric"` y `autoComplete="one-time-code"` — teclado numérico y sugerencia del código en iOS — ninguno.
- Tests de UI con `fireEvent` de Testing Library, sin agregar `@testing-library/user-event` — alcanza y evita una dependencia — ninguno.
- Se agregó `src/vite-env.d.ts` con el tipo de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` — typecheck de `import.meta.env` — ninguno.

## Task 7
- `getMyCouple` lee `couple_members` sin filtrar por usuario: RLS solo devuelve las filas del propio espacio y cada persona está en un solo espacio (`unique (user_id)`), así que `memberCount` es la cantidad de filas — una consulta en vez de dos — si un día una persona pudiera estar en dos espacios, habría que filtrar.
- El token va en el enlace con `encodeURIComponent` — inocuo con tokens hexadecimales — ninguno.

## Task 8
- `CoupleGate` expone el espacio por React context; `useCouple()` devuelve `{ coupleId, memberCount }` y vive en `src/features/couple/coupleContext.ts` (separado para que funcione el fast refresh de Vite) — Home y Settings no reciben props — ninguno.
- `App.test.tsx` ahora simula sesión y espacio y espera el heading "Pelis By Pili" en Home — App pasó a componer AuthGate → CoupleGate → Home — ninguno.
- Si una invitación se rechaza por algo que no es la red (`invite_invalid`, `already_in_couple`, `couple_full`), se limpia el `?invite=` de la URL y aparece "Crear nuestro espacio" debajo del mensaje; ante error de red se conserva para reintentar — si no, la persona quedaba trabada frente a una invitación inútil — un tercero podría crear su propio espacio vacío (no ve nada del otro).
- Quien ya tiene espacio y abre un enlace de invitación ve su propio inicio: `CoupleGate` ni llama a `acceptInvite` — el servidor igual lo rechazaría — el `?invite=` queda en la URL hasta cerrar la app.
- Texto para `not_a_member`: "No sos parte de este espacio" — el plan no lo fija — una línea.
- En Ajustes el enlace se muestra en un campo de solo lectura además del botón "Copiar enlace", con un "¡Copiado!" al copiar — si el portapapeles falla, se puede seleccionar a mano — ninguno.
- La cantidad de miembros se lee al abrir la app; quien invitó deja de ver "Esperando a tu pareja" al recargar, no en tiempo real — el plan lo acepta así (Task 8, paso 5) — tiempo real llega en la etapa 2.
- Estilos: tema oscuro, ancho máximo 390 px, áreas seguras con `env(safe-area-inset-*)`, barra de pestañas fija abajo, inputs de 17 px para que Safari no haga zoom — el plan pide "estilos mínimos" — cosmético.

## Task 5
- Además de RLS sin políticas de escritura, la migración hace `revoke all` a `anon` y `authenticated` sobre las tres tablas y solo devuelve `select` a `authenticated` — Supabase les da todos los privilegios por defecto y RLS no cubre `truncate`; además así un `update` directo falla con error en vez de afectar 0 filas en silencio — si algún día hace falta escribir desde el cliente, hay que dar el grant.
- El tope de dos miembros toma un lock sobre la fila del espacio en el trigger — sin eso, dos altas simultáneas podían dejar tres miembros — una espera mínima en altas simultáneas.
- `create_couple` y `accept_invite` convierten el choque con `unique (user_id)` en `already_in_couple` — así el doble toque simultáneo devuelve el código esperado y el espacio sobrante se descarta (rollback) — ninguno.
- El token de invitación son 64 caracteres hexadecimales de dos `gen_random_uuid()` — aleatorio criptográfico sin depender de la extensión pgcrypto — ninguno.
- `accept_invite` valida primero el token (inexistente, usado o vencido = `invite_invalid`) y después si la persona ya tiene espacio — no revela nada del token a quien ya está en un espacio — ninguno.
- Sin Docker en la Mac, la migración se validó antes de aplicarla en un Postgres en WASM (PGlite, en una carpeta temporal fuera del proyecto) simulando `auth.uid()` y los roles de Supabase: 25 de 25 chequeos equivalentes a los tests de seguridad, y una mutación (política abierta) falla como debe. No reemplaza a `npm run test:security` contra el proyecto real.
- `vitest.security.config.ts` toma las variables de `.env.local` con `loadEnv` de Vite; `tsconfig.node.json` incluye `tests/` — typecheck de los tests de seguridad — ninguno.
- `supabase init` creó `supabase/config.toml` (configuración del stack local; no se sube al proyecto remoto) — `supabase link` y `db push` lo necesitan — ninguno.
- Proyecto de Supabase creado sin "Automatically expose new tables" (lo recomienda el propio panel); la migración da los permisos a mano, incluido `grant all` a `service_role` para los tests de seguridad — no depender de permisos automáticos — ninguno.

## Tasks 4 y 9
- Se publica el build local con `deploy --no-build` (el CLI actual compila por defecto) — así el build usa `.env.local` y Netlify no necesita variables — si un día se conecta GitHub para builds automáticos, hay que cargar las dos variables `VITE_` en Netlify.
- La primera publicación ya incluye el login y el espacio (Etapa 1), no la app vacía, porque el código de la Etapa 1 se terminó antes de tener claves; la prueba de instalación de la Task 4 y la de aceptación de la Task 9 se hacen en una sola sesión con los iPhones — ahorra un viaje — si la instalación falla, no se distingue si es por la PWA o por el login (se mira el paso de instalación primero).
- Las cuentas de prueba `+pareja` y `+tercero` se usaron para la prueba local de la Task 8; su espacio se borró desde el panel antes de la Task 9.

## Revisión final
- Al abrir la app sin conexión con la sesión vencida, supabase-js emite `INITIAL_SESSION` con `null` y eso mostraba el login en vez de "Sin conexión". `onAuthChange` ahora ignora ese evento y el arranque lo decide solo `getSession` — es el punto 5 del Review Focus del plan — ninguno.
- Si el servidor responde `already_in_couple` en la pantalla de entrada (la persona aceptó en otra ventana, o se perdió la respuesta), la app vuelve a leer el espacio y muestra el inicio, en vez de dejarla trabada con "Ya sos parte de un espacio". Cambia lo que pedía el plan (mostrar el mensaje), pero la persona sigue sin poder pasarse a otro espacio — ninguno.
- Nuevo test de seguridad: alguien que es miembro de otro espacio solo ve el suyo. Antes, ningún test habría detectado una política del tipo "cualquier miembro lee todo".

# Etapa 2

## Task 0
- `npm run test:security` corre contra el Supabase local (`npx supabase start`, en Docker vía OrbStack) y `npm run test:security:remote` contra el proyecto real — así los tests no tocan la base donde ya están los datos de Nacho y Pili — si el stack local no está levantado, los tests fallan por conexión: `npx supabase start`.
- `.env.test.local` (ignorado por git) se genera desde `npx supabase status -o env` y copia `TMDB_API_KEY` y `OMDB_API_KEY` de `.env.local` — Vite le da prioridad sobre `.env.local` en el modo `test` — ninguno.
