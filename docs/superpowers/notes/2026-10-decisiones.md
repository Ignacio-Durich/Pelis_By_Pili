# Decisiones tomadas fuera del plan (etapas 0 y 1)

Cada línea: decisión — motivo — costo si está mal.

## Organización
- Repo con un commit inicial solo de docs en `main`; el trabajo va en la rama `etapas-0-1` — no implementar directo en main — un merge.
- Orden de tareas: 1, 2 y 3 (código), 6, 7, 8; después 5, los pasos con claves de 2 y 3, y al final 4 y 9 — avanzar sin claves mientras Tomás crea las cuentas — ninguno, las interfaces no cambian.

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
- `npm run test:security` corre contra el Supabase local (`npx supabase start`, en Docker vía OrbStack) y `npm run test:security:remote` contra el proyecto real — así los tests no tocan la base donde ya están los datos de Tomás y Juli — si el stack local no está levantado, los tests fallan por conexión: `npx supabase start`.
- `.env.test.local` (ignorado por git) se genera desde `npx supabase status -o env` y copia `TMDB_API_KEY` y `OMDB_API_KEY` de `.env.local` — Vite le da prioridad sobre `.env.local` en el modo `test` — ninguno.

## Task 1
- Realtime no filtra los `DELETE` (y con RLS solo manda el `id` del borrado), así que la app escucha los `INSERT` filtrados por espacio y los `DELETE` sin filtro, y ante cualquiera vuelve a pedir la lista. Verificado en local: un tercero de otro espacio recibe solo `{ id }` de los borrados ajenos, nunca el título ni el espacio — costo: cada borrado de cualquier espacio hace que las demás apps recarguen su lista (con dos personas, nada).
- ~~Justo después de `db reset`, Realtime tarda en tomar la tabla~~ Corregido (ver Task 5, "Realtime"): la causa real era el hueco entre `SUBSCRIBED` y el momento en que el servidor empieza a escuchar la base.
- Los `db push` de las Tasks 1 y 2 se piden juntos a Tomás, para molestarlo una sola vez — ninguno.

## Task 2
- Helper de tests `src/test/providers.tsx` (`withCouple`, `tomas`, `juli`): envuelve con sesión y espacio, porque ahora varios componentes necesitan el usuario actual y los miembros — ninguno.
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
- Se salteó la prueba local con dos sesiones contra el proyecto real (Task 5, paso 5): el espacio real ya tiene a Tomás y Juli y no admite una cuenta de prueba. La cubren el test de seguridad de tiempo real contra el proyecto real y la prueba en los iPhones — costo: la primera prueba de la interfaz contra el proyecto real es la de los iPhones.

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
- Barras de rango (pedido de Tomás): dos deslizadores nativos superpuestos, sin librerías. Duración de 0 a 4 h de a 30 min (el tope es "4 h o más", sin techo); IMDb de 1 a 10 de a 1. El rango completo no filtra — ninguno.
- Ruleta animada (pedido de Tomás): rueda SVG con un gajo por título y flecha arriba; gira 5 vueltas o más en 4 s y frena en el elegido. Con hasta 12 títulos muestra los nombres (recortados a 14 caracteres); con más, solo colores. En la mitad izquierda los nombres se dan vuelta para no quedar cabeza abajo. Con "Reducir movimiento" no gira. Si la rueda no avisa que terminó (por ejemplo, la app pasó a segundo plano), el resultado aparece igual a los 4,5 s — ninguno.
- La rueda es un componente controlado (recibe la rotación y si anima; avisa al terminar) y el giro lo decide la ruleta al tocar "Girar", en vez de calcularlo dentro de la rueda con un efecto — ninguno.
- La lógica de la rueda se llama `wheelMath.ts` (mismo choque de mayúsculas que `pick.ts`) — ninguno.
- Arreglo (reportado por Tomás en el iPhone): al vetar, la rueda no volvía a girar. Causa: en la pantalla del resultado la rueda estaba dentro de otro contenedor que en la de giro, así que React la recreaba ya en su posición final y no había nada que animar. Ahora la rueda va siempre en el mismo lugar. Test que reproduce el caso (misma rueda, con transición) y verificación en el navegador midiendo el ángulo durante el giro — ninguno.
- Revisión final: regla global `[hidden] { display: none !important }`. Sin ella, la ruleta "oculta" seguía visible (su clase define `display: flex`) y el detalle abierto desde la ruleta quedaba debajo, fuera de la pantalla. Verificado en el navegador midiendo el `display` antes (flex) y después (none) — ninguno.
- Revisión final: lo elegido en géneros y plataformas siempre aparece como botón, aunque ya no quede ningún título con eso, para poder apagarlo — ninguno.
- Revisión final: con los dos extremos de una barra juntos en la mitad alta, el pulgar del mínimo queda arriba, para que se pueda volver a bajar con el dedo — ninguno.

# Hosting

- Mudanza de Netlify a Cloudflare (elegido por Tomás): Worker con archivos estáticos en vez del Pages anterior, porque Wrangler ya delega Pages a Workers y el Pages viejo es el camino que Cloudflare deja atrás (otra mudanza obligaría a reinstalar la app en los celulares) — la dirección queda `pelis-by-pili.pelis-by-pili.workers.dev`; se puede cambiar el subdominio de la cuenta más adelante, antes del regalo. El 2026-10-08 Tomás lo cambió a `con-amor-nacho`: la app queda en `pelis-by-pili.con-amor-nacho.workers.dev`.
- `scripts/check-dist.ts` (con test) reemplaza al chequeo manual de claves antes de publicar, y `npm run deploy` lo corre siempre — ninguno.
- Se borró `netlify.toml` — ya no se publica en Netlify.

# Etapa 6

- "¿Dónde lo ven?" pasa de una plataforma a varias (pedido de Tomás después de probarla en los iPhones): un título entra si está en alguna de las elegidas; "Cualquiera" borra la elección y queda marcada cuando no hay ninguna — la plataforma de la spec era una sola.
- Las preguntas rápidas sugieren 5 títulos en vez de 3 (pedido de Tomás después de probarla); el aviso de relleno y el texto del menú dicen 5 — la spec decía 3.

# Etapa 7

- Después de la primera prueba en los iPhones (pedido de Tomás): la sinopsis ya no tiene scroll propio (en iOS se quedaba con el gesto y no dejaba deslizar; con una sinopsis larga la carta se alarga y scrollea la página), y la partida entra en una pantalla de iPhone 13/15: fila única "Volver a los modos" / "Terminar", una línea chica de estado (vuelta, avance, matches), la carta con el alto que sobra, "↩️" entre 👎 y 👍, y el "¡Match!" flotando sobre la carta. Se sacó el texto "Vuelven a deslizar los matches" de la vuelta 2 (queda "Vuelta 2") — el plan no fijaba el diseño de la pantalla.

# Etapa 8

- La función `share` contesta en texto y el Atajo termina con "Mostrar notificación" de "Contenido de URL" (en vez del texto fijo "Guardado en Pelis By Pili" del plan): si la clave no sirve o la bandeja está llena, se ve el motivo y no se pierde lo compartido sin aviso (hallazgo de la revisión final).
- La guía avisa que, antes de pasar el Atajo por iCloud, hay que borrar la clave del encabezado (el link de iCloud lo abre cualquiera que lo tenga), y el paso de los tipos apunta al bloque "Recibir … de Hoja para compartir" de iOS actual.
- Después de la primera prueba en el iPhone (pedido de Tomás): el botón de cada ítem de la bandeja dice "Agregar" en vez de "Buscar" (lleva a Agregar con la nota del reel); para lectores de pantalla se llama "Agregar lo compartido", porque el "+" de la lista ya es "Agregar".
- La guía del Atajo nombra las acciones también en inglés (el iPhone de Tomás está en inglés) y el paso del menú Compartir usa el bloque "Recibir … de …" (Receive … from Nowhere) que aparece al usar "Entrada del atajo": en iOS 26 el menú del nombre ya no tiene "Detalles". Confirmado en el iPhone: "Pedir entrada" se puede mandar vacío.
- En Ajustes, debajo de la guía, "¿Te pasaron el Atajo ya armado?": solo hay que cambiar el valor de `x-share-key` por la clave propia (pedido de Tomás, que le pasa el Atajo armado a Juli).

# Limpieza (2026-10-08)

- Auditoría pedida por Tomás ("que todo funcione igual"): un solo hook para lo que se actualiza en vivo (`src/lib/useLive.ts`), un solo armado de escuchas de Realtime (`src/lib/realtime.ts`), un solo error con código y llamado a funciones SQL (`src/lib/rpc.ts`), las partidas de un celular guardadas con `readCache`/`saveCache` (ahora con dueño, así otra cuenta no ve la partida ajena; las partidas a medio jugar del momento de publicar se pierden una vez), y componentes compartidos `TitleFacts`, `PhonesChoice` y `players.ts`. Bumble y Top 3 secreto ahora también recargan al volver la conexión (como la bandeja).
- Se sacó `@vite-pwa/assets-generator` (y `pwa-assets.config.ts` y el script `generate-pwa-assets`): los íconos ya están en `public/`. Si cambia el logo: instalarlo un momento (`npm i -D @vite-pwa/assets-generator@^2.0.0`), correr `npx pwa-assets-generator` (usa `pwa-assets.config.ts`) y volver a sacarlo.
- Ícono sin el margen blanco (pedido de Tomás al verlo en su iPhone): `pwa-assets.config.ts` genera el de iPhone y el "maskable" sin margen y con el fondo azul de la app (#1b1b2f). El archivo queda en el repo con esos ajustes aunque el generador no esté instalado.

# Temas (2026-10-08)

- Pedido de Tomás: 15 temas de color para elegir en Ajustes ("Tema"), cada celular el suyo, guardado en el celular (`pelis-theme`; al reinstalar vuelve a "Azul noche", el de siempre). El ícono de inicio no cambia. Los colores viven en `src/lib/theme.ts` y se aplican como variables CSS antes de dibujar la app; los temas claros cambian `color-scheme` y usan un rojo más oscuro para los avisos. Lo que va sobre los pósters (la carta de Bumble) y el texto de las porciones de la rueda quedan fijos. Hecho directo en main y sin plan, a pedido de Tomás.


# Invitación en iPhone (2026-10-09)

- Juli abrió el enlace y le creó un espacio propio. En la base real: su cuenta y su espacio (vacío) se crearon con 23 s de diferencia, y la invitación de Tomás quedó sin usar. Causa: el enlace se abre en Safari, pero la app de la pantalla de inicio arranca en `/` y no comparte nada con Safari, así que el `?invite=` no llega. Arreglo: en la bienvenida, primero "¿Te mandaron un enlace de invitación? Pegalo acá" + "Unirme", y abajo "Crear nuestro espacio". `parseInviteToken` encuentra el enlace aunque venga con texto alrededor. No se sumó una forma de pasarse de un espacio propio al de la pareja: el espacio de Juli lo borra Tomás en el dashboard y ella vuelve a la bienvenida. Hecho directo en main.

# Mejoras de uso (2026-10-09)

Pedidos de Tomás después de usar la app, hechos directo en main:

- **Reseña:** la nota de "Tu puntaje" es un campo de 4 renglones (sigue el tope de 200 letras).
- **Agregar:** lo agregado desde esa pantalla se saca tocándolo de nuevo ("✓ Agregada · tocala de nuevo para sacarla"). Lo que ya estaba en la lista antes sigue sin poder tocarse.
- **Lista:** tocar "Lista" estando en la lista cierra Agregar o el detalle (la lista se vuelve a montar).
- **Volver:** es una pastilla con flecha (‹) arriba a la izquierda en todas las pantallas, y en Agregar también. "Terminar" de las partidas queda como texto.
- **Filtro por año de estreno:** barra 1950 → año actual; las puntas no cortan ("Hasta 1980" incluye lo anterior, "Desde 2020" los estrenos que vienen).
- **Preguntas rápidas:** preguntan "¿Qué género?" con los géneros de lo que tienen por ver (los mismos de los filtros), en vez de los 9 ánimos.
- **Director y temporadas:** columnas `director` y `seasons` en `titles` (migración `20261016000000_title_people.sql`). Las guarda title-detail: en películas, quién la dirigió; en series, quién la creó (hasta 3 nombres). La migración pone `details_updated_at` en null para que la lista los complete sola, y ahora completa hasta 30 títulos por vez (OMDb ya está cuidado por la semana de vigencia de los puntajes). Se ven en la tarjeta, el detalle, las cartas (temporadas) y los resultados de Agregar.
- **Búsqueda:**
  - Ordena por parecido con lo escrito (de a décimos) y, a igual parecido, por el orden de TMDB. Lo que casi nadie votó (menos de 5 votos) baja un escalón: así un registro duplicado que se llama igual no tapa a la película real.
  - Por si hay errores de tipeo, junto con la búsqueda principal corren hasta 4 búsquedas de repuesto (la palabra más larga cortada en dos largos, porque TMDB solo completa la última palabra, y cada otra palabra sola). De ahí entra solo lo que se parece a lo escrito.
  - Si lo escrito es un director o actor (todas las palabras en su nombre; con una parte del nombre, solo si es conocido), arriba aparece "De …" o "Con …" con lo suyo: películas dirigidas y series creadas, o donde actuó (sin entrevistas ni cameos de un capítulo), lo más votado primero.
  - Director y temporadas de los resultados llegan en un segundo pedido a la misma función, para no demorar la búsqueda.
  - La búsqueda espera 300 ms después de la última tecla (eran 400), y lo ya buscado queda en memoria mientras la app está abierta.

# Etapa 12 — Refinamiento (2026-10-09)

Plan: `docs/superpowers/plans/2026-10-09-etapa-12-refinamiento.md`. Rama `etapa-12-refinamiento`.

Se dejan, con su motivo:

- **`bumble_undo` sin revisar en la base que la vuelta siga abierta:** las vueltas se calculan en el celular a partir de los votos, así que la base no sabe cuándo terminó una. Si uno deshace justo cuando el otro termina, el otro celular vuelve un momento a la vuelta anterior y al final queda todo coherente. Arreglarlo pide guardar las vueltas en la base (una función nueva).
- **"Listo" en la ruleta de desempate antes de que el otro gire:** mostrarle al otro la última partida es una función nueva y el caso es raro.
- **Animación de salida de la carta de Bumble:** función nueva.
- **OMDb consultado dos veces al agregar un título y abrirlo enseguida:** cuesta una consulta de las 1000 por día. Evitarlo pide coordinar el completado en segundo plano con el detalle abierto.
- **Un título anotado sin red puede quedar dos veces en Compartidos** si la app se cierra justo entre mandarlo y sacarlo de la cola (o con dos pestañas en la compu): se descarta a mano. Evitarlo pide un id armado en el celular y una restricción en la base.

Decisiones tomadas al hacerla:

- **Buscador de la lista** (pedido de Tomás): arriba de "Por ver | Vistas", busca solo en la pestaña abierta, por nombre, nombre original y director, sin importar tildes ni mayúsculas; en "Por ver" se suma a los filtros. Lo escrito sigue al cambiar de pestaña o abrir un título; tocar "Lista" lo borra.
- **Comentarios:** tabla `feedback` que la app no puede leer (Tomás los ve en el panel de Supabase o pidiéndolos). Hasta 20 por persona por día y 2000 letras.
- **Tope de la bandeja (100)** ahora lo controla un trigger de la base, para el Atajo y para la app; ni el admin puede pasarlo.
- **Insert de `titles` por columnas:** la app solo puede cargar las columnas de "Agregar"; estado, fecha de vista y puntajes los escriben las funciones.
- **OMDb:** cualquier error con puntajes guardados se trata como el límite (se muestran los guardados con el aviso), y el puntaje de TMDB nuevo se guarda igual. Los datos fuera de rango de TMDB se recortan en vez de hacer fallar el guardado.
- **Búsqueda de TMDB:** solo para cuentas que están en un espacio (403 si no).
- **Aviso cuando se quita el título abierto:** dice "«X» ya no está en la lista", sin nombrar a nadie (la app no sabe quién lo quitó).
- **Pendientes:** después de 20 intentos fallidos con la app conectada (las fallas a menos de un minuto cuentan como una), un pendiente se descarta con el aviso de siempre (un error desconocido del servidor se veía como "sin red" y trababa la cola).
- **Cerrar sesión:** solo en ese celular (`scope: 'local'`), y borra del celular la lista, la pareja, la bandeja y las partidas guardadas; los pendientes quedan para cuando esa cuenta vuelva a entrar. Sin red y con el token vencido, la sesión se borra a mano (supabase-js no la borra si no pudo renovar el token); tarda unos segundos.
- **Sesión vencida:** sin cambios de código. Las tablas no responden a pedidos sin sesión (error, no lista vacía), y la app ya pide entrar cuando Supabase dice que no hay sesión; quedó un test.
- **Barras de filtros:** los nombres para lectores de pantalla son "Duración desde/hasta" (no "mínima/máxima"), y un extremo se frena un paso antes del otro.
- **Completado en segundo plano:** corre desde cada pantalla con títulos (lista y modos de Elegir), uno a la vez en toda la app, y sigue con los vistos porque el director y las temporadas se ven en "Vistas".
- **Ruleta:** con un filtro activo queda un solo contador (el de los filtros); si la pareja agrega un título después de vetar todo, se puede volver a girar.
- **Ganadora de Bumble:** carta grande con "Ver detalle" y "Listo".

**Quedan para más adelante (revisión final de la etapa 12):**
- OMDb con un error permanente ("Incorrect IMDb ID") deja la fecha vieja: ese título consulta OMDb cada vez que se abre y muestra "desactualizados" para siempre.
- El completado en segundo plano no tiene tiempo máximo: si un pedido queda colgado, no sigue hasta recargar la app.
- En el cuerpo de lo compartido queda un "(" si el link venía entre paréntesis; `pp`, `feature`, `_t` y `_r` se sacan de links de cualquier sitio, no solo TikTok y YouTube.
- La búsqueda de TMDB responde "no_couple" (403) ante una falla pasajera de la base, en vez de 500.
- El trigger de la bandeja usa `for update`; `for no key update` evitaría frenar un instante los votos y altas de esa pareja.
- El tope de 20 comentarios por día no tiene lock: dos envíos al mismo tiempo pueden dar 21.
- Cerrar sesión sin red con el token vencido tarda unos segundos sin mostrar nada.

# Etapa 13 — Recomendaciones (2026-10-19)

Pedido desde Comentarios. Diseño: `docs/superpowers/specs/2026-10-19-recomendaciones-design.md`; plan: `docs/superpowers/plans/2026-10-19-recomendaciones.md`. Rama `etapa-13-recomendaciones`.

Decisiones tomadas al hacerla:

- **Semillas de cada uno:** "Especiales para Tomás/Juli" usan las mismas 50 semillas que "Para los dos" (con el puntaje de cada uno), así las consultas a TMDB no pasan de 50 por apertura.
- **Lo que ya está en la lista no se ofrece**, aunque Descubrir venga de memoria: lo agregado no reaparece al volver a la pestaña.
- **"No me interesa", "Deshacer" y cambiar las plataformas** borran lo guardado de Descubrir; la próxima vez se pide de nuevo.
- **Una ya agregada no ofrece "No me interesa".**
- **Orden de "En sus plataformas":** primero las series que ya vieron con temporada nueva, después los estrenos y al final las temporadas nuevas de series viejas; dentro de cada grupo, por popularidad. En la revisión en pantalla, las que emiten todo el año (La Ley y el Orden, Los Simpson) tapaban los estrenos. Las ventanas de 90 días terminan hoy: lo anunciado a futuro no entra.
- **Selector de Descubrir:** cada opción del ancho de su nombre, para que "Para los dos" no se parta en dos renglones; con nombres largos pasa a otra fila. Se ve siempre, aunque no haya puntajes, para que Novedades quede a mano.
- **"Parecidas a esta" ordenadas por cantidad de votos** (pedido de Tomás): en el orden de TMDB salían primero títulos flojos (El origen → El pago, La Torre Oscura) y más abajo Tenet y Oblivion.
- **`TitleDetail` recibe la lista como opcional:** la Ruleta, las Preguntas y Bumble lo abren solo para títulos por ver, donde "Parecidas a esta" no aparece.
- **Test de búsqueda corregido:** los detalles de búsqueda ya traían duración e IMDb (cambio anterior) y el test de seguridad esperaba solo director y temporadas.

# Tráiler (2026-10-27)

Pedido desde Comentarios. "▶ Ver tráiler" debajo de la sinopsis abre YouTube. Se elige entre los videos de TMDB: primero en español latino, después cualquier español y después inglés; un tráiler antes que un teaser y uno oficial antes que otro. Si TMDB no tiene ninguno, abre la búsqueda "<título> <año> tráiler" en YouTube, así el botón siempre lleva a algún lado.

# Más del director y de los actores (2026-10-27)

Pedido desde Comentarios: que "Parecidas a esta" también recomiende por director y actores. Tomás eligió partes aparte en vez de mezclarlas con las parecidas: "Más de <director>" y "Con <actor>" para los dos actores principales.

- **De una serie cuenta quien la creó**, no quien dirigió episodios: muchos directores de cine dirigieron un episodio suelto y esa serie taparía sus películas.
- **De un actor no entran las series donde estuvo en menos de 3 episodios** (un cameo en Friends saldría primera por cantidad de votos), ni sus apariciones como sí mismo, ni los programas de todas las semanas.
- **Un título sale en una sola parte:** lo que ya está en las parecidas no se repite en la del director, y así sucesivamente.

# Revisión de pantallas, bloque 1 (2026-10-27)

Pedido desde Comentarios: revisar todas las pantallas buscando incongruencias. Tomás eligió arreglar primero las que más se notan.

- **El título de cada pestaña es su nombre:** Lista, Descubrir, Elegir y Ajustes, del mismo tamaño. "¿Qué vemos?" se fue con el título viejo de Elegir.
- **Lista no repite "Por ver" o "Vistas" como título:** ya lo dice el selector.
- **La nota de origen de Descubrir es "Descubrir"** (se lee "De dónde vino: Descubrir"). Una migración cambia las ya guardadas.
- **Top 3 secreto y Torneo piden las que se pueden elegir:** con 2 títulos, "elegí 2" (antes decía "elegí 4" con "Listo (0 de 2)"). Top 3 pasa de "elegí tus 3" a "elegí 3", igual que el Torneo.
- **"Quitar" en todos lados:** "tocala de nuevo para quitarla" y "No se pudo quitar".
- **Un puntaje sin dato no se muestra** (antes "RT —"). Si en la ficha no hay ninguno: "Todavía no hay puntajes".
- **Los canales que se contratan dentro de otra plataforma ("Paramount+ Amazon Channel") no aparecen en Filtros ni en Preguntas rápidas**, como ya pasaba en Ajustes. Los títulos guardados antes los conservan hasta que se actualicen sus datos, pero no se ofrecen para elegir.
- **"Cerrar sesión" es un botón secundario, separado de "Mandar".**
- **Nuestras plataformas muestra las conocidas y las que ya tenían elegidas; el resto con "Ver más".** Una que desmarcan no desaparece hasta volver a abrir Ajustes.

# Revisión de pantallas, bloque 2 (2026-10-27)

- **"‹ Volver a Elegir"** en vez de "Volver a los modos" (la pantalla nunca los llamaba "modos"). No queda solo "Volver": al ganador de Bumble se le puede abrir la ficha, que tiene su propio "Volver", y serían dos botones iguales.
- **La Ruleta y Preguntas rápidas explican de qué se tratan**, como los otros modos.
- **Vos y ustedes:** se revisaron y ya siguen una regla. Lo que hacen los dos va en plural ("Elijan", "Márquenla como vista"); lo de cada uno, en singular ("Probá de nuevo", "Contanos", "Tu puntaje", "Turno de Tomás: elegí 3"). No se cambió nada.
- **Los géneros se llaman igual en toda la app:** TMDB da "Suspense" y los de series en inglés ("Sci-Fi & Fantasy"); ahora se guardan con la misma tabla que usa Descubrir ("Suspenso", "Ciencia ficción y fantasía"). La tabla pasó a `title-detail/lib.ts` y una migración traduce los ya guardados.
- **La duración de una serie dice "por episodio"**, y la ficha muestra la duración como la tarjeta.
- **"Ver detalle" chico en Preguntas rápidas**, como en Descubrir: los dos van al lado de una tarjeta. En la Ruleta y Bumble sigue grande porque es un resultado solo.
- **"Ver opciones en TMDB" tiene el mismo estilo que "▶ Ver tráiler".** El ▶ del tráiler se queda (es "reproducir"); los triángulos de "Cómo armar el Atajo" son los del desplegable del sistema.
- **Sin aire de más arriba de "Sinopsis":** los párrafos de la ficha no suman margen al espacio entre elementos.

# Ruleta con 3 vetos (2026-10-27)

Pedido desde Comentarios. Cada uno tiene 3 vetos por sesión (antes 1). El botón dice cuántos le quedan ("Veto de Tomás (quedan 2)") y, sin vetos, "Tomás ya no tiene vetos". Cambiar un filtro sigue empezando una sesión nueva, con los vetos completos.

## Botones redondos para el detalle y "No me interesa" (2026-10-27)

Pedido desde Comentarios: el botón para ver la sinopsis en Descubrir no gustaba. Entre cuatro opciones se eligió la de íconos redondos al costado de la tarjeta: una "i" (en el color de acento; relleno cuando está abierta) y una ✕ para "No me interesa". Los nombres accesibles siguen siendo "Ver detalle" / "Ocultar detalle" y "No me interesa".

El mismo botón "i" va en las listas para elegir de Top 3 secreto y Torneo, que además muestran director e IMDb. La sinopsis no está guardada con el título: se pide a title-detail la primera vez que se abre y se recuerda mientras dura la lista. En esas listas se abre una sinopsis a la vez.

## Top 3 secreto: 3, 5 o 10 (2026-10-27)

Pedido desde Comentarios. Antes de elegir cuántos celulares, "¿Cuántas elige cada uno?" con 3, 5 o 10 (3 marcado de entrada). El modo sigue llamándose "Top 3 secreto"; el texto de arriba dice cuántas.

Con dos celulares la cantidad se guarda en la partida (`reveal_sessions.pick_count`, solo 3, 5 o 10) y `start_reveal(p_pick_count)` la fija; si la pareja ya tenía una partida abierta, se entra a esa con su cantidad. `submit_reveal` acepta de 1 a `pick_count` títulos, y `reveal_picks` admite hasta 10. Con un celular la cantidad viaja en la partida guardada en el celular; las guardadas antes del cambio cuentan como 3.

Con 10 de cada uno, la ruleta de desempate puede tener hasta 20 títulos; desde 13 no muestra los nombres en la rueda, como ya pasaba en la Ruleta.

## Bumble: mazo de 10, 20, 30, 50 u 80 (2026-10-27)

Pedido desde Comentarios; Nacho eligió opciones fijas hasta 80. "¿Cuántas cartas?" con 10, 20, 30, 50 y 80 (30 marcado de entrada, como antes). Si hay menos títulos que cumplan los filtros, el mazo es de los que haya. La base sube el tope del mazo de 30 a 80 (`bumble_sessions` y `start_bumble`); la cantidad no se guarda aparte porque el mazo ya la dice.

La elección "¿Cuántas…?" es un componente compartido (`CountChoice`) que usan Top 3 secreto, Bumble y el Torneo.
