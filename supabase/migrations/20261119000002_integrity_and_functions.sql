-- Integrity triggers and server-side helper functions.

-- ---------------------------------------------------------------------------
-- Locking: once a question appears in a published puzzle its ranking and its
-- answer semantics are frozen, so reveals never change after people played.
-- Maintenance functions (entity merge) can bypass with:
--   set local app.allow_locked_edit = 'on';
-- ---------------------------------------------------------------------------

create or replace function app.locked_edit_allowed()
returns boolean language sql stable
set search_path = ''
as $$ select coalesce(current_setting('app.allow_locked_edit', true), '') = 'on' $$;

create or replace function app.question_is_locked(p_question_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.daily_holes h
    join public.daily_puzzles d on d.date = h.date
    where h.question_id = p_question_id and d.published
  )
$$;

create or replace function app.question_rankings_guard()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  q public.questions;
  e public.entities;
  qid uuid := coalesce(new.question_id, old.question_id);
begin
  if app.question_is_locked(qid) and not app.locked_edit_allowed() then
    raise exception 'Ranking is locked: question % is used in a published puzzle', qid
      using errcode = 'check_violation';
  end if;
  if tg_op <> 'DELETE' then
    select * into q from public.questions where id = new.question_id;
    select * into e from public.entities where id = new.entity_id;
    if e.type <> q.answer_type or e.sport <> q.sport then
      raise exception 'Entity % (%) does not match question answer type %',
        e.name, e.type, q.answer_type using errcode = 'check_violation';
    end if;
    return new;
  end if;
  return old;
end $$;

create trigger question_rankings_guard
before insert or update or delete on public.question_rankings
for each row execute function app.question_rankings_guard();

create or replace function app.questions_guard()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if app.question_is_locked(old.id) and not app.locked_edit_allowed() then
    if tg_op = 'DELETE' then
      raise exception 'Question % is used in a published puzzle and cannot be deleted', old.id
        using errcode = 'check_violation';
    end if;
    if new.answer_type is distinct from old.answer_type
       or new.value_order is distinct from old.value_order
       or new.sport is distinct from old.sport
       or new.status is distinct from old.status then
      raise exception 'Question % is used in a published puzzle; only wording and source fields can change', old.id
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger questions_guard
before update or delete on public.questions
for each row execute function app.questions_guard();

-- Holes of a published puzzle are frozen (unpublish first; that is blocked once anyone played).
create or replace function app.daily_holes_guard()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  d date := coalesce(new.date, old.date);
begin
  if exists (select 1 from public.daily_puzzles where date = d and published)
     and not app.locked_edit_allowed() then
    raise exception 'Puzzle % is published; unpublish it before editing holes', d
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger daily_holes_guard
before insert or update or delete on public.daily_holes
for each row execute function app.daily_holes_guard();

-- Returns the reasons a date cannot be published (empty array = publishable).
create or replace function app.puzzle_publish_errors(p_date date)
returns text[] language plpgsql stable
set search_path = ''
as $$
declare
  errs text[] := '{}';
  n int;
  max_hole int;
  h record;
begin
  select count(*), coalesce(max(hole_number), 0) into n, max_hole
  from public.daily_holes where date = p_date;
  if n < 3 or n > 5 then
    errs := errs || format('A puzzle needs 3-5 holes (has %s).', n);
  end if;
  if n <> max_hole then
    errs := errs || 'Hole numbers must run 1..N without gaps.'::text;
  end if;
  for h in
    select dh.hole_number, dh.target_rank, q.status, q.prompt,
           exists (select 1 from public.question_rankings r
                   where r.question_id = dh.question_id and r.rank = dh.target_rank) as held
    from public.daily_holes dh join public.questions q on q.id = dh.question_id
    where dh.date = p_date order by dh.hole_number
  loop
    if h.status <> 'ready' then
      errs := errs || format('Hole %s: question is not marked ready.', h.hole_number);
    end if;
    if not h.held then
      errs := errs || format('Hole %s: no entity holds target rank %s.', h.hole_number, h.target_rank);
    end if;
  end loop;
  return errs;
end $$;

create or replace function app.daily_puzzles_guard()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  errs text[];
begin
  if tg_op = 'UPDATE' and new.published and not old.published then
    errs := app.puzzle_publish_errors(new.date);
    if cardinality(errs) > 0 then
      raise exception 'Cannot publish %: %', new.date, array_to_string(errs, ' ')
        using errcode = 'check_violation';
    end if;
    new.published_at := now();
  elsif tg_op = 'INSERT' and new.published then
    raise exception 'Create the puzzle unpublished, add holes, then publish'
      using errcode = 'check_violation';
  elsif tg_op = 'UPDATE' and old.published and not new.published then
    if exists (select 1 from public.plays where date = old.date) then
      raise exception 'Puzzle % already has plays and cannot be unpublished', old.date
        using errcode = 'check_violation';
    end if;
    new.published_at := null;
  end if;
  return new;
end $$;

create trigger daily_puzzles_guard
before insert or update on public.daily_puzzles
for each row execute function app.daily_puzzles_guard();

-- ---------------------------------------------------------------------------
-- Guesses: holes must be played strictly in order, once, on a published,
-- non-future puzzle, and not after the play is completed.
-- ---------------------------------------------------------------------------

create or replace function app.guesses_guard()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  p public.plays;
begin
  select * into p from public.plays where id = new.play_id;
  if p.completed_at is not null then
    raise exception 'Play is already complete' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.daily_puzzles
                 where date = p.date and published and date <= app.puzzle_today()) then
    raise exception 'Puzzle % is not available', p.date using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.daily_holes where date = p.date and hole_number = new.hole_number) then
    raise exception 'Puzzle % has no hole %', p.date, new.hole_number using errcode = 'check_violation';
  end if;
  if new.hole_number > 1 and not exists (
    select 1 from public.guesses where play_id = new.play_id and hole_number = new.hole_number - 1
  ) then
    raise exception 'Hole % must be played before hole %', new.hole_number - 1, new.hole_number
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger guesses_guard
before insert on public.guesses
for each row execute function app.guesses_guard();

-- Guesses are immutable.
create or replace function app.reject_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if app.locked_edit_allowed() then
    return coalesce(new, old);
  end if;
  raise exception '% rows are immutable', tg_table_name using errcode = 'check_violation';
end $$;

create trigger guesses_immutable
before update on public.guesses
for each row execute function app.reject_change();

-- ---------------------------------------------------------------------------
-- Admin check (used by RLS policies)
-- ---------------------------------------------------------------------------

create or replace function app.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false)
$$;

-- Users may only change their own display_name; is_admin and stats are server-managed.
create or replace function app.profiles_guard()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.is_admin is distinct from old.is_admin
       or new.user_id is distinct from old.user_id
       or new.current_streak is distinct from old.current_streak
       or new.best_streak is distinct from old.best_streak
       or new.last_streak_date is distinct from old.last_streak_date
       or new.games_played is distinct from old.games_played
       or new.total_strokes is distinct from old.total_strokes) then
    raise exception 'Only display_name can be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger profiles_guard
before update on public.profiles
for each row execute function app.profiles_guard();

-- ---------------------------------------------------------------------------
-- Entity search for the guess autocomplete. Searches EVERY entity of the
-- requested type so the dropdown never leaks which entities are ranked.
-- ---------------------------------------------------------------------------

create or replace function public.search_entities(
  p_type public.entity_type,
  p_query text,
  p_limit int default 10,
  p_sport text default 'football'
)
returns table (id uuid, name text, disambiguation text, country text, score real)
language sql stable
set search_path = ''
as $$
  with q as (select app.normalize_name(p_query) as q)
  select e.id, e.name, e.disambiguation, e.country,
         greatest(
           extensions.word_similarity(q.q, e.search_text),
           case when e.search_text like q.q || '%' then 1.0
                when e.search_text like '% ' || q.q || '%' then 0.95
                else 0 end
         )::real as score
  from public.entities e, q
  where e.type = p_type
    and e.sport = p_sport
    and length(q.q) > 0
    and (e.search_text like '%' || q.q || '%'
         or extensions.word_similarity(q.q, e.search_text) >= 0.4)
  order by score desc, e.name
  limit least(greatest(p_limit, 1), 25)
$$;

-- ---------------------------------------------------------------------------
-- Profile stats + streaks. "A day" is a puzzle date in the rollover timezone;
-- a streak is consecutive dates with a completed, non-archive play.
-- ---------------------------------------------------------------------------

create or replace function app.recompute_profile_stats(p_user_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_best int;
  v_last_len int;
  v_last_end date;
  v_games int;
  v_total int;
begin
  select count(*), coalesce(sum(total_strokes), 0) into v_games, v_total
  from public.plays where user_id = p_user_id and completed_at is not null;

  with d as (
    select date from public.plays
    where user_id = p_user_id and completed_at is not null and not is_archive
  ), g as (
    select date, date - (row_number() over (order by date))::int as grp from d
  ), runs as (
    select count(*)::int as len, max(date) as last_date from g group by grp
  )
  select coalesce(max(len), 0),
         (select len from runs order by last_date desc limit 1),
         (select last_date from runs order by last_date desc limit 1)
  into v_best, v_last_len, v_last_end
  from runs;

  insert into public.profiles (user_id) values (p_user_id) on conflict do nothing;
  update public.profiles set
    games_played = v_games,
    total_strokes = v_total,
    best_streak = v_best,
    current_streak = coalesce(v_last_len, 0),
    last_streak_date = v_last_end
  where user_id = p_user_id;
end $$;

-- Current streak as of today: a missed day resets it to 0.
create or replace function app.effective_streak(p_current int, p_last date)
returns int language sql stable
set search_path = ''
as $$
  select case when p_last is not null and p_last >= app.puzzle_today() - 1 then p_current else 0 end
$$;

-- ---------------------------------------------------------------------------
-- Account merge: move a guest's plays to the account they signed into.
-- Conflicting dates keep the account's play and drop the guest's.
-- ---------------------------------------------------------------------------

create or replace function app.merge_user_plays(p_from uuid, p_to uuid)
returns table (merged int, skipped int)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_merged int;
  v_skipped int;
begin
  if p_from = p_to then
    return query select 0, 0;
    return;
  end if;

  delete from public.plays f
  where f.user_id = p_from
    and exists (select 1 from public.plays t where t.user_id = p_to and t.date = f.date);
  get diagnostics v_skipped = row_count;

  update public.plays set user_id = p_to where user_id = p_from;
  get diagnostics v_merged = row_count;

  perform app.recompute_profile_stats(p_from);
  perform app.recompute_profile_stats(p_to);
  return query select v_merged, v_skipped;
end $$;

-- ---------------------------------------------------------------------------
-- Rate limiting: fixed-window counter. Returns true if the call is allowed.
-- ---------------------------------------------------------------------------

create or replace function app.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping: delete anonymous users older than 30 days that never played,
-- and old rate-limit windows. Scheduled daily with pg_cron below.
-- ---------------------------------------------------------------------------

create or replace function app.cleanup_stale_data()
returns table (deleted_users int, deleted_rate_windows int)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_users int;
  v_windows int;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and not exists (select 1 from public.plays p where p.user_id = u.id);
  get diagnostics v_users = row_count;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_windows = row_count;

  return query select v_users, v_windows;
end $$;

create extension if not exists pg_cron;

select cron.schedule('stat-golf-cleanup', '17 3 * * *', $$select app.cleanup_stale_data()$$);
