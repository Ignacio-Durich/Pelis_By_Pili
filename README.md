# Pelis By Pili 🎬

[![CI](https://github.com/Ignacio-Durich/Pelis_By_Pili/actions/workflows/ci.yml/badge.svg)](https://github.com/Ignacio-Durich/Pelis_By_Pili/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A movie and TV watchlist for two. Save what friends, reels and streaming apps recommend, see how it rates, and decide together what to watch tonight without arguing for twenty minutes.

It's an installable web app (PWA) built mobile-first for iPhone, and it's in daily use by the two people it was made for. The app is in Spanish, and so are the commits and docs.

**Live:** https://pelis-by-pili.con-amor-nacho.workers.dev (private and invite-only, so you'll only see the sign-in screen).

## Features

- **One shared list** of movies and series ("to watch" and "watched"), synced in real time between both phones.
- **Add in a tap** by searching TMDB, or straight from the iOS Share menu: an iOS Shortcut drops the title into a shared inbox.
- **Title detail:** synopsis, IMDb, Rotten Tomatoes, Metacritic and TMDB scores, where to stream it in Argentina, and each person's own rating and note.
- **Five ways to decide what to watch,** all drawn from the "to watch" list:
  - **Bumble:** swipe and match on one phone or two, with a run-off round when there are several matches.
  - **Roulette:** filter by type, runtime, genre, platform and minimum IMDb score, spin, and veto.
  - **Tournament:** each person picks four, then the eight face off in brackets until one is left.
  - **Quick questions:** answer how much time you have, which genres and which platforms, and get the top 5.
  - **Secret top 3:** each person picks in secret and both picks are revealed at once. With two phones, the database keeps the other pick unreadable until the reveal.
- **Works offline:** it opens with the last saved list, lets you mark as watched, rate or jot down a title, and syncs in order when the connection comes back.
- **Sign-in with an emailed 6-digit code** (no passwords), a couple space capped at two people, and 15 color themes.

## How it was built

I designed the product and made the calls (every off-plan decision is in the [decisions log](docs/superpowers/notes/2026-10-decisiones.md)). The code was written with [Claude Code](https://claude.com/claude-code), following a deliberate workflow:

1. **Spec first.** One [design document](docs/superpowers/specs/2026-10-06-pelis-by-pili-design.md) sets scope, data, screens, error handling and **13 stages**. Each stage lists what's in, what's out, and when it counts as done.
2. **A plan per stage.** Every stage got its own [implementation plan](docs/superpowers/plans/) before any code, and was built, tested and closed before the next one started.
3. **Test-driven.** Each feature and fix starts with a failing test. There are 480+ unit and component tests (Vitest and Testing Library).
4. **Security tested against a real database.** A separate suite runs against local Supabase and against production. It proves that someone outside the couple can't read or change anything, that a third person can't join, and that a secret pick stays secret.
5. **Review and real-device acceptance.** Each stage ended with a whole-branch code review and an acceptance test on both iPhones ([verification notes](docs/superpowers/notes/2026-10-verificacion-fuentes.md)). The leftover minor issues were collected and fixed in a final refinement stage.

## Architecture

```
iPhone / browser (React PWA, offline queue + cached posters)
        │
        ├── Supabase Auth ── email code sign-in
        ├── Postgres + RLS ── all data, scoped to the couple; Realtime for live sync
        └── Edge Functions (Deno) ── tmdb-search · title-detail · share
                 │
                 └── TMDB (search, posters, platforms) · OMDb (IMDb / RT / Metacritic)
```

- **API keys never reach the browser.** TMDB and OMDb are called only from Edge Functions, and `npm run deploy` refuses to publish if a secret key name or value shows up in `dist/`.
- **Authorization lives in the database.** Row-level security scopes every table to the couple. The two-person limit and the secret top 3 are enforced in SQL, not just in the UI.
- **Free-tier friendly.** External scores are cached with a timestamp to stay under OMDb's 1,000 requests a day. Hosting is static files on Cloudflare Workers.

## Tech stack

React 19 · TypeScript · Vite · vite-plugin-pwa · Supabase (Auth, Postgres, RLS, Realtime, Edge Functions) · TMDB and OMDb APIs · Vitest · Testing Library · oxlint · Cloudflare Workers

## Running it locally

You'll need Node and free accounts on Supabase, TMDB and OMDb.

```bash
npm install
cp .env.example .env.local   # fill in your keys (never committed)
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit and component tests |
| `npm run typecheck` / `npm run lint` | TypeScript and oxlint |
| `npm run test:security` | Security suite against local Supabase (`npx supabase start`, uses `.env.test.local`) |
| `npm run test:security:remote` | Same suite against the Supabase project in `.env.local` |
| `npm run deploy` | Build → check `dist/` for leaked secrets → `wrangler deploy` |

New tables need explicit `GRANT`s in their migration, `service_role` included: production doesn't grant them automatically, and only the remote security suite catches it.

## Project structure

```
src/features/   auth, couple, titles, choose (the five modes), shared, settings
supabase/       migrations/ and functions/ (tmdb-search, title-detail, share)
tests/security/ the database-level security suite
scripts/        pre-deploy leak check and verification scripts
docs/           spec, per-stage plans, decisions and verification notes
```

## Attributions

This product uses the [TMDB](https://www.themoviedb.org) API but is not endorsed or certified by TMDB. Streaming availability comes from JustWatch via TMDB. Scores come from [OMDb](https://www.omdbapi.com) (CC BY-NC 4.0), which isn't affiliated with IMDb. Personal, non-commercial use.

## License

The code is [MIT](LICENSE). Data from TMDB, JustWatch and OMDb stays under their own terms.
