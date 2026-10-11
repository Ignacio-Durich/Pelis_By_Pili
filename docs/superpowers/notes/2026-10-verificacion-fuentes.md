# Verificación de fuentes externas

## 1. OMDb: Rotten Tomatoes en películas y series (2026-10-06)

`npx tsx --env-file=.env.local scripts/verify/omdb-ratings.ts`, con la clave gratuita real:

| Título | Response | IMDb | Rotten Tomatoes | Metacritic |
|---|---|---|---|---|
| Parasite (película, tt6751668) | True | 8.5/10 | 99% | 97/100 |
| Breaking Bad (serie, tt0903747) | True | 9.5/10 | 96% | — (null) |

Contra lo que decía el reporte de la comunidad citado en la spec, OMDb **sí** devolvió Rotten Tomatoes para una serie. Metacritic, en cambio, faltó para la serie. Es una sola muestra: puede variar según el título.

Impacto en el plan: no ocultar Rotten Tomatoes en series. Tratar los tres puntajes como opcionales en películas y en series y mostrar "—" cuando falte cualquiera (ya lo pide la spec, sección 9). Etapa 3: probar con al menos una serie más antes de cerrarla.

## 2. TMDB: región AR y proveedores (2026-10-06)

`npx tsx --env-file=.env.local scripts/verify/tmdb-providers.ts`, con la clave v3 real:

- Región `AR` en `/3/watch/providers/regions`: sí.
- Parasite (`/3/movie/496243/watch/providers`, `results.AR`): suscripción (`flatrate`) Netflix, Amazon Prime Video, MovistarTV; alquiler Apple TV Store, Google Play Movies; compra Apple TV Store, Google Play Movies.
- Breaking Bad (`/3/tv/1396/watch/providers`, `results.AR`): suscripción Netflix.

Impacto en el plan: la etapa 3 puede mostrar "dónde verla en Argentina" con `results.AR`, separando suscripción de alquiler y compra (una serie puede traer solo `flatrate`). Hay que mostrar la atribución a JustWatch (spec, sección 6). La etapa 5 puede filtrar por plataforma usando los nombres de `flatrate`.

## 3. Supabase: pausa de proyectos gratis y límite de emails (2026-10-06)

Fuente: documentación pública de Supabase, consultada el 2026-10-06. Falta confirmarlo en el panel del proyecto.

**Pausa por inactividad** ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)):

> "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week."

Según la misma página, unas pocas consultas por día a la base alcanzan para que no se pause; Supabase avisa por email al dueño alrededor de una semana antes, y un proyecto pausado se puede restaurar desde el panel durante un año.

Impacto en el plan: si pasan una semana sin abrir la app, el proyecto se pausa y la app deja de andar hasta restaurarlo a mano. Para etapas 2 a 4: el error de red (`network`) es lo que verían; conviene que el mensaje de "Sin conexión" no sea el único diagnóstico posible (anotar en la etapa 2) y, si molesta, programar una consulta diaria liviana (por ejemplo, una función programada de Netlify, gratis) — a decidir con Tomás.

**Límite de emails del servicio integrado** ([Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)):

> "Currently this value is set to 2 messages per hour."

La misma página aclara que, sin un servidor SMTP propio, Supabase solo entrega emails a direcciones que son parte del equipo de la organización del proyecto; a cualquier otra responde "Email address not authorized".

Impacto en el plan: afecta ya a la Etapa 1, no solo a las siguientes. Juli no recibiría su código salvo que (a) se la agregue como miembro del equipo de la organización de Supabase, o (b) se configure un SMTP propio gratuito (por ejemplo, Gmail con contraseña de aplicación). Con 2 emails por hora, además, la prueba de la Task 8 con tres emails y la de la Task 9 se cortan por el límite. Recomendación: SMTP propio antes de las pruebas con emails reales (Task 6, paso 6).

## Publicación (2026-10-06)

- URL: https://pelis-by-pili.netlify.app (sitio `pelis-by-pili` en Netlify, equipo de Tomás).
- Se publica con `npm run build` y `npx netlify-cli deploy --prod --no-build --dir=dist`: el build corre en la compu y toma las dos variables públicas de `.env.local`, así que no hace falta cargar variables en Netlify.
- Antes de publicar se revisó `dist/`: no contiene los nombres ni los valores de `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY` ni `OMDB_API_KEY`.
- Netlify creó el sitio con protección de acceso (respondía 401 con login de Netlify); Tomás la desactivó en Visitor access.
- Verificado con curl: `/` responde `HTTP/2 200`; el manifest tiene `"display":"standalone"` y `"short_name":"Pelis"`; `/sw.js` y el apple-touch-icon responden 200; las rutas de la SPA (`/?invite=…`, `/alguna/ruta`) responden 200.
- Prueba en los iPhones (2026-10-06, Tomás y Juli): instalada desde Safari con "Agregar a pantalla de inicio", abre a pantalla completa desde el ícono en los dos iPhones. Versiones de iOS: no informadas.

## Cierre de la Etapa 1 (2026-10-06)

- Antes de publicar: `npm test` 64/64, `npm run test:security` 11/11 contra el proyecto real, `npm run typecheck` y `npm run build` sin errores.
- Prueba de aceptación en los dos iPhones (Tomás y Juli), según Tomás, "funcionó todo": login con código de 6 dígitos desde la app instalada, creación del espacio, invitación por enlace aceptada en Safari, ingreso desde la app instalada, sesión conservada al cerrar y reabrir, cerrar sesión y volver a entrar.
- Tercera persona: probado en local (Task 8) con el mismo enlace usado → "Esta invitación no es válida o ya se usó"; y por los tests de seguridad (nadie ajeno lee ni escribe nada del espacio).
- Comportamiento esperado, no un error: quien acepta la invitación en Safari tiene que volver a pedir un código la primera vez que abre la app instalada, porque en iOS la app de la pantalla de inicio no comparte la sesión con Safari. Pasa una sola vez por persona. Posible mejora para más adelante: aceptar la invitación con un código escrito dentro de la app instalada.

## Cierre de la Etapa 2 (2026-10-07)

- Antes de publicar: `npm test` 116/116; `npm run test:security` 33/33 contra el Supabase local (seis corridas seguidas) y `npm run test:security:remote` 33/33 contra el proyecto real; typecheck y build sin errores.
- Publicado en https://pelis-by-pili.netlify.app. `dist/` sin los nombres ni los valores de las claves secretas, y sin referencias al Supabase local. La función `tmdb-search` está desplegada en el proyecto real con el secreto `TMDB_API_KEY`; responde al preflight CORS desde la URL de Netlify.
- Prueba de aceptación en los dos iPhones (Tomás y Juli), según Tomás, "funcionó todo": cada uno cargó su nombre; un título agregado por uno aparece en el otro sin recargar, con "La agregó <nombre>" y la nota; búsqueda por nombre en inglés; aviso "Ya está en la lista (la agregó …)"; la lista se pone al día al volver de segundo plano; quitar un título lo saca de los dos. Versiones de iOS: no informadas.
- La etapa queda terminada: una persona agrega un título y a la otra le aparece sin recargar.

## Cierre de la Etapa 3 (2026-10-07)

- Antes de publicar: `npm test` 148/148; `npm run test:security` 42/42 contra el Supabase local y `npm run test:security:remote` 42/42 contra el proyecto real (una sola corrida); typecheck y build sin errores.
- Publicado en https://pelis-by-pili.netlify.app. `dist/` sin claves secretas ni la URL local; el logo de TMDB se sirve en `/tmdb-logo.svg`. Función `title-detail` desplegada con `verify_jwt = false` desde `supabase/config.toml` y el secreto `OMDB_API_KEY`; responde al preflight CORS desde la URL de Netlify.
- Rotten Tomatoes en series, con las claves reales: Breaking Bad sí (96%); Dark y The Office no. Metacritic no aparece en ninguna de las tres. La app muestra "—" en esos casos.
- Prueba de aceptación en los dos iPhones (Tomás y Juli), según Tomás, "funcionó todo": puntajes en la tarjeta sin abrirla, detalle de una película y una serie con sinopsis, los cuatro puntajes con fecha y dónde verla en Argentina con "Fuente: JustWatch", y las tres atribuciones en Ajustes. Qué serie abrieron y si tenía Rotten Tomatoes: no informado.
- La etapa queda terminada: una película y una serie muestran sus puntajes y las atribuciones están visibles.

## Cierre de la Etapa 4 (2026-10-07)

- Antes de publicar: `npm test` 174/174; `npm run test:security` 54/54 contra el Supabase local y `npm run test:security:remote` 54/54 contra el proyecto real (una sola corrida); typecheck y build sin errores.
- Publicado en https://pelis-by-pili.netlify.app; `dist/` sin claves secretas ni la URL local.
- El cartel "Powered by Netlify" quedó apagado desde el panel (Project configuration → General → Powered by Netlify badge): Netlify ya no inyecta su script en la página.
- Prueba de aceptación en los dos iPhones (Tomás y Juli), según Tomás, "funcionó todo": pestañas "Por ver" y "Vistas", marcar vista y deshacer sin perder puntajes, puntajes con decimales de cada uno visibles para el otro sin recargar, aviso ante un puntaje inválido, y Ajustes sin el cartel.
- La etapa queda terminada: cada uno califica por separado y ve el puntaje del otro.

## Cierre de la Etapa 5 (2026-10-07)

- Antes de publicar: `npm test` 230/230; `npm run test:security` 57/57 contra el Supabase local y `npm run test:security:remote` 57/57 contra el proyecto real (una sola corrida, antes de los cambios de interfaz pedidos después, que no tocan la base ni las funciones); typecheck y build sin errores.
- Publicado en https://pelis-by-pili.netlify.app; `dist/` sin claves secretas ni la URL local. Función `title-detail` actualizada (guarda duración, géneros y plataformas).
- Cambios pedidos por Tomás después de la primera prueba: barras de rango para duración e IMDb, ruleta animada (rueda), y cuántos títulos cumplen los filtros. Arreglo reportado por Tomás: después de un veto la rueda no volvía a girar.
- Prueba de aceptación (Tomás, con la cuenta de prueba en un celular prestado): "Perfecto, sigamos" después de probar el arreglo del veto y el contador.
- La etapa queda terminada: la ruleta solo sugiere títulos que cumplen los filtros.

## Mudanza de hosting a Cloudflare (2026-10-07)

- Motivo: el plan gratis de Netlify pasó a créditos (300 por mes; 15 por publicación). Con las publicaciones de las etapas 0 a 5 se agotaron y Netlify frenó las publicaciones nuevas hasta el próximo ciclo (el sitio siguió en línea). Tomás comparó opciones gratis (Cloudflare, Vercel, Firebase Hosting, GitHub Pages, Render) y eligió Cloudflare.
- Wrangler 4.148 ya no crea proyectos del "Pages" anterior: Cloudflare unificó Pages en Workers. Se usa un Worker solo con archivos estáticos (`wrangler.jsonc`, sin código propio), con `not_found_handling: "single-page-application"`. Servir archivos estáticos es gratis y sin límite.
- Nueva dirección: https://pelis-by-pili.pelis-by-pili.workers.dev (el subdominio de la cuenta quedó `pelis-by-pili`); el 2026-10-08 Tomás cambió el subdominio a `con-amor-nacho` y la dirección pasó a https://pelis-by-pili.con-amor-nacho.workers.dev (la vieja deja de responder; hay que reinstalar la app en los celulares). El certificado HTTPS tardó ~60 s en estar listo después de la primera publicación.
- Publicar: `npm run deploy` (compila, corre `scripts/check-dist.ts`, que frena si `dist/` tiene nombres o valores de claves o la URL local, y publica con Wrangler). Wrangler quedó como dependencia de desarrollo; su script de instalación (`workerd`) no se aprobó y no hace falta para publicar.
- Verificado con curl: `/`, el manifest (`"display":"standalone"`, `"short_name":"Pelis"`), `/sw.js`, el apple-touch-icon, el logo de TMDB y las rutas de la app responden 200; la página carga sin errores en el navegador. Las funciones de Supabase responden al preflight CORS desde la dirección nueva.
- Pendiente: reinstalar la app en los celulares desde la dirección nueva; actualizar la URL en la configuración de la API de TMDB (opcional); borrar el sitio de Netlify cuando se confirme que todo anda.

## Cierre de la Etapa 6 (2026-10-08)

- Antes de publicar: `npm test` 256/256, `npm run test:security` 57/57 contra el Supabase local (con `supabase functions serve` levantado; sin él fallan 11 con 503), typecheck y lint sin errores. No hubo cambios en la base ni en las funciones, así que no hizo falta `db push` ni `test:security:remote`.
- Revisión visual en local (390 px): menú "¿Qué vemos?", ánimos que reordenan (Intriga trae Dark; Relax lo deja afuera), tiempo y plataforma que filtran, aviso de relleno, mensaje sin resultados y "Ver detalle" ida y vuelta.
- Publicado con `npm run deploy` en https://pelis-by-pili.con-amor-nacho.workers.dev; el bundle publicado es el mismo que el local y `dist/` no tiene claves ni la URL local.
- Cambios pedidos por Tomás después de la primera prueba: elegir varias plataformas en "¿Dónde lo ven?" y sugerir 5 títulos en vez de 3 (257/257 después de los dos).
- Prueba de aceptación (Tomás, con la cuenta de prueba en un celular prestado): "salio todo bien" en la primera prueba y "todo bien" después de los cambios.
- Revisión final (sin críticos; 2 importantes, arreglados con test que falla primero): "Volver a los modos" seguía visible con un detalle abierto y, al tocarlo, se perdían el resultado y los vetos de la ruleta o las respuestas (ahora el botón está dentro de cada modo y se oculta con él); una plataforma elegida cuyo último título desaparecía perdía su chip pero seguía filtrando (ahora se usa `withChosen`, movido a `filters.ts`, como en el panel de filtros). 259/259, typecheck y lint sin errores. Los puntos menores van a la Etapa 12.
- La etapa queda terminada: devuelve 5 opciones coherentes con las respuestas.

## Cierre de la Etapa 7 (2026-10-08)

- Antes de publicar: `npm test` 301/301, `npm run test:security` 67/67 contra el Supabase local (10 nuevos de Bumble: una partida por pareja aun con dos "Empezar" a la vez, mazo de 2 a 30 títulos de la pareja en "Por ver", votos y deshacer, cierre, lectura y escritura de ajenos, Realtime de votos y borrados), typecheck y lint sin errores.
- Tomás subió la migración `20261012000000_bumble.sql` con `db push`; `npm run test:security:remote` 67/67 en una sola corrida.
- Revisión visual en local: un celular entero, y dos celulares con una Juli local creada por script (el match apareció en vivo en el celular de Tomás al votar ella).
- Revisión final (opus): sin críticos. Arreglados con test que falla primero: "Deshacer" desaparecía si se borraba un título ya votado, un doble toque en "Deshacer" borraba dos votos, y una recarga vieja que llegaba tarde podía dejar un celular en "Esperando a Juli". Los puntos menores van a la Etapa 12.
- Publicado en https://pelis-by-pili.con-amor-nacho.workers.dev.
- Primera prueba de Tomás en los iPhones: desde la sinopsis no se podía deslizar (el reverso tenía scroll propio y iOS se quedaba con el gesto) y la partida ocupaba demasiado alto. Se rehízo la pantalla para que entre en un iPhone 13 y 15 sin scroll (306/306, medido a 390×844 y 393×852). Tomás: "Perfecto".
- La etapa queda terminada: el match aparece en dos celulares al mismo tiempo, y también se puede jugar con uno solo.

## Cierre de la Etapa 8 (2026-10-08)

- iOS no deja que una app web instalada reciba lo compartido (WebKit no soporta `share_target`) y un Atajo abre los links en Safari, con la sesión aparte: Tomás eligió una bandeja de compartidos a la que el Atajo manda lo compartido con una clave personal.
- Antes de publicar: `npm test` 329/329, `npm run test:security` 77/77 contra el Supabase local (claves, bandeja, Realtime y la función `share`), typecheck y lint sin errores.
- Tomás subió `20261013000000_shared_items.sql` con `db push`; se desplegó la función `share` (`--no-verify-jwt`). Un pedido a la función real sin `apikey` y con clave inventada respondió 401 con su mensaje: el Atajo solo necesita `x-share-key`. `npm run test:security:remote` dio 75/77 por el límite de pedidos de Auth del proyecto real; a los 6 minutos, los dos archivos afectados (shared y titles) pasaron 19/19.
- Revisión final (opus): sin críticos. Arreglado con test que falla primero: el Atajo decía "Guardado" aunque la clave no sirviera o la bandeja estuviera llena (ahora la función contesta en texto y el Atajo muestra esa respuesta), la guía avisa que hay que borrar la clave antes de pasar el Atajo por iCloud, y el paso del menú Compartir coincide con iOS actual. Los menores van a la Etapa 12.
- Prueba de aceptación (Tomás, iPhone en inglés con iOS 26): armó el Atajo con la guía (en iOS 26 el menú del nombre no tiene "Detalles": se usa el bloque "Receive … from Nowhere"), "Pedir entrada" se puede mandar vacío, un reel real llegó a la bandeja. Pedidos después de probarla: el botón dice "Agregar", la guía nombra las acciones también en inglés y explica qué cambiar en un Atajo recibido ya armado (solo la clave). Tomás: "todo anda".
- La etapa queda terminada: desde un reel real, Compartir → Pelis By Pili → Listo, y en la app "Agregar" abre la búsqueda con el reel como "de dónde vino".

## Cierre de la Etapa 9 (2026-10-08)

- "Top 3 secreto" (nombre elegido por Tomás): cada uno elige 3 de "Por ver" sin orden; una coincidencia gana, varias van a la ruleta entre ellas, ninguna a la ruleta entre todas. Con dos celulares el secreto lo cuida la base: RLS sobre `reveal_picks` (la propia, o las dos cuando se reveló), revelación automática dentro de `submit_reveal` (con `for update`) y las elecciones fuera de Realtime; con uno se pasan el celular sin mostrar lo elegido.
- Antes de publicar: `npm test` 353/353, `npm run test:security` 86/86 contra el Supabase local, typecheck y lint sin errores.
- Revisión final (opus): 2 críticos arreglados antes del `db push` (con test que falla primero): `finish_reveal` dejaba averiguar la elección del otro antes de revelar (ahora `not_revealed`; la migración se corrigió en el mismo archivo porque todavía no estaba en el proyecto real), y sin coincidencias cada celular mostraba otra ganadora (la ruleta ahora va ordenada). También: lo marcado como visto antes de revelar ya no cuenta, y un "Listo" tardío no muestra un error falso. Un menor va a la Etapa 12.
- Tomás subió `20261014000000_reveal.sql` con `db push`. `npm run test:security:remote`: el archivo de la revelación pasó entero; 5 de otros archivos cortaron por el límite de pedidos de Auth y, a los 7 minutos, couples, names y shared pasaron 29/29.
- Revisión visual en local (iPhone 13 y una altura chica para el botón fijo): un celular entero y dos con una Juli local por script (la revelación llegó sola y se guardó). Publicado en https://pelis-by-pili.con-amor-nacho.workers.dev.
- Prueba de aceptación (Tomás y la cuenta de prueba en un celular prestado): "Anduvo perfecto".
- La etapa queda terminada: ninguno ve la elección del otro antes de la revelación.

## Cierre de la Etapa 10 (2026-10-08)

- Torneo de un celular (los duelos se deciden juntos): cada uno elige 4 pasándose el celular, en cuartos cada duelo es una de cada uno, el resto se completa al azar y si no alcanza hay huecos; cuartos, semifinal y final con dos cartas grandes y "Deshacer". Sin cambios en la base ni en las funciones (no hubo `db push`).
- El selector de Top 3 secreto pasó a ser `TitlePicker` (lo usan los dos modos). La lógica se llama `bracket.ts`: en macOS `./Tournament` resolvía a `tournament.ts`.
- Antes de publicar: `npm test` 370/370, typecheck y lint sin errores; el test de la cuenta 3-2-1 de Top 3 secreto se hizo determinístico (fallaba a veces con la suite completa).
- Revisión visual en local a 390×844: con 5 títulos (huecos incluidos), las dos cartas del duelo terminan en 702 px y las pestañas empiezan en 783, sin scroll; torneo entero hasta la ganadora.
- Revisión final (opus): sin críticos; 3 importantes arreglados con test que falla primero (al recargar aparecía "No quedó ninguna candidata", un doble toque en la final podía caer en "Listo" o "Deshacer", y borrar una ganadora ya decidida revivía a la perdedora). Dos menores a la Etapa 12. 372/372.
- Publicado en https://pelis-by-pili.con-amor-nacho.workers.dev. Prueba de aceptación (Tomás en su iPhone): "perfecto".
- La etapa queda terminada: de 8 títulos queda una ganadora en tres rondas.

## Cierre de la Etapa 11 (2026-10-08)

- Sin internet la app abre con la última cuenta, pareja, lista y bandeja guardadas en el celular (al instante: sin red, postgrest-js reintenta cada lectura 1+2+4 s antes de rendirse, así que lo guardado se muestra enseguida y se reemplaza cuando contesta el servidor). Marcar vista, puntuar y "Guardar para agregar después" quedan en una cola con ⏳ y se mandan en orden al volver la conexión; lo anotado va a "📥 Compartidos" con la función nueva `add_shared_item`. Los pósters vistos quedan en el service worker.
- Antes de publicar: `npm test` 394/394, `npm run test:security` 88/88 local, typecheck y lint sin errores. Revisión visual con el gateway de Supabase local apagado (equivale a modo avión): la lista aparece en 0,2 s, los cambios quedan pendientes y al volver se mandaron (verificado en la base).
- Revisión final (opus): sin críticos. Arreglados con test que falla primero: la cola se respeta con señal mala (lo nuevo va detrás, se intenta enseguida y cada 30 s), el aviso de descartados no se pierde si sincroniza otra pantalla, "Sin conexión" al activar modo avión con la app abierta, y los modos no dicen "Sin conexión. Probá de nuevo." con la lista guardada. 400/400. Seis menores a la Etapa 12.
- Tomás subió `20261015000000_add_shared_item.sql` con `db push`. `npm run test:security:remote`: 83/88 por el límite de Auth; a los 7 minutos couples, names y shared pasaron 31/31.
- Después: limpieza pedida por Tomás (rama `limpieza`, ver decisiones), −106 líneas en `src` y una dependencia menos, sin cambiar el comportamiento (400/400, 88/88, revisión visual).
- Prueba de aceptación (Tomás, modo avión en los iPhones): "funciona todo bien".
- La etapa queda terminada: un título anotado en modo avión aparece en el otro celular al reconectar.

## Cuenta de prueba borrada (2026-10-08)

- Antes de mostrarle la app a Juli, Tomás borró desde el panel de Supabase la cuenta de prueba que usaba en un celular prestado. Comprobado leyendo el proyecto real (sin mostrar claves): 1 cuenta, el espacio con solo "Tomás" y ninguna partida abierta. Los títulos que había agregado quedan con "La agregó alguien"; sus puntajes y votos se borraron con la cuenta. Juli entra con "Invitar a mi pareja".


# Mejoras de uso (2026-10-09)

- Tomás corrió `db push` (`20261016000000_title_people.sql`); se publicaron `tmdb-search` y `title-detail`. `npm run test:security:remote`: detalle y búsqueda pasan en la corrida completa; `names` y `shared` se cortaron por el límite de inicios de sesión y pasaron solos 8 minutos después (19/19).

# Etapa 12 (2026-10-09)

- **Emails con el código:** el proyecto real manda los códigos por el SMTP de Gmail de Tomás (contraseña de aplicación, cargada por Tomás en el panel de Supabase → Authentication → SMTP; nunca en el repo). La plantilla es `supabase/templates/codigo.html` con `{{ .Token }}` (el código de 6 dígitos, no un link); la local usa la misma desde `supabase/config.toml`.
- **Hosting:** Cloudflare Workers con archivos estáticos (ya no Netlify, ver "Mudanza de hosting a Cloudflare"). Servir los archivos es gratis y sin límite; el plan gratis limita las ejecuciones de código propio (100.000 pedidos por día), que esta app no usa. Lo de Netlify (créditos por publicación) ya no aplica.
- **Pausa de Supabase:** la regla anotada en la sección 3 sigue (un proyecto gratis sin actividad por una semana se pausa, con aviso por email antes, y se restaura desde el panel). Con el uso diario de la app no debería pasar, así que no se programó una consulta diaria (la idea de la función programada de Netlify quedó sin sentido con la mudanza). Falta que Tomás lo confirme mirando el panel (Project settings → General).
