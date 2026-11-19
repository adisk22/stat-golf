-- Row Level Security.
--
-- Model: the Next.js server (service role, bypasses RLS) does all game writes
-- and scoring. Policies below are defence in depth for anything a browser can
-- reach with the anon key + a user JWT (including anonymous users).

alter table public.entities enable row level security;
alter table public.questions enable row level security;
alter table public.question_rankings enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.daily_holes enable row level security;
alter table public.plays enable row level security;
alter table public.guesses enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Reveal helpers. A player may see a hole's question once it is their turn
-- (hole 1, or the previous hole guessed) and its ranking only after they have
-- guessed that hole. Applies to every date, including the archive.
-- ---------------------------------------------------------------------------

create or replace function app.can_view_question(p_question_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_holes h
    join public.daily_puzzles d on d.date = h.date and d.published
    where h.question_id = p_question_id
      and h.date <= app.puzzle_today()
      and (
        h.hole_number = 1
        or exists (
          select 1 from public.guesses g join public.plays p on p.id = g.play_id
          where p.user_id = auth.uid() and p.date = h.date and g.hole_number = h.hole_number - 1
        )
      )
  )
$$;

create or replace function app.can_view_ranking(p_question_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_holes h
    join public.daily_puzzles d on d.date = h.date and d.published
    join public.plays p on p.date = h.date and p.user_id = auth.uid()
    join public.guesses g on g.play_id = p.id and g.hole_number = h.hole_number
    where h.question_id = p_question_id
  )
$$;

-- ---------------------------------------------------------------------------
-- entities: readable by everyone (autocomplete covers all entities), admin writes.
-- ---------------------------------------------------------------------------

create policy entities_read on public.entities
  for select to anon, authenticated using (true);
create policy entities_admin_write on public.entities
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- questions / rankings / puzzles: admins, plus the narrow reveal rules above.
-- ---------------------------------------------------------------------------

create policy questions_admin on public.questions
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy questions_player_read on public.questions
  for select to authenticated using (app.can_view_question(id));

create policy rankings_admin on public.question_rankings
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy rankings_player_read on public.question_rankings
  for select to authenticated using (app.can_view_ranking(question_id));

create policy daily_puzzles_admin on public.daily_puzzles
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy daily_holes_admin on public.daily_holes
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- plays / guesses: players read their own; writes only via the server.
-- ---------------------------------------------------------------------------

create policy plays_own_read on public.plays
  for select to authenticated using (user_id = auth.uid() or app.is_admin());

create policy guesses_own_read on public.guesses
  for select to authenticated using (
    exists (select 1 from public.plays p where p.id = play_id and p.user_id = auth.uid())
    or app.is_admin()
  );

-- ---------------------------------------------------------------------------
-- profiles: read and rename your own (trigger blocks other columns).
-- ---------------------------------------------------------------------------

create policy profiles_own_read on public.profiles
  for select to authenticated using (user_id = auth.uid() or app.is_admin());
create policy profiles_own_update on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rate_limits: no policies -> no client access.

-- ---------------------------------------------------------------------------
-- Table privileges (belt and braces on top of RLS).
-- ---------------------------------------------------------------------------

revoke all on public.rate_limits from anon, authenticated;
revoke insert, update, delete on public.plays, public.guesses from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.questions, public.question_rankings, public.daily_puzzles,
  public.daily_holes, public.plays, public.guesses, public.profiles from anon;
revoke insert, update, delete on public.entities from anon;

-- ---------------------------------------------------------------------------
-- Server-only RPC wrappers (PostgREST exposes only `public`; the `app`
-- schema is never reachable by clients). Executable by service_role only.
-- ---------------------------------------------------------------------------

create or replace function public.server_merge_user_plays(p_from uuid, p_to uuid)
returns table (merged int, skipped int)
language sql security definer
set search_path = ''
as $$ select * from app.merge_user_plays(p_from, p_to) $$;

create or replace function public.server_recompute_profile_stats(p_user_id uuid)
returns void language sql security definer
set search_path = ''
as $$ select app.recompute_profile_stats(p_user_id) $$;

create or replace function public.server_check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language sql security definer
set search_path = ''
as $$ select app.check_rate_limit(p_key, p_limit, p_window_seconds) $$;

create or replace function public.server_puzzle_publish_errors(p_date date)
returns text[] language sql stable security definer
set search_path = ''
as $$ select app.puzzle_publish_errors(p_date) $$;

revoke execute on function
  public.server_merge_user_plays(uuid, uuid),
  public.server_recompute_profile_stats(uuid),
  public.server_check_rate_limit(text, int, int),
  public.server_puzzle_publish_errors(date)
from public, anon, authenticated;

grant execute on function
  public.server_merge_user_plays(uuid, uuid),
  public.server_recompute_profile_stats(uuid),
  public.server_check_rate_limit(text, int, int),
  public.server_puzzle_publish_errors(date)
to service_role;

-- Dangerous app.* functions: never callable by client roles, even indirectly.
revoke execute on function
  app.merge_user_plays(uuid, uuid),
  app.recompute_profile_stats(uuid),
  app.check_rate_limit(text, int, int),
  app.cleanup_stale_data(),
  app.handle_new_user()
from public, anon, authenticated;
