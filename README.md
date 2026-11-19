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
| M2 | Anonymous daily play loop | – |
| M3 | Auth, account merge, stats, streaks, leaderboards | – |
| M4 | Admin (CSV import, matching, scheduler) | – |
| M5 | Archive + polish | – |
| M6 | First scraper | – |

## Local setup

Requirements: Node 22+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start        # starts Postgres, Auth, REST, Mailpit in Docker
pnpm env:local       # writes .env.local from the running stack
pnpm db:reset        # applies migrations and supabase/seed.sql
pnpm dev             # http://localhost:3000
```

`pnpm db:start` pulls several images on the first run. If the default registry is
blocked on your network, set `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`.
To skip services the app doesn't use:

```bash
pnpm supabase start -x studio,imgproxy,vector,logflare,supavisor,realtime,storage-api,edge-runtime,postgres-meta
```

Local email (magic links) is caught by Mailpit: run `pnpm supabase status` for its URL.

### Seed data

`supabase/seed.sql` creates 26 fictional clubs, 6 fictional players, 10 questions titled
**"SAMPLE — not real data"**, and three published puzzles (yesterday, today, tomorrow,
relative to the day you run the reset). All names and numbers are invented.

### Tests

```bash
pnpm test        # unit tests (scoring, ranking helpers)
pnpm test:db     # database tests against the local stack (RLS, triggers, merge, streaks)
pnpm typecheck
pnpm lint
```

`pnpm test:db` needs the local stack running and seeded. It creates throwaway anonymous
users and plays; run `pnpm db:reset` for a clean slate.

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

## Making a user an admin

Sign in once so the user and profile exist, then run (local: `psql` on port 54322, hosted:
the Supabase SQL editor):

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Deploying

1. Create a Supabase project. Link and push the schema:
   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push
   ```
   Don't run the seed against production.
2. In the Supabase dashboard:
   - **Authentication → Sign In / Providers:** enable *Anonymous sign-ins*, *Email* (magic
     link) and *Google*.
   - **Authentication → Attack Protection:** enable CAPTCHA with **Cloudflare Turnstile** and
     paste the Turnstile secret key.
   - **Authentication → URL Configuration:** set the site URL to your Vercel domain and add
     `https://<domain>/auth/callback` as a redirect URL.
   - **Database → Extensions:** check `pg_cron` is enabled (the migration creates it).
3. In Vercel, import the repo and set the env vars from [`.env.example`](.env.example).
   `SUPABASE_SERVICE_ROLE_KEY` must be set as a server-side variable only (never
   `NEXT_PUBLIC_`).
4. Deploy.

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
tests/e2e/           Playwright tests (from M2)
```
