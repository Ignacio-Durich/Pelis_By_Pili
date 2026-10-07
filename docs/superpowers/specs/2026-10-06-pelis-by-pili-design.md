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
- La disponibilidad en plataformas no se guarda; se consulta al abrir el detalle.

Seguridad: solo los dos miembros de la pareja pueden leer y modificar los datos del espacio.

## 6. Servicios externos y atribuciones

- TMDB: gratis para uso no comercial con atribución (logo y la frase "This product uses the TMDB API but is not endorsed or certified by TMDB." en Ajustes). Límite aproximado: 40 consultas por segundo.
- Plataformas: datos de JustWatch vía TMDB; hay que atribuir a JustWatch.
- OMDb: clave gratuita con 1.000 consultas por día; contenido bajo licencia CC BY-NC 4.0 y sin afiliación con IMDb.

## 7. Pantallas y flujo

- Lista: pestañas Por ver / Vistas. Cada tarjeta muestra póster, título, año, tipo, puntajes de IMDb y Rotten Tomatoes y quién la cargó. Filtros y botón "+".
- Agregar: buscador que mezcla películas y series; un toque agrega; campo opcional "de dónde vino". Si el título ya existe, avisa.
- Detalle: sinopsis, puntajes externos con fecha, dónde verla en Argentina, puntaje de cada uno, marcar vista.
- Elegir qué ver: menú con los modos.
- Ajustes: invitar a la pareja, cerrar sesión, atribuciones.

Primer uso: la primera persona crea el espacio e invita a la otra con un link. Solo caben dos.

## 8. Modos para elegir qué ver

El mazo de candidatas sale de la lista "Por ver", no de un catálogo general.

1. Swipe y match: cada uno desliza sobre un mazo de 20 a 30 títulos; hay match cuando los dos eligen el mismo. Si hay varios matches, final de a pares.
2. Ruleta con filtros: filtra por película o serie, duración, género, plataforma y puntaje mínimo de IMDb; se gira; con veto.
3. Torneo de a pares: se eligen 8 candidatas y se enfrentan de a pares hasta que queda una.
4. Preguntas rápidas del momento: tiempo disponible, ánimo y plataforma; devuelve las 3 mejores de la lista según esas respuestas y los puntajes.
5. Revelación simultánea: cada uno elige su top 3 en secreto y se muestra a la vez; las coincidencias van primero.

A definir al armar el plan: cuántos vetos permite la ruleta, cómo se traduce "ánimo" a géneros y cómo se arma el mazo del swipe.

## 9. Errores

- Sin internet: se ve la lista guardada; no se puede agregar ni calificar.
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
- Entra: tiempo disponible, ánimo y plataforma; devuelve las 3 mejores de la lista.
- Terminada cuando: devuelve 3 opciones coherentes con las respuestas.
- No entra: sesiones en tiempo real.

### Etapa 7 — Swipe y match
- Entra: sesión compartida en tiempo real, mazo de 20 a 30 títulos, detección de match y final de a pares.
- Terminada cuando: dos celulares distintos detectan el match al mismo tiempo.
- No entra: Atajo de iOS, revelación simultánea ni torneo.

### Etapa 8 — Atajo de iOS para "Compartir"
- Entra: el Atajo que aparece en el menú Compartir y abre la búsqueda ya hecha, más la guía de instalación para los dos iPhone.
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
- Se suman acá los puntos menores que dejen las revisiones de las etapas 3 a 11.
- Terminada cuando: cada punto tiene su test y está arreglado, o hay una decisión anotada de por qué se deja.
- No entra: funciones nuevas.

Decisiones de orden: las etapas 0 a 4 son lo imprescindible para usar la app de verdad; los modos de un solo celular (ruleta y preguntas) van antes que los de a dos; el Atajo de iOS va después del swipe y match por decisión de Nacho, aunque técnicamente solo depende del buscador de la etapa 2.

## 12. Puntos a verificar al construir

- Con una clave real de OMDb: si devuelve Rotten Tomatoes para películas, y confirmar que para series no lo hace (un reporte de la comunidad dice que no, por razones legales; sin fecha clara).
- Con una clave real de TMDB: si hay datos de plataformas para Argentina (consultar la lista de regiones disponibles).
- Límites de los planes gratuitos de Supabase y del hosting, en especial si pausan proyectos inactivos.

## 13. Inspiración

- Watcharr (github.com/sbondCo/Watcharr): lista de visto/por ver con puntajes propios y página de descubrimiento.
- Movary (github.com/leepeuker/movary): historial, puntajes y estadísticas; instalable como PWA.
- Decide (github.com/hk21x/decide): swipe entre 2 y 4 personas, match y final de a pares; PWA con React y Framer Motion.
- Voterr (github.com/Tmirage/voterr): proponer, votar y decide quien organiza, con veto.
- Apps: Matched, WatchPick, Swatched (swipe y match en pareja), SpinFlix y Reelgood Roulette (ruleta con filtros).
