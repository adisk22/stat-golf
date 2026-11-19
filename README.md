# Stat Golf

A daily football trivia game. Each day everyone gets the same 3–5 "holes": a niche
ranking plus a target position. You make one guess per hole; your strokes are the
distance between where your guess actually ranks and the target. Lowest total wins.

The game name and all tunables live in [`lib/config.ts`](lib/config.ts).

**Stack:** Next.js (App Router, TypeScript strict) · Supabase (Postgres, Auth, RLS) ·
Tailwind · Vitest · Playwright · deployed on Vercel.

## Status

| Milestone | Scope | State |
| --- | --- | --- |
| M1 | Schema, RLS, seed, scoring module + tests | done |
| M2 | Anonymous daily play loop | done |
| M3 | Auth, account merge, stats, streaks, leaderboards | – |
| M4 | Admin (CSV import, matching, scheduler) | – |
| M5 | Archive + polish | – |
| M6 | First scraper | – |

## Setup: hosted Supabase + Vercel (no Docker)

This is the main path: GitHub Actions pushes the database, and Vercel hosts the site.
Nothing needs to run on your machine.

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com). From the dashboard, collect:

| What | Where | Used as |
| --- | --- | --- |
| Project ID (ref) | Project Settings → General | `SUPABASE_PROJECT_ID` |
| Project URL | `https://<project-id>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | Project Settings → API Keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Secret key (`sb_secret_…`) | Project Settings → API Keys | `SUPABASE_SERVICE_ROLE_KEY` (**server only**) |
| Database password | set when creating the project (Database → Settings to reset) | `SUPABASE_DB_PASSWORD` |
| Access token | [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) | `SUPABASE_ACCESS_TOKEN` |

Then, in the Supabase dashboard:

- **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins** (players
  start as guests). Email is on by default; Google comes in M3.
- **Authentication → URL Configuration:** set **Site URL** to your Vercel URL and add
  `https://<your-domain>/auth/callback` to the redirect URLs (needed from M3).
- **Authentication → Rate Limits:** the default anonymous sign-in limit is 30 per hour per
  IP; raise it if many players share a network.
- **Authentication → Attack Protection** (recommended before sharing widely): enable CAPTCHA
  with **Cloudflare Turnstile**. Create a Turnstile widget at
  [dash.cloudflare.com](https://dash.cloudflare.com) for your domain, paste its **secret key**
  here, and put its **site key** in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

### 2. GitHub: push the database

Repo **Settings → Secrets and variables → Actions**:

- **Secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- **Variables:** `SUPABASE_PROJECT_ID`, plus for the dev project only
  `SUPABASE_ENV=dev` and `SUPABASE_DEV_PROJECT_ID` (same ID).

Then **Actions → Deploy database → Run workflow**. Tick *seed* to load the fake demo puzzles.
After that, every merge to `main` that changes `supabase/migrations/` deploys automatically.

**Actions → Reset dev database** wipes the dev project, re-applies migrations and re-seeds
(the demo puzzles are dated yesterday/today/tomorrow relative to the reset). It refuses unless
`SUPABASE_ENV=dev` and you type the dev project ID.

### 3. Vercel: host the site

1. [vercel.com/new](https://vercel.com/new) → import `stat-golf` (framework: Next.js, defaults).
2. **Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key. Server-only: never prefix with `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional, see above |

3. Deploy. Vercel redeploys on every push to `main` and builds previews for PRs.

The secret key bypasses Row Level Security. It lives only in Vercel's environment and in
`lib/supabase/admin.ts`, which imports `server-only` so a client import fails the build. Never
commit it or paste it anywhere public.

### Database scripts (optional, from a terminal)

The same commands the workflows run, using `.env.local` or your shell environment
(`SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`). No Docker needed.

```bash
pnpm db:push          # link the CLI to the project and push migrations
pnpm db:push --seed   # ...and load supabase/seed.sql once
pnpm db:reset         # WIPES the project; refuses unless SUPABASE_ENV=dev and the ID matches SUPABASE_DEV_PROJECT_ID
```

### Seed data

`supabase/seed.sql` creates 26 fictional clubs, 6 fictional players, 10 questions titled
**"SAMPLE — not real data"**, and three published puzzles (yesterday, today, tomorrow,
relative to the day it runs). All names and numbers are invented. Real puzzles come from
the admin import (M4).

## Optional: local Docker stack

Only needed to run the database and e2e tests on your own machine; CI already runs them
on every PR. Requires Docker.

```bash
pnpm install
pnpm db:start          # Postgres, Auth, REST, Mailpit in Docker
pnpm env:local         # writes .env.local (with SUPABASE_ENV=dev) from the running stack
pnpm db:reset:local    # applies migrations and supabase/seed.sql
pnpm dev               # http://localhost:3000
```

If image pulls fail, set `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. To skip services
the app doesn't use:

```bash
pnpm supabase start -x studio,imgproxy,vector,logflare,supavisor,realtime,storage-api,edge-runtime,postgres-meta
```

### Tests

```bash
pnpm test        # unit tests: no database needed
pnpm test:db     # database tests against the local stack (RLS, triggers, merge, streaks)
pnpm test:e2e    # Playwright against `pnpm dev` and the local stack
pnpm typecheck
pnpm lint
```

For e2e, install a browser once with `pnpm exec playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_PATH` at an existing Chrome/Chromium. The DB and e2e tests create
throwaway users, so point them at the local stack, not the hosted project.

### Regenerating database types

```bash
pnpm db:types    # writes lib/supabase/database.types.ts from the local schema
```

## Database design

Migrations are in [`supabase/migrations`](supabase/migrations).

| Table | Purpose |
| --- | --- |
| `entities` | Everything guessable (club / player / nation), with aliases and a normalised `search_text` for fuzzy search |
| `questions` | A ranking's prompt, answer type, stat label, `value_order` (desc/asc), scope and source |
| `question_rankings` | Ranked rows for a question (competition ranking: 1, 2, 2, 4) |
| `daily_puzzles` / `daily_holes` | A date's 3–5 holes: question, target rank, par |
| `plays` / `guesses` | One play per user per date; one guess per hole |
| `profiles` | One per auth user (including anonymous); display name, admin flag, cached stats |
| `rate_limits` | Fixed-window counters used by the server |

### Security model

- **All game writes and scoring happen on the server** with the service-role key.
  Browsers can never insert plays or guesses, so they can't choose their own strokes.
- **Browsers can't read puzzles, holes or rankings.** RLS only lets a player see a
  hole's question once it's their turn (hole 1, or after guessing the previous hole), and a
  ranking only after they've guessed that hole. Future dates are never visible.
- **The autocomplete searches all entities** of the answer type
  (`public.search_entities`), so the dropdown can't leak the ranked list.
- **Integrity triggers** enforce: holes are guessed strictly in order, once, on a published,
  non-future puzzle; guesses are immutable; rankings of questions used in a published puzzle
  are locked; a puzzle can only be published with 3–5 holes, ready questions and target ranks
  that some entity actually holds; a puzzle with plays can't be unpublished.
- Server-only functions (`server_*`) are executable by `service_role` only.
- Users can change only their own `display_name`; `is_admin` and stats are server-managed.
- A daily `pg_cron` job (`app.cleanup_stale_data`) deletes anonymous users older than 30
  days that never played, and old rate-limit windows.

### Days and streaks

A "day" is a date in `ROLLOVER_TIMEZONE` (default UTC). The SQL side has a copy in
`app.rollover_timezone()`; **change both together**. A streak counts consecutive days with
a completed, non-archive play; missing a day resets the current streak to 0.

## How a round works

1. The browser signs in anonymously (after a Turnstile check when
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set).
2. `GET /api/play/today` returns the scorecard. Only the current hole carries its prompt
   and target; later holes are just `{status: "locked", holeNumber, par}`. Played holes include
   the guess and a reveal slice (target ±5 rows, plus the guess if it falls outside).
3. The autocomplete calls `GET /api/entities/search?type=club&q=…`, which searches every entity
   of that type.
4. `POST /api/play/today/guess {holeNumber, entityId}` scores the guess on the server with
   `lib/scoring.ts`, stores it, and completes the play after the last hole.

Rate limits (per user, per minute): 20 guesses, 90 searches, 120 state loads.

## Making a user an admin

Sign in once so the user and profile exist, then run this in the Supabase dashboard's
**SQL Editor**:

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Project layout

```
app/                 Next.js routes (game, archive, stats, leaderboard, admin, api)
lib/config.ts        game constants
lib/scoring.ts       pure scoring rules (server-only use)
lib/ranking.ts       competition ranking + target-rank validation
lib/supabase/        clients (admin = service role, server-only) and generated types
supabase/            config, migrations, seed
scripts/             dev scripts; scrapers/ in M6
tests/db/            database integration tests
tests/e2e/           Playwright tests
components/game/     play loop UI (scorecard, autocomplete, reveal, end screen)
lib/server/          server-only game service, auth, rate limiting
proxy.ts             refreshes the Supabase session cookie (Next 16 "proxy", formerly middleware)
```
