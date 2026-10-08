# Pelis By Pili — Documento de diseño

Fecha: 2026-10-06
Estado: borrador para revisión

## 1. Propósito

Una app para dos personas (Nacho y su novia) donde cargar fácilmente películas y series que escuchan, piensan o ven recomendadas en redes sociales o plataformas de streaming, para verlas más adelante. Cuando llega el momento de elegir, la app ayuda a decidir de forma interactiva.

Criterio de éxito: cargar un título en pocos toques desde el celular, ver puntajes útiles (IMDb, Rotten Tomatoes) y decidir qué ver sin discutir veinte minutos. Costo: cero.

## 2. Alcance

Incluye:
- Películas y series en una sola lista compartida.
- Carga por buscador de títulos (resultados con póster, año y sinopsis).
- Puntajes externos: IMDb, Rotten Tomatoes (cuando exista), Metacritic y TMDB.
- Puntaje propio de cada persona, con nota corta opcional.
- Marcar como vista / por ver.
- Dónde verla en Argentina (plataformas).
- Cinco modos para elegir qué ver (sección 8).
- Funciona en iPhone y en compu.

No incluye en la primera versión:
- Agregar o calificar sin internet (queda como etapa 11, sección 11).
- Listas privadas por persona (todo es para ver juntos).
- Más de dos personas por espacio.
- Compartir desde otras apps con el menú de iOS (etapa 8).

## 3. Decisiones acordadas

| Tema | Decisión |
|---|---|
| Dispositivos | Celular (los dos iPhone) y compu |
| Forma de la app | Web instalable (PWA), sin App Store |
| Lista | Una sola lista compartida; cada título muestra quién lo cargó |
| Carga | Buscar por título y elegir; luego, Atajo de iOS para "Compartir" |
| Costo | Gratis |
| Contenido | Películas y series |
| Puntajes | IMDb, Rotten Tomatoes, Metacritic, TMDB, y el puntaje de cada uno |

Propuestas mías aún por confirmar en esta revisión: el login por link al email (sin contraseña), el espacio limitado a dos personas, y que Ajustes sea una pantalla aparte.

## 4. Arquitectura

- Interfaz web (React), pensada primero para celular, instalable como PWA.
- Supabase (plan gratis): cuentas, base de datos y actualización en tiempo real entre los dos.
- Función en el servidor: intermediaria con TMDB y OMDb para no exponer las claves.
- TMDB: búsqueda, pósters, sinopsis, series y plataformas.
- OMDb: IMDb, Rotten Tomatoes y Metacritic.
- Hosting gratuito (Vercel o Netlify).

Capas del código, cada una con un único trabajo: pantallas; acceso a datos (Supabase); catálogo y puntajes (TMDB y OMDb, vía la función del servidor); configuración PWA. Cambiar una fuente externa solo toca la capa del catálogo.

## 5. Datos

- Pareja: el espacio compartido (dos miembros).
- Título: ID de TMDB, tipo (película o serie), título, año, póster, quién lo cargó, nota de origen opcional, estado (por ver o visto), fecha en que se vio.
- Puntajes externos (guardados al consultarlos): IMDb, Rotten Tomatoes, Metacritic, TMDB, y fecha de última actualización. Así se cuidan las 1.000 consultas diarias de OMDb.
- Puntaje propio: una fila por persona y título, con nota corta opcional.
- Sesión de elección: modo usado, candidatas, votos o swipes de cada uno, y resultado.
- La disponibilidad en plataformas se consulta al abrir el detalle. Desde la etapa 5 (decisión confirmada por Nacho) se guarda además la lista de plataformas de suscripción y gratis de cada título, renovada como mucho cada 7 días, para poder filtrar toda la lista por plataforma.

Seguridad: solo los dos miembros de la pareja pueden leer y modificar los datos del espacio.

## 6. Servicios externos y atribuciones

- TMDB: gratis para uso no comercial con atribución (logo y la frase "This product uses the TMDB API but is not endorsed or certified by TMDB." en Ajustes). Límite aproximado: 40 consultas por segundo.
- Plataformas: datos de JustWatch vía TMDB; hay que atribuir a JustWatch.
- OMDb: clave gratuita con 1.000 consultas por día; contenido bajo licencia CC BY-NC 4.0 y sin afiliación con IMDb.

## 7. Pantallas y flujo

- Lista: arriba, "📥 Compartidos (n)" cuando hay algo que llegó del Atajo de iOS (etapa 8): nombre escrito, de dónde vino y quién lo compartió, con "Ver el link", "Agregar" (abre Agregar con la búsqueda y "de dónde vino" ya cargados) y "Descartar". Pestañas Por ver / Vistas. Cada tarjeta muestra póster, título, año, tipo, puntajes de IMDb y Rotten Tomatoes y quién la cargó. Filtros y botón "+".
- Agregar: buscador que mezcla películas y series; un toque agrega; campo opcional "de dónde vino". Si el título ya existe, avisa.
- Detalle: sinopsis, puntajes externos con fecha, dónde verla en Argentina, puntaje de cada uno, marcar vista.
- Elegir qué ver: menú con los modos.
- Ajustes: invitar a la pareja, tema de color (15 para elegir, cada celular el suyo), Atajo para compartir, cerrar sesión, atribuciones.

Primer uso: la primera persona crea el espacio e invita a la otra con un link. Solo caben dos.

## 8. Modos para elegir qué ver

El mazo de candidatas sale de la lista "Por ver", no de un catálogo general.

1. Bumble (swipe y match; nombre elegido por Nacho): cada uno desliza sobre un mazo de hasta 30 títulos, con dos celulares o pasándose uno; hay match cuando los dos eligen el mismo. Si hay varios matches, segunda vuelta solo con ellos (decisión de Nacho en la etapa 7, en lugar de la final de a pares).
2. Ruleta con filtros: filtra por película o serie, duración, género, plataforma y puntaje mínimo de IMDb; se gira; con veto.
3. Torneo de a pares: cada uno elige 4 de "Por ver" pasándose el celular (las del primero se ven y no se repiten), y las 8 se enfrentan de a pares (cuartos, semifinal y final) hasta que queda una; en cuartos, cada duelo es una de cada uno. Cada duelo se decide juntos con un toque, en un solo celular, con dos cartas grandes; se puede deshacer. Si no llegan a 8, se completa al azar con otras de "Por ver" y, si ni así, alguna pasa sola de ronda (decisiones de Nacho en la etapa 10).
4. Preguntas rápidas del momento: tiempo disponible, ánimo (uno o varios) y plataforma (una o varias); devuelve las 5 mejores de la lista según esas respuestas y los puntajes.
5. Revelación simultánea ("Top 3 secreto", nombre elegido por Nacho): cada uno elige 3 títulos de "Por ver" (sin orden) en secreto y se muestran a la vez, después de una cuenta 3, 2, 1; las coincidencias van primero. Una coincidencia gana; con varias, la ruleta entre ellas; sin ninguna, la ruleta entre todas. Con dos celulares el secreto lo cuida la base (la elección del otro no se puede leer hasta la revelación); con uno se pasan el celular sin mostrar lo elegido.

Ánimos de las preguntas rápidas (etapa 6, confirmados por Nacho) y los géneros de TMDB que cuentan para cada uno: 😂 Reírnos (Comedia, Animación, Familia, Kids), 💕 Algo romántico (Romance, Comedia, Música), 😢 Emocionarnos (Drama, Romance, Historia, Música), 💥 Adrenalina (Acción, Aventura, Action & Adventure, Bélica, War & Politics, Western), 🕵️ Intriga (Misterio, Crimen, Suspense), 🚀 Volar la cabeza (Ciencia ficción, Fantasía, Sci-Fi & Fantasy), 👻 Miedo (Terror, Suspense), 🧠 Aprender algo (Documental, Historia) y 😌 Relax (Animación, Comedia, Familia, Documental, Música, Kids, Reality), para antes de dormir o de fondo mientras estudian o trabajan. Tiempos: hasta 1 h 30, 2 h, 2 h 30 o sin apuro. Orden: más ánimos en común, mejor puntaje (IMDb, o TMDB si no hay) y más nuevo; si no llegan a 5 con el ánimo, se completa con el resto y se avisa.

Bumble (etapa 7, confirmado por Nacho): el mazo son hasta 30 títulos de "Por ver" que cumplen los filtros de la lista, mezclados al azar e iguales para los dos. Al empezar se elige "📱 Uno" (cada uno desliza el mazo entero y se pasan el celular; la partida queda solo en ese celular) o "📱📱 Dos" (partida compartida en la base, el match aparece en los dos al instante; hace falta que los dos estén en el espacio). La carta muestra póster, año, tipo, duración, géneros, IMDb, Rotten Tomatoes y plataformas, y al tocarla la sinopsis. Los votos se pueden deshacer mientras la vuelta no terminó. Con varios matches hay otra vuelta solo con ellos, hasta 3; si siguen empatados, o en una vuelta nueva no coincide ninguno, decide una ruleta cuyo resultado sale de la partida y la vuelta (los dos celulares ven la misma ganadora).

## 9. Errores

- Sin internet (desde la etapa 11): la app abre con la última cuenta, pareja y lista guardadas en el celular; se puede marcar como vista, puntuar (se ve con ⏳) y anotar un nombre con "Guardar para agregar después". Todo espera en el celular y se manda en orden al volver la conexión; lo anotado aparece en "📥 Compartidos" de los dos. Lo que ya no aplica (por ejemplo, un título que la pareja quitó) se descarta con un aviso. Sin red no se busca en TMDB, no se quitan títulos ni se juega con dos celulares; los pósters ya vistos quedan guardados.
- Falta un puntaje externo (por ejemplo, Rotten Tomatoes en una serie): se muestra "—".
- Se agotan las consultas diarias de OMDb: se usan los puntajes guardados y se avisa que hoy no se pueden actualizar.
- Sin datos de plataforma: "sin información de dónde verla".

## 10. Pruebas

- Automáticas: reglas de match, filtros de la ruleta, guardado de puntajes y orden del torneo.
- De seguridad: una persona ajena a la pareja no puede ver ni modificar la lista.
- Manual: instalación y modo pantalla completa en un iPhone real.

## 11. Etapas

Cada etapa se construye, se prueba y se cierra antes de empezar la siguiente. Claude Code no debe adelantar nada de lo que figura en "No entra".

### Etapa 0 — Preparación
- Entra: crear las cuentas gratuitas (Supabase, TMDB, OMDb, hosting), el proyecto y una app vacía instalable como PWA. Verificar los puntos de la sección 12.
- Terminada cuando: la app vacía se abre desde el ícono en los dos iPhones y las notas de verificación quedan escritas.
- No entra: login, películas ni datos.

### Etapa 1 — Cuentas y espacio de pareja
- Entra: login por link al email, crear el espacio, invitar a la pareja, límite de dos personas.
- Terminada cuando: los dos entran desde su iPhone al mismo espacio, y una tercera persona no puede entrar ni ver nada (prueba de seguridad).
- No entra: buscador ni lista.

### Etapa 2 — Agregar y ver la lista
- Entra: buscador de películas y series, agregar con un toque, nota de origen, aviso si ya existe, quién la cargó, lista "Por ver" en tiempo real.
- Terminada cuando: una persona agrega un título y a la otra le aparece sin recargar.
- No entra: puntajes, detalle, marcar vista ni filtros.

### Etapa 3 — Detalle, puntajes y plataformas
- Entra: pantalla de detalle con sinopsis, puntajes de IMDb, Rotten Tomatoes y Metacritic (guardados con fecha), dónde verla en Argentina, "—" cuando falta un dato, y las atribuciones en Ajustes.
- Terminada cuando: una película y una serie muestran sus puntajes y las atribuciones están visibles.
- No entra: marcar vista ni puntaje propio.

### Etapa 4 — Vistas y puntaje propio
- Entra: marcar como vista, pestaña "Vistas", y el puntaje y la nota de cada uno.
- Terminada cuando: cada uno califica por separado y ve el puntaje del otro.
- No entra: ningún modo para elegir qué ver.

### Etapa 5 — Filtros y ruleta
- Entra: filtros de la lista (tipo, duración, género, plataforma, puntaje mínimo) y la ruleta con veto.
- Terminada cuando: la ruleta solo sugiere títulos que cumplen los filtros.
- No entra: modos de a dos ni preguntas rápidas del momento.

### Etapa 6 — Preguntas rápidas del momento
- Entra: tiempo disponible, ánimo y plataforma; devuelve las 5 mejores de la lista (eran 3; Nacho pidió 5 después de probarla).
- Terminada cuando: devuelve 5 opciones coherentes con las respuestas.
- No entra: sesiones en tiempo real.

### Etapa 7 — Bumble (swipe y match)
- Entra: sesión compartida en tiempo real, o un solo celular que se pasan; mazo de hasta 30 títulos con cartas que muestran los datos y la sinopsis; votos que se pueden deshacer; detección de match y segunda vuelta con los matches (hasta 3 vueltas; si siguen empatados, ruleta).
- Terminada cuando: dos celulares distintos detectan el match al mismo tiempo, y también se puede jugar con uno solo.
- No entra: Atajo de iOS, revelación simultánea ni torneo.

### Etapa 8 — Atajo de iOS para "Compartir"
- Entra: el Atajo que aparece en el menú Compartir, más la guía de instalación para los dos iPhone. Como iOS no deja que una app web instalada reciba lo compartido y un Atajo abre los links en Safari (con la sesión aparte), el Atajo guarda lo compartido en una bandeja de la pareja con una clave personal, y en la app un toque abre la búsqueda ya hecha (elegido por Nacho el 2026-10-08).
- Terminada cuando: desde un reel real se llega a la búsqueda en unos 3 toques.
- No entra: revelación simultánea, torneo ni modo sin internet.

### Etapa 9 — Revelación simultánea
- Entra: top 3 secreto de cada uno y revelación a la vez, con las coincidencias primero.
- Terminada cuando: ninguno ve la elección del otro antes de la revelación.
- No entra: torneo.

### Etapa 10 — Torneo de a pares
- Entra: elegir 8 candidatas y enfrentarlas de a pares hasta que queda una.
- Terminada cuando: de 8 títulos queda un ganador en tres rondas.
- No entra: modo sin internet.

### Etapa 11 — Agregar y calificar sin internet
- Entra: guardar en el celular y sincronizar al volver la conexión.
- Terminada cuando: se agrega un título en modo avión y aparece en el otro celular al reconectar.
- No entra: nada fuera de la carga y la calificación sin conexión.

### Etapa 12 — Refinamiento
Puntos menores que dejaron las revisiones de las etapas anteriores. Se arreglan al final, después de todas las demás etapas (pedido de Nacho, 2026-10-07). Cada uno lleva su test.
- Entra, de la etapa 1:
  - "Cerrar sesión" sin internet no hace nada; debería cerrar la sesión en el celular igual (`signOut({ scope: 'local' })`).
  - Si falla "Copiar enlace", no se avisa nada (la promesa rechazada no se maneja).
  - El test de seguridad de usuarios anónimos no comprueba específicamente el permiso denegado (código `42501`).
  - Faltan tests contra la base real de un borrado directo en `couple_members` e `invites`, y de dos personas uniéndose al mismo espacio a la vez (hoy solo se probó en una base local de prueba).
  - Notas: registrar el SMTP de Gmail y las plantillas con `{{ .Token }}`, los límites del plan gratis de Netlify, y confirmar en el panel la regla de pausa de Supabase.
- Entra, de la etapa 2:
  - "Quitar" no recarga la lista por sí mismo: si el tiempo real está caído, el título sigue visible hasta que reconecta.
  - Dos cargas de la lista al mismo tiempo pueden terminar en desorden y hacer reaparecer un título borrado.
  - El nombre de la pareja no se actualiza mientras la app está abierta (el espacio se lee una sola vez).
  - Cualquier cuenta registrada, aunque no tenga espacio, puede usar la búsqueda de TMDB.
  - La consulta a TMDB no tiene tiempo límite.
  - La versión de supabase-js que usa la función de búsqueda no está fijada.
  - Los nombres guardan tabulaciones al principio o al final si se pegan así.
- Entra, de la etapa 3:
  - Si OMDb responde un error que no es el límite diario (por ejemplo, una falla puntual), se borran los puntajes guardados y quedan en "—" hasta una semana. Con puntajes guardados, debería tratarse como el límite: mostrar los guardados con el aviso.
  - Si falla el guardado de los puntajes, no queda registro y cada apertura vuelve a consultar OMDb.
  - Agregar un título y abrirlo enseguida consulta OMDb dos veces.
  - "Reintentar" en el detalle no muestra "Cargando el detalle…" mientras reintenta.
  - Con el límite de OMDb alcanzado, se descarta el puntaje de TMDB recién obtenido.
  - Accesibilidad: la tarjeta de la lista se anuncia solo como "Ver <título>"; los lectores de pantalla no leen los puntajes, quién la agregó ni la nota.
  - La versión de supabase-js en `title-detail` tampoco está fijada (mismo arreglo que en `tmdb-search`).
- Entra, de la etapa 4:
  - Un miembro puede crear un título directamente como visto, con cualquier fecha, o con puntajes externos inventados (solo en su propio espacio): el permiso de `insert` sobre `titles` cubre todas las columnas. Arreglo: permiso de `insert` solo sobre las columnas que carga la app, con su test.
  - Si el tiempo real está caído, "Marcar como vista", "Volver a Por ver" y "Guardar" no muestran el cambio hasta que reconecta, y un doble toque manda dos pedidos (mismo origen que "Quitar no recarga la lista"; arreglar juntos con un `reload` explícito).
  - "Guardado" sigue en pantalla después de volver a editar el puntaje o la nota.
  - Si la pareja quita el título que uno tiene abierto, el detalle se cierra sin aviso, se pierde lo escrito y la lista no vuelve a su posición.
  - Faltan tests de que `MyScore` conserva lo que uno está escribiendo cuando llega un cambio de la pareja, y de que el detalle se cierra si el título desaparece.
  - Accesibilidad: el aviso de puntaje inválido no está asociado al campo (`aria-describedby`) y "Guardado" no se anuncia (`role="status"`).
  - Más recargas por Realtime (puntajes y cambios de estado) hacen un poco más probable el desorden entre cargas de la lista ya anotado en la etapa 2.
- Entra, de la etapa 5:
  - Si TMDB da una duración fuera de 1–1000 minutos (existen), o más de 20 géneros o 50 plataformas, el guardado de la función de detalle falla entero sin aviso: no se guardan los puntajes, OMDb se consulta en cada apertura y el completado en segundo plano reintenta ese título siempre. Arreglo: guardar `null` o recortar las listas, y registrar el error.
  - El completado en segundo plano puede correr dos veces a la vez (al pasar de "Lista" a "Elegir" y volver, o con los dos celulares abiertos), y también renueva títulos ya vistos, que no se filtran.
  - Después de girar, la mitad de los nombres de la rueda queda cabeza abajo (el volteo se decide antes de girar).
  - Con 7 o 13 títulos, el primer y el último gajo de la rueda tienen el mismo color.
  - Lectores de pantalla: "Girando…" y el resultado de la ruleta, y el contador de filtros, no siempre se anuncian (la región `aria-live` se crea junto con el texto).
  - CSS sin uso: `.filters-panel select` y `.roulette-spin`.
  - Nombres accesibles: "Duración mínimo/máximo" debería ser "Duración mínima/máxima".
  - Una barra puede quedar en un rango vacío ("Hasta 0 min", "Hasta 1"), que nunca da resultados.
  - La pestaña "Elegir" no completa datos en segundo plano, y "No quedan títulos con estos filtros" no se actualiza si la pareja agrega uno mientras tanto.
  - Con un filtro activo, la ruleta muestra dos contadores ("3 de 12…" y "Hay 3 títulos…"), que después de un veto pueden no coincidir.
- Entra, de la etapa 6:
  - Con "Por ver" vacía, las preguntas rápidas dicen "Ningún título entra en ese tiempo y plataforma" aunque no se haya elegido nada; debería decir que no hay títulos en "Por ver".
  - Accesibilidad: las preguntas ("¿Cuánto tiempo tienen?", etc.) no agrupan sus chips (`fieldset` o `role="group"`); lo mismo en el panel de filtros.
- Entra, de la etapa 7:
  - `bumble_undo` no revisa en la base que la vuelta siga abierta: si uno deshace justo cuando el otro termina, la vuelta se reabre y el otro celular salta de "¡Ganó…!" a la vuelta anterior (al final queda todo coherente).
  - Con la ruleta de desempate, si un celular toca "Listo" antes de que el otro gire, el otro vuelve al inicio sin ver la ganadora; se podría mostrar el resultado de la última partida.
  - Accesibilidad de la carta: el `aria-label` "Ver sinopsis" tapa el título (VoiceOver no dice qué carta es) y la barra espaciadora además hace scroll.
  - La ganadora se muestra en chico (TitleCard); se podría mostrar con la carta grande y "Ver detalle".
  - La carta desaparece de golpe al votar; se podría animar la salida hacia el costado.
- Entra, de la etapa 8:
  - Limpieza de links compartidos: un punto o paréntesis pegado al final queda dentro del link; si llegan link y texto con el mismo link, el texto muestra el link crudo; faltan rastreadores de TikTok (`_t`, `_r`, `is_from_webapp`, `sender_device`) y YouTube (`pp`, `feature`).
  - El tope de 100 ítems de la bandeja cuenta y después inserta: con pedidos en paralelo se puede pasar.
  - Si falla la red al leer la fecha de la clave, Ajustes muestra "Crear mi clave"; tocarlo reemplaza la clave que ya andaba.
  - "Descartar" depende de Realtime para que el ítem desaparezca; sin conexión de Realtime queda en pantalla hasta volver a la app.
- Entra, de la etapa 9:
  - En "Cambiar mi elección", un título ya elegido que se marcó como visto sigue marcado y "Listo" termina en un error genérico; y si se entra directo a una partida con filtros que no dejan ningún título, aparece "Listo (0 de 0)" habilitado.
- Entra, de la etapa 10:
  - La carta de la ganadora del torneo es un botón deshabilitado (VoiceOver dice "botón atenuado"); mejor un elemento que no sea botón.
  - Las partidas de un celular (Bumble, Top 3 secreto, Torneo) se guardan en el celular sin fijarse de qué cuenta son: si en ese celular entra otra cuenta, ve la partida ajena. (Resuelto en la limpieza del 2026-10-08: ahora se guardan con su dueño.)
- Entra, de la etapa 11:
  - Al volver la conexión, la tarjeta vuelve un momento a como estaba (sin ⏳) hasta que llega la lista nueva.
  - Un pendiente que falla siempre con un error que no se reconoce queda trabado y frena los de atrás ("Guardando 1 cambio…" sin fin).
  - Si la sesión venció del todo, la app abre con la cuenta guardada y puede guardar listas vacías hasta volver a entrar.
  - Cerrar sesión deja en el celular la lista, la pareja y la bandeja guardadas (con dueño, así que otra cuenta no las ve).
  - Un título anotado sin red puede quedar dos veces en Compartidos si la app se cierra justo entre mandarlo y borrarlo de la cola, o con dos pestañas en la compu.
  - Los pósters guardados son respuestas "opacas" (sin CORS), que ocupan más lugar: sumar `purgeOnQuotaError` o `crossOrigin`.
- Antes del regalo: borrar la cuenta y el miembro "Pili" de prueba para que la verdadera entre con la invitación. (Hecho el 2026-10-08: Nacho la borró desde el panel; el espacio quedó con Nacho solo y sin partidas abiertas.)
- Entra, pedido de Nacho (2026-10-08): que todos los modos se puedan jugar con un solo celular, porque a veces usan uno solo de los dos. Bumble ya lo trae desde la etapa 7; la revelación simultánea y el torneo (etapas 9 y 10) conviene diseñarlos con esa opción desde el principio.
- Entra, pedido de Nacho (2026-10-08): un botón para mandar comentarios sobre la app o reportar errores.
- Terminada cuando: cada punto tiene su test y está arreglado, o hay una decisión anotada de por qué se deja.
- No entra: funciones nuevas, salvo jugar con un solo celular y el botón de comentarios.

Decisiones de orden: las etapas 0 a 4 son lo imprescindible para usar la app de verdad; los modos de un solo celular (ruleta y preguntas) van antes que los de a dos; el Atajo de iOS va después del swipe y match por decisión de Nacho, aunque técnicamente solo depende del buscador de la etapa 2.

## 12. Puntos a verificar al construir

- Con una clave real de OMDb: si devuelve Rotten Tomatoes para películas, y confirmar que para series no lo hace (un reporte de la comunidad dice que no, por razones legales; sin fecha clara).
- Con una clave real de TMDB: si hay datos de plataformas para Argentina (consultar la lista de regiones disponibles).
- Límites de los planes gratuitos de Supabase y del hosting, en especial si pausan proyectos inactivos.
- Los celulares son un iPhone 13 (Nacho, 390×844) y un iPhone 15 (Pili, 393×852), con la app instalada en la pantalla de inicio. Cada pantalla de juego tiene que entrar sin scroll en los dos, con la muesca, la barra de inicio y las pestañas de la app (pedido de Nacho en la etapa 7). Revisar a 390×844 y 393×852 antes de publicar.

## 13. Inspiración

- Watcharr (github.com/sbondCo/Watcharr): lista de visto/por ver con puntajes propios y página de descubrimiento.
- Movary (github.com/leepeuker/movary): historial, puntajes y estadísticas; instalable como PWA.
- Decide (github.com/hk21x/decide): swipe entre 2 y 4 personas, match y final de a pares; PWA con React y Framer Motion.
- Voterr (github.com/Tmirage/voterr): proponer, votar y decide quien organiza, con veto.
- Apps: Matched, WatchPick, Swatched (swipe y match en pareja), SpinFlix y Reelgood Roulette (ruleta con filtros).
