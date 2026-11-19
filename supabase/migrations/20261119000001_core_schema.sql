-- Stat Golf core schema: entities, questions, rankings, puzzles, plays, guesses, profiles.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.entity_type as enum ('club', 'player', 'nation');
create type public.question_status as enum ('draft', 'ready');
create type public.value_order as enum ('desc', 'asc');

-- ---------------------------------------------------------------------------
-- App settings shared by SQL. Keep in sync with lib/config.ts.
-- ---------------------------------------------------------------------------

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

create or replace function app.rollover_timezone()
returns text language sql immutable parallel safe
set search_path = ''
as $$ select 'UTC'::text $$;

create or replace function app.max_strokes_per_hole()
returns int language sql immutable parallel safe
set search_path = ''
as $$ select 15 $$;

-- The current puzzle date in the rollover timezone.
create or replace function app.puzzle_today()
returns date language sql stable parallel safe
set search_path = ''
as $$ select (now() at time zone app.rollover_timezone())::date $$;

-- Lowercase, strip accents, collapse punctuation to single spaces.
-- Two-argument unaccent with an explicit dictionary is immutable, which lets us index it.
create or replace function app.normalize_name(t text)
returns text language sql immutable parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
    '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function app.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- entities
-- ---------------------------------------------------------------------------

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  sport text not null default 'football',
  type public.entity_type not null,
  name text not null check (length(trim(name)) > 0),
  aliases text[] not null default '{}',
  disambiguation text,          -- e.g. "Brazil, b. 1976" to tell same-named players apart
  country text,
  external_ids jsonb not null default '{}'::jsonb,
  search_text text not null default '',   -- maintained by trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entities_sport_type_idx on public.entities (sport, type);
create index entities_search_trgm_idx on public.entities using gin (search_text extensions.gin_trgm_ops);
create unique index entities_unique_name_idx
  on public.entities (sport, type, app.normalize_name(name), coalesce(disambiguation, ''));

create or replace function app.entities_before_write()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.aliases := coalesce(
    (select array_agg(distinct trim(a)) from unnest(new.aliases) a where length(trim(a)) > 0),
    '{}');
  new.search_text := app.normalize_name(new.name || ' ' || array_to_string(new.aliases, ' '));
  new.updated_at := now();
  return new;
end $$;

create trigger entities_before_write
before insert or update on public.entities
for each row execute function app.entities_before_write();

-- ---------------------------------------------------------------------------
-- questions + rankings
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  sport text not null default 'football',
  prompt text not null check (length(trim(prompt)) > 0),
  answer_type public.entity_type not null,
  stat_label text not null check (length(trim(stat_label)) > 0),
  value_order public.value_order not null default 'desc',
  scope_note text,
  source_name text,
  source_url text,
  data_as_of date,
  status public.question_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger questions_touch before update on public.questions
for each row execute function app.touch_updated_at();

create table public.question_rankings (
  question_id uuid not null references public.questions (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete restrict,
  rank int not null check (rank > 0),
  value numeric not null,
  primary key (question_id, entity_id)
);

create index question_rankings_rank_idx on public.question_rankings (question_id, rank);
create index question_rankings_entity_idx on public.question_rankings (entity_id);

-- ---------------------------------------------------------------------------
-- daily puzzles
-- ---------------------------------------------------------------------------

create table public.daily_puzzles (
  date date primary key,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger daily_puzzles_touch before update on public.daily_puzzles
for each row execute function app.touch_updated_at();

create table public.daily_holes (
  date date not null references public.daily_puzzles (date) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 5),
  question_id uuid not null references public.questions (id) on delete restrict,
  target_rank int not null check (target_rank > 0),
  par smallint not null default 3 check (par between 1 and 15),
  primary key (date, hole_number),
  unique (date, question_id)
);

create index daily_holes_question_idx on public.daily_holes (question_id, date);

-- ---------------------------------------------------------------------------
-- plays + guesses
-- ---------------------------------------------------------------------------

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  date date not null references public.daily_puzzles (date) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_archive boolean not null default false,   -- started after its date: no streak/leaderboard
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_strokes int check (total_strokes >= 0),
  unique (date, user_id),
  check ((completed_at is null) = (total_strokes is null))
);

create index plays_user_date_idx on public.plays (user_id, date);
create index plays_daily_leaderboard_idx on public.plays (date, total_strokes)
  where completed_at is not null and not is_archive;

create table public.guesses (
  play_id uuid not null references public.plays (id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 5),
  entity_id uuid not null references public.entities (id) on delete restrict,
  actual_rank int check (actual_rank > 0),     -- null when off-list
  actual_value numeric,                        -- snapshot at scoring time
  strokes smallint not null check (strokes >= 0),
  created_at timestamptz not null default now(),
  primary key (play_id, hole_number)           -- one guess per hole
);

create index guesses_entity_idx on public.guesses (entity_id);

-- ---------------------------------------------------------------------------
-- profiles (one per auth user, including anonymous users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 30),
  is_admin boolean not null default false,
  current_streak int not null default 0,     -- as of last_streak_date; see app.effective_streak
  best_streak int not null default 0,
  last_streak_date date,
  games_played int not null default 0,       -- completed plays, daily and archive
  total_strokes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
for each row execute function app.touch_updated_at();

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- rate limiting (fixed window counters, written only by the server)
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
