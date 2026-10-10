# Pelis By Pili 🎬

App para dos personas: cargar las películas y series que te recomiendan, verlas con sus puntajes y decidir juntos qué ver sin discutir veinte minutos.

Web instalable (PWA) pensada primero para iPhone. App en producción: https://pelis-by-pili.con-amor-nacho.workers.dev

## Qué hace

- **Una lista compartida** de películas y series ("Por ver" / "Vistas"), en tiempo real entre los dos.
- **Agregar** buscando por título (TMDB), o desde el menú Compartir de iOS con un Atajo que deja el título en una bandeja "📥 Compartidos".
- **Detalle** con sinopsis, puntajes (IMDb, Rotten Tomatoes, Metacritic, TMDB), dónde verla en Argentina y el puntaje de cada uno.
- **Cinco modos para elegir qué ver**, siempre sobre la lista "Por ver":
  - **Bumble**: swipe y match, con uno o dos celulares.
  - **Ruleta** con filtros (tipo, duración, género, plataforma, IMDb mínimo) y veto.
  - **Torneo** de a pares, hasta que queda una.
  - **Preguntas rápidas**: tiempo, género y plataforma → las 5 mejores.
  - **Top 3 secreto**: cada uno elige en secreto y se revela a la vez.
- **Sin internet**: abre con lo último guardado, y se puede marcar como vista, puntuar o anotar un título; se sincroniza al volver la conexión.
- Espacio de **dos personas**, login por código al email (sin contraseña) y 15 temas de color.

## Stack

React 19 + TypeScript + Vite (PWA) · Supabase (auth, Postgres con RLS, Realtime y Edge Functions en Deno) · TMDB y OMDb detrás de funciones del servidor, para no exponer las claves · Vitest · Cloudflare Workers (archivos estáticos).

## Empezar

Requiere Node y una cuenta de Supabase, TMDB y OMDb (todas gratis).

```bash
npm install
cp .env.example .env.local   # y completar las claves (nunca se versiona)
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests de la app |
| `npm run typecheck` / `npm run lint` | TypeScript y oxlint |
| `npm run test:security` | Tests de seguridad (RLS) contra Supabase local (`npx supabase start`, con `.env.test.local`) |
| `npm run test:security:remote` | Los mismos tests contra el Supabase de `.env.local` |
| `npm run build` | Compila a `dist/` |
| `npm run deploy` | Build → revisión de que `dist/` no filtre claves → `wrangler deploy` |

## Estructura

```
src/features/   auth, couple, titles, choose (los modos), shared, settings
supabase/       migrations/ y functions/ (tmdb-search, title-detail, share)
tests/security/ pruebas de que una persona ajena a la pareja no ve nada
scripts/        revisión previa al deploy y verificaciones
docs/           diseño, planes por etapa y decisiones
```

El diseño completo está en [`docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md`](docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md) y las decisiones que se tomaron por el camino en [`docs/superpowers/notes/2026-10-decisiones.md`](docs/superpowers/notes/2026-10-decisiones.md).

## Tablas nuevas en Supabase

En producción las tablas nuevas no reciben permisos solas: cada migración con una tabla nueva debe incluir sus `GRANT` explícitos (incluido `service_role`). Solo los tests contra el remoto lo detectan (`npm run test:security:remote`).

## Atribuciones

Datos de [TMDB](https://www.themoviedb.org) (este producto usa la API de TMDB pero no está avalado ni certificado por TMDB), plataformas de JustWatch vía TMDB, y puntajes de [OMDb](https://www.omdbapi.com) (CC BY-NC 4.0, sin afiliación con IMDb). Uso personal y no comercial.
