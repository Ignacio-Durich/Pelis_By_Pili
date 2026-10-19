# Recomendaciones — Documento de diseño

Fecha: 2026-10-19
Estado: borrador para revisión
Origen: pedido de Tomás desde Comentarios (2026-10-19): "que la app recomiende películas similares a las que vimos o que nos pueden llegar a gustar".

## 1. Propósito

Descubrir títulos nuevos para sumar a la lista, parecidos a lo que vieron y les gustó. No es para ordenar lo que ya tienen en "Por ver" (189 títulos al 2026-10-19): todo lo que ya está en la lista queda afuera.

Criterio de éxito: abrir "Descubrir", encontrar algo que les tiente y agregarlo con un toque; y, desde la ficha de algo que vieron y les encantó, ver qué más hay parecido.

## 2. Alcance

Incluye:
- Una pestaña nueva, **Descubrir**, con cuatro partes: **Para los dos**, **Especiales para Tomás**, **Especiales para Juli** y **Novedades** (en cines y en sus plataformas). Los nombres salen del nombre visible de cada uno.
- **Parecidas a esta** al final de la ficha de cada título visto.
- **Nuestras plataformas** en Ajustes, para saber qué plataformas pagan.
- **No me interesa** en cada recomendación, con **Deshacer**.
- **Ver detalle** en cada recomendación: despliega la sinopsis completa y los géneros dentro de la misma tarjeta.

No incluye:
- Ordenar o destacar lo que ya está en "Por ver".
- Una ficha completa (puntajes de IMDb, Rotten Tomatoes y Metacritic, dónde verla) para títulos que no están en la lista.
- Notificaciones de estrenos.
- Recomendaciones a partir de lo que está en "Por ver" (pesaría más lo pendiente que lo que de verdad vieron).

## 3. Decisiones acordadas

| Tema | Decisión |
|---|---|
| Para qué | Descubrir títulos nuevos, no ordenar los que ya tienen |
| Dónde | Pestaña "Descubrir" y "Parecidas a esta" en la ficha de cada vista |
| En qué se basan | Todo lo visto; pesa más lo que puntuaron mejor, y lo que puntuaron mal aleja lo parecido |
| Por persona | "Especiales para Tomás" y "Especiales para Juli", con los puntajes de cada uno |
| Novedades | En cines (cartelera de Argentina) y en sus plataformas (películas estrenadas y series con episodios nuevos en los últimos 90 días, incluidas las temporadas nuevas de series viejas) |
| Plataformas | Las eligen una vez en Ajustes, para el espacio de los dos |
| Descartar | "No me interesa", vale para los dos y no vuelve; con "Deshacer" mientras siguen en la pantalla |
| Detalle | "Ver detalle" despliega la sinopsis completa y los géneros en la tarjeta, sin consultas nuevas |
| Cálculo | Una función del servidor nueva, al abrir; sin guardar las recomendaciones (camino A) |

Caminos descartados: guardar las recomendaciones en una tabla y recalcularlas al marcar vistas o con una tarea programada (más piezas que se pueden desincronizar, sin beneficio para dos personas); calcularlas en el celular llamando a TMDB (obliga a poner la clave de TMDB en la app).

## 4. Datos

Migración nueva. Como todas: escrituras solo por funciones `security definer`, RLS activado y `grant all ... to service_role` en cada tabla nueva (en producción no se da solo).

**Plataformas del espacio.** Columna `platforms int[] not null default '{}'` en `couples`, con los IDs de proveedor de TMDB (Netflix es 8, por ejemplo); hasta 30. Se cambia con `set_platforms(p_ids int[])`, que verifica que quien llama sea miembro del espacio, saca repetidos y rechaza IDs no positivos. Cualquiera de los dos la edita. Los miembros la leen con la política que ya tiene `couples`.

**Descartes.** Tabla `dismissed_titles`:

| Columna | Tipo |
|---|---|
| `couple_id` | uuid, referencia a `couples`, borra en cascada |
| `media_type` | text, `movie` o `tv` |
| `tmdb_id` | int, positivo |
| `dismissed_by` | uuid, referencia a `auth.users`, `on delete set null` |
| `created_at` | timestamptz, `now()` |

Clave primaria `(couple_id, media_type, tmdb_id)`. Los miembros la leen (`select`); nadie escribe directo. Funciones `dismiss_title(p_media_type, p_tmdb_id)` (si ya estaba, no hace nada) y `undismiss_title(p_media_type, p_tmdb_id)`.

**Recomendaciones.** No se guardan: se calculan con lo que ya hay (títulos, puntajes, descartes y plataformas).

## 5. Función del servidor `recommendations`

Edge Function nueva, con el mismo esquema que `tmdb-search` y `title-detail`: solo acepta una sesión de usuario, y lee todo con esa sesión, así RLS le deja ver únicamente el espacio de quien llama. La lógica pura (pesos, orden, exclusiones, mezclas) va en `lib.ts` con tests de Vitest; `index.ts` solo hace las consultas.

Tres modos:

### `{ discover: true }` → las secciones de Descubrir

**Pesos.** Cada título visto es una "semilla" con un peso: puntaje − 5. Para los dos se usa el promedio de los dos puntajes, o el único que haya. Un 9 pesa +4, un 6 pesa +1 y un 3 pesa −2. Sin puntaje, la semilla no cuenta.

**Candidatos.** Para cada semilla, la primera página de `/{tipo}/{id}/recommendations` de TMDB (hasta 20, en `es-MX`), en paralelo. Cada candidato suma `peso × (1 − posición / 40)`: lo que TMDB pone más arriba suma un poco más. Un título que traen varias favoritas sube; uno que trae algo que no les gustó, baja.

**Exclusiones.** Lo que ya está en la lista (por ver o vistas), lo descartado, lo que tiene menos de 50 votos en TMDB (suelen ser títulos raros y poco confiables) y lo que termina con puntaje cero o negativo.

**Por qué.** Cada recomendación de las secciones por gusto trae las dos semillas que más sumaron: "Porque vieron Relatos salvajes y Argentina, 1985".

**Secciones.**
- **Para los dos**: las 30 mejores con los pesos de los dos.
- **Especiales para cada uno**: la misma cuenta con los puntajes de esa persona, sin las 30 de "Para los dos". Reusa las respuestas de TMDB ya pedidas. Si la persona no puntuó nada, la sección no viene.
- **En cines**: `/movie/now_playing` con `region=AR` (2 páginas), por popularidad, sin lo que ya está en la lista ni lo descartado (sin mínimo de votos: los estrenos todavía tienen pocos). Hasta 30.
- **En sus plataformas**: `/discover/movie` y `/discover/tv` con `watch_region=AR` y `with_watch_monetization_types=flatrate`, una consulta por plataforma elegida para saber en cuál está cada título. Películas: estrenadas en los últimos 90 días (`primary_release_date.gte`). Series: con algún episodio emitido en los últimos 90 días (`air_date.gte`), así entran las temporadas nuevas de series viejas (pedido de Tomás, 2026-10-19); sin programas de entrevistas, noticias, reality ni telenovelas (géneros 10767, 10763, 10764 y 10766), que emiten todas las semanas. Una serie que se estrenó antes de esos 90 días lleva la marca `newSeason` y la tarjeta dice "Temporada nueva".
  - **Series que ya vieron** (están en "Vistas"): no se sacan si salió una temporada nueva después de marcarlas como vistas (pedido de Tomás, 2026-10-19). Para saberlo, se pide su detalle a TMDB (`/tv/{id}`, una consulta por cada serie vista que aparezca): entra si la temporada más reciente ya emitida empezó después de `watched_at`. Vienen con `newSeason: true` y `watchedTitleId` (el id del título en su lista). Las series en "Por ver" siguen afuera. Se mezclan, se sacan repetidos (si está en dos, se nombran las dos), se saca lo que ya está en la lista y lo descartado, y se ordenan por popularidad. Hasta 30. Si no eligieron plataformas, viene `null` y la app invita a elegirlas en Ajustes.

Límite conocido: TMDB no dice cuándo llegó un título a una plataforma, solo cuándo se estrenó. Una película de hace un año que recién llegó a Netflix no aparece en Novedades.

### `{ similarTo: <id del título> }` → Parecidas a esta

El título tiene que estar en la lista del espacio (lo comprueba RLS). Primera página de `/{tipo}/{id}/recommendations`; si viene vacía, `/{tipo}/{id}/similar`. Sin lo que ya está en la lista ni lo descartado, y sin mínimo de votos. Hasta 20, en el orden de TMDB.

### `{ providers: true }` → plataformas para Ajustes

`/watch/providers/movie` y `/watch/providers/tv` con `watch_region=AR`, unidas, ordenadas por `display_priority`, hasta 30, con nombre y logo. Así la clave de TMDB no sale del servidor.

### Qué devuelve

Cada título con el formato de los resultados de búsqueda (`SearchResult`), más:
- `genres`: nombres de los géneros (mapa fijo de los IDs de TMDB en `lib.ts`; los IDs de TMDB no cambian);
- `because`: hasta dos nombres de semillas (solo en las secciones por gusto);
- `platforms`: nombres de las plataformas (solo en "En sus plataformas");
- `newSeason`: `true` si es una serie vieja con episodios nuevos (solo en "En sus plataformas");
- `watchedTitleId`: el id en su lista, si es una serie que ya vieron y tiene temporada nueva.

```ts
type Recommendation = SearchResult & { genres: string[]; because?: string[]; platforms?: string[]; newSeason?: boolean; watchedTitleId?: string }
type Discover = {
  forBoth: Recommendation[]
  forEach: { userId: string; name: string; results: Recommendation[] }[]
  inTheaters: Recommendation[]
  onPlatforms: Recommendation[] | null
}
```

### Costo y errores

- Descubrir: una consulta a TMDB por título visto con puntaje (24 hoy, hasta 50), más 2 de cines y 2 por plataforma. TMDB no tiene límite diario.
- Ninguna consulta a OMDb en la función. La duración y el IMDb de las tarjetas se piden con `searchDetails`, como en Agregar, solo para las que están a la vista: unas 50 consultas de OMDb por apertura de Descubrir (de las 1.000 por día; hoy se gastan unas 125).
- Si falla la consulta de una semilla o de una plataforma, se sigue sin ella. Si falla todo, responde 502.
- Las semillas se limitan a 50 (las de mayor peso, en valor absoluto; decisión de Tomás, 2026-10-19) para que la espera no crezca con la lista de vistas.

## 6. Pantallas

**Barra de abajo.** Cuatro pestañas: Lista · Descubrir · Elegir · Ajustes.

**Descubrir.**
- Arriba, un selector como el de "Por ver / Vistas": Para los dos · Tomás · Juli · Novedades. Si una persona no puntuó nada, su opción no aparece.
- En Novedades, dos subtítulos: "En cines" y "En sus plataformas" (con las plataformas elegidas debajo del subtítulo).
- Cada sección muestra 10 tarjetas; "Ver más" suma 10, hasta 30.
- Estados: "Buscando recomendaciones…"; sin vistas con puntaje: "Cuando marquen títulos como vistos y les pongan puntaje, acá van a aparecer recomendaciones"; sin conexión: el mismo aviso que en Agregar; error: "No se pudieron cargar las recomendaciones" con "Reintentar".

**Tarjeta de recomendación.**
- Como en Agregar: póster, título, año y tipo, duración, director, IMDb. Debajo, "Porque vieron …" o la plataforma (y "Temporada nueva" si corresponde), según la sección.
- Tocarla la agrega a "Por ver" y muestra "✓ Agregada · tocala de nuevo para sacarla". Se agrega con una nota de origen: "De Descubrir" o "Parecida a <título>".
- Una serie que ya vieron con temporada nueva no se agrega: dice "Ya la vieron · salió una temporada nueva" y tocarla abre su ficha. No tiene "No me interesa".
- Debajo, dos botones chicos: **Ver detalle** (despliega la sinopsis completa y los géneros; pasa a "Ocultar detalle") y **No me interesa** (la tarjeta pasa a "Descartada · Deshacer" hasta salir de la pantalla).

**Memoria.** Las recomendaciones quedan en memoria mientras la app está abierta. Se vuelven a pedir solas si cambió algo que las afecta: la lista de vistas o algún puntaje. Lo que agregan o descartan desaparece en el momento, sin volver a calcular.

**Ficha de un título visto.** Al final, "Parecidas a esta": las mismas tarjetas, 10 y "Ver más". Se pide al abrir la ficha, solo en vistas.

**Ajustes → Nuestras plataformas.** Las de Argentina con logo, en dos columnas, para marcar y desmarcar; se guardan al tocarlas. Texto: "Las que pagan. Se usan en Novedades."

Las pantallas tienen que verse bien a 390×844 y 393×852. Descubrir y la ficha scrollean (no son pantallas de juego).

## 7. Errores

- Sin conexión: Descubrir y "Parecidas a esta" muestran el aviso y no piden nada.
- Agregar o descartar sin red, o si falla: el mismo mensaje que hoy en Agregar; la tarjeta vuelve a su estado anterior.
- Si `searchDetails` falla, las tarjetas se ven sin duración ni IMDb.
- Si OMDb se queda sin consultas del día, las tarjetas salen sin IMDb y las fichas muestran los puntajes guardados.

## 8. Pruebas

- `recommendations/lib.ts` (Vitest): pesos (promedio, uno solo, sin puntaje), suma con posición, que lo mal puntuado reste, exclusiones (lista, descartes, pocos votos, negativos), "porque vieron", que las de cada uno no repitan las de los dos, mezcla de plataformas con repetidos, mapa de géneros.
- Pantallas (Testing Library): selector y secciones, "Ver más", agregar con nota de origen, "No me interesa" y "Deshacer", "Ver detalle", estados vacío, cargando, sin conexión y error, persona sin puntajes, sin plataformas; "Parecidas a esta" solo en vistas; Ajustes marca y desmarca.
- Seguridad (`test:security`, local y remoto): `dismissed_titles` solo legible por los miembros y sin escritura directa; `dismiss_title`, `undismiss_title` y `set_platforms` rechazan a quien no es del espacio; la función rechaza pedidos sin sesión y `similarTo` de un título de otro espacio.
- Revisar a 390×844 y 393×852.

## 9. Puntos a verificar al construir

- Que `/movie/now_playing?region=AR` traiga la cartelera de Argentina y no la de otro país.
- Que `/discover` con `watch_region=AR` y `with_watch_providers` devuelva títulos para las plataformas de Argentina, y que `air_date.gte` en series traiga las que tuvieron episodios en ese rango (incluidas temporadas nuevas de series viejas).
- Cuánto tarda Descubrir con 24 semillas; si pasa de 3 segundos, bajar el tope de semillas.
- Consumo real de OMDb los primeros días; si se acerca al límite, guardar los puntajes de IMDb en una tabla y consultar OMDb una sola vez por título.
