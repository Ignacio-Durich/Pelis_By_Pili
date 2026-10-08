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

## Task 1
- Realtime no filtra los `DELETE` (y con RLS solo manda el `id` del borrado), así que la app escucha los `INSERT` filtrados por espacio y los `DELETE` sin filtro, y ante cualquiera vuelve a pedir la lista. Verificado en local: un tercero de otro espacio recibe solo `{ id }` de los borrados ajenos, nunca el título ni el espacio — costo: cada borrado de cualquier espacio hace que las demás apps recarguen su lista (con dos personas, nada).
- ~~Justo después de `db reset`, Realtime tarda en tomar la tabla~~ Corregido (ver Task 5, "Realtime"): la causa real era el hueco entre `SUBSCRIBED` y el momento en que el servidor empieza a escuchar la base.
- Los `db push` de las Tasks 1 y 2 se piden juntos a Nacho, para molestarlo una sola vez — ninguno.

## Task 2
- Helper de tests `src/test/providers.tsx` (`withCouple`, `nacho`, `pili`): envuelve con sesión y espacio, porque ahora varios componentes necesitan el usuario actual y los miembros — ninguno.
- En Ajustes, si a alguno de los dos le falta el nombre, la frase queda sin nombres ("Son dos personas en este espacio") en vez de mostrar un hueco — ninguno.
- `getMyCouple` devuelve el tipo `Couple` de `coupleContext.ts` en vez de repetirlo — ninguno.

## Task 3
- Si un título solo aparece buscando en inglés, se muestra y se guarda con el nombre en inglés ("Parasite" y no "Parásitos") — evitar una consulta extra a TMDB por cada resultado — si molesta, pedir el detalle en `es-MX` al agregar.
- La función responde 502 si falla cualquiera de las tres consultas a TMDB, en vez de devolver resultados parciales — más simple, y TMDB rara vez falla en un idioma solo — una búsqueda que podría haber mostrado algo muestra "No se pudo buscar".

## Task 5
- Si lo escrito coincide exacto con algún nombre del título (latino, España, inglés u original; sin importar mayúsculas ni acentos), ese resultado va primero. Agregado al ver en la prueba local que "mi pobre angelito" dejaba la original sexta, debajo de las secuelas — si molesta en algún caso, sacar ese criterio del orden.
- El Supabase local usa la misma plantilla de email con `{{ .Token }}` que el proyecto real (`supabase/templates/codigo.html`, configurada en `supabase/config.toml`), para poder entrar a la app en local con el código que llega al buzón local (Mailpit) — ninguno.
- `npx vite --mode test` levanta la app contra el Supabase local (usa `.env.test.local`) — ninguno.
- La lista se pide al montar y además cada vez que Realtime se (re)conecta; al arrancar se pide dos veces — más simple que coordinar las dos — una consulta de más al abrir.
- **Realtime:** el canal avisa `SUBSCRIBED` al unirse, pero el servidor empieza a escuchar la base un momento después y lo avisa con un mensaje de sistema ("Subscribed to PostgreSQL"; medido: ~8 ms sin carga, más con carga). Un título agregado en ese hueco no llegaba. La app ahora recarga la lista con ese aviso y no con `SUBSCRIBED`, y el test de seguridad espera lo mismo. Antes del cambio el test fallaba de forma intermitente (con la suite completa y siempre tras reiniciar la base); después, 6 de 6 corridas seguidas en verde, incluida la primera tras reiniciar — ninguno.
- En `supabase/config.toml` (solo el Supabase local) `sign_in_sign_ups` sube de 30 a 1000 cada 5 minutos: cada corrida de los tests de seguridad hace entrar a ~15 usuarios. Contra el proyecto real conviene correrlos de a una vez: la cuarta corrida seguida chocó con el límite de Supabase — ninguno.
- Se salteó la prueba local con dos sesiones contra el proyecto real (Task 5, paso 5): el espacio real ya tiene a Nacho y Pili y no admite una cuenta de prueba. La cubren el test de seguridad de tiempo real contra el proyecto real y la prueba en los iPhones — costo: la primera prueba de la interfaz contra el proyecto real es la de los iPhones.

# Etapa 3

## Tasks 1 a 5
- `tmdb_rating` (numeric en Postgres) se convierte con `Number()` al leerlo, porque puede llegar como texto — ninguno.
- La tarjeta de la lista es un botón con nombre accesible "Ver <título>", para distinguirlo del botón "Quitar <título>" — ninguno.
- Mientras carga el detalle, o si falla, se muestran los puntajes guardados en la lista; la sinopsis y las plataformas aparecen cuando responde la función — ninguno.
- Si OMDb no responde (red o tiempo), la función lo trata como el límite diario: devuelve los puntajes guardados con el aviso "Hoy no se pudieron actualizar los puntajes" y no cambia la fecha — ninguno.
- Entorno local: después de `npx supabase db reset`, Kong deja de servir las plantillas de email y el código llega con la plantilla por defecto (con link). Lo arregla `npx supabase stop && npx supabase start`. No afecta los tests ni el proyecto real — ninguno.

# Etapa 4

- El test de puntajes en tiempo real busca el evento esperado entre los recibidos, en vez de asumir que es el primero: llegaban cambios de tests anteriores con demora — ninguno.
- `AddTitle` solo distingue "ya está en la lista" de cualquier otro error (que se muestra como "No se pudo agregar") — ninguno.
- El detalle abierto se elige por `id` y toma siempre la versión más nueva del título de la lista: al marcar vista o puntuar, la pantalla se actualiza sola por Realtime. Si el título se quita, el detalle se cierra — ninguno.
- En las tarjetas de "Vistas" se muestra la fecha y los puntajes en lugar de "La agregó" y la nota de origen, que siguen en el detalle — ninguno.
- Revisión final: `title_scores` pasa a tener una clave propia al azar (`id`), con `(title_id, user_id)` como `unique`. Realtime manda la clave de cada fila borrada a cualquier suscriptor, y con la clave anterior un ajeno veía ids de usuarios de otros espacios. Reproducido con un test antes de corregirlo — ninguno.
- Revisión final: si todo lo de la lista ya se vio, "Por ver" dice "No queda nada por ver" (el plan no fijaba ese texto); "Nuestra lista está vacía" queda para cuando no hay ningún título — ninguno.

# Etapa 5

- La función de detalle guarda duración, géneros y plataformas en cada apertura (TMDB ya se consultó), no solo cada 7 días como los puntajes — ninguno.
- Helper de tests `src/test/titles.ts` (`makeTitle`) para los títulos de ejemplo nuevos — ninguno.
- Hook `useTitles` (cargar y seguir la lista), extraído de `TitleList` para que lo use también la ruleta — ninguno.
- La función pura de la ruleta se llama `pick.ts` y no `roulette.ts`: en macOS el sistema de archivos no distingue mayúsculas y `./Roulette` resolvía al archivo equivocado — ninguno.
- La ruleta queda oculta (no desmontada) mientras se ve el detalle de su resultado, para no perder el resultado ni los vetos; y una sesión por combinación de filtros (`key`), así cambiar un filtro renueva los vetos — ninguno.
- La plataforma "Universal+ Amazon Channel" y similares aparecen tal como las da TMDB/JustWatch — si molestan, se pueden ocultar más adelante.
- Barras de rango (pedido de Nacho): dos deslizadores nativos superpuestos, sin librerías. Duración de 0 a 4 h de a 30 min (el tope es "4 h o más", sin techo); IMDb de 1 a 10 de a 1. El rango completo no filtra — ninguno.
- Ruleta animada (pedido de Nacho): rueda SVG con un gajo por título y flecha arriba; gira 5 vueltas o más en 4 s y frena en el elegido. Con hasta 12 títulos muestra los nombres (recortados a 14 caracteres); con más, solo colores. En la mitad izquierda los nombres se dan vuelta para no quedar cabeza abajo. Con "Reducir movimiento" no gira. Si la rueda no avisa que terminó (por ejemplo, la app pasó a segundo plano), el resultado aparece igual a los 4,5 s — ninguno.
- La rueda es un componente controlado (recibe la rotación y si anima; avisa al terminar) y el giro lo decide la ruleta al tocar "Girar", en vez de calcularlo dentro de la rueda con un efecto — ninguno.
- La lógica de la rueda se llama `wheelMath.ts` (mismo choque de mayúsculas que `pick.ts`) — ninguno.
- Arreglo (reportado por Nacho en el iPhone): al vetar, la rueda no volvía a girar. Causa: en la pantalla del resultado la rueda estaba dentro de otro contenedor que en la de giro, así que React la recreaba ya en su posición final y no había nada que animar. Ahora la rueda va siempre en el mismo lugar. Test que reproduce el caso (misma rueda, con transición) y verificación en el navegador midiendo el ángulo durante el giro — ninguno.
- Revisión final: regla global `[hidden] { display: none !important }`. Sin ella, la ruleta "oculta" seguía visible (su clase define `display: flex`) y el detalle abierto desde la ruleta quedaba debajo, fuera de la pantalla. Verificado en el navegador midiendo el `display` antes (flex) y después (none) — ninguno.
- Revisión final: lo elegido en géneros y plataformas siempre aparece como botón, aunque ya no quede ningún título con eso, para poder apagarlo — ninguno.
- Revisión final: con los dos extremos de una barra juntos en la mitad alta, el pulgar del mínimo queda arriba, para que se pueda volver a bajar con el dedo — ninguno.

# Hosting

- Mudanza de Netlify a Cloudflare (elegido por Nacho): Worker con archivos estáticos en vez del Pages anterior, porque Wrangler ya delega Pages a Workers y el Pages viejo es el camino que Cloudflare deja atrás (otra mudanza obligaría a reinstalar la app en los celulares) — la dirección queda `pelis-by-pili.pelis-by-pili.workers.dev`; se puede cambiar el subdominio de la cuenta más adelante, antes del regalo. El 2026-10-08 Nacho lo cambió a `con-amor-nacho`: la app queda en `pelis-by-pili.con-amor-nacho.workers.dev`.
- `scripts/check-dist.ts` (con test) reemplaza al chequeo manual de claves antes de publicar, y `npm run deploy` lo corre siempre — ninguno.
- Se borró `netlify.toml` — ya no se publica en Netlify.

# Etapa 6

- "¿Dónde lo ven?" pasa de una plataforma a varias (pedido de Nacho después de probarla en los iPhones): un título entra si está en alguna de las elegidas; "Cualquiera" borra la elección y queda marcada cuando no hay ninguna — la plataforma de la spec era una sola.
- Las preguntas rápidas sugieren 5 títulos en vez de 3 (pedido de Nacho después de probarla); el aviso de relleno y el texto del menú dicen 5 — la spec decía 3.

# Etapa 7

- Después de la primera prueba en los iPhones (pedido de Nacho): la sinopsis ya no tiene scroll propio (en iOS se quedaba con el gesto y no dejaba deslizar; con una sinopsis larga la carta se alarga y scrollea la página), y la partida entra en una pantalla de iPhone 13/15: fila única "Volver a los modos" / "Terminar", una línea chica de estado (vuelta, avance, matches), la carta con el alto que sobra, "↩️" entre 👎 y 👍, y el "¡Match!" flotando sobre la carta. Se sacó el texto "Vuelven a deslizar los matches" de la vuelta 2 (queda "Vuelta 2") — el plan no fijaba el diseño de la pantalla.
