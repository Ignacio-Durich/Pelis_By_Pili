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
- Errores de Supabase Auth (devuelve `{ error }`, no lanza): red = `name` `AuthRetryableFetchError` o `status` 0 (incluye 502/503/504); límite = `status` 429 o `code` que empieza con `over_`; cualquier otro error al pedir el código = `invalid_email` y al verificarlo = `wrong_code` — es lo que muestra el código de `@supabase/auth-js` 2.117 — confirmar con un email real en el paso 6.
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
