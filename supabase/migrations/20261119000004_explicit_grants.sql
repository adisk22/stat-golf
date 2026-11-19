-- Explicit privileges for the API roles.
--
-- Newer hosted Supabase projects no longer grant anon/authenticated/service_role
-- access to new tables in `public` automatically, while older projects and the
-- local CLI stack still do. To behave identically everywhere, start from nothing
-- and grant exactly what the app needs. RLS (see ..._rls.sql) still applies on top
-- for anon/authenticated; service_role bypasses RLS and is used only by the server.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated, service_role;

-- Server (route handlers with the secret key): full access.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Everyone: read entities (autocomplete searches all of them).
grant select on public.entities to anon, authenticated;

-- Signed-in users (including anonymous): reads filtered by RLS.
grant select on
  public.questions, public.question_rankings, public.daily_puzzles, public.daily_holes,
  public.plays, public.guesses, public.profiles
to authenticated;

-- Admin writes (RLS policies require app.is_admin()).
grant insert, update, delete on
  public.entities, public.questions, public.question_rankings,
  public.daily_puzzles, public.daily_holes
to authenticated;

-- Profiles: users rename themselves (trigger blocks every other column).
grant update on public.profiles to authenticated;

-- plays, guesses: written only by the server. rate_limits: server only.

-- Future tables are server-only until a migration grants more.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated, service_role;

grant execute on function public.search_entities(public.entity_type, text, int, text)
  to anon, authenticated, service_role;

grant execute on function
  public.server_merge_user_plays(uuid, uuid),
  public.server_recompute_profile_stats(uuid),
  public.server_check_rate_limit(text, int, int),
  public.server_puzzle_publish_errors(date)
to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- app.* helpers are reached through RLS policies, triggers and the functions above.
-- Grant them to the API roles explicitly (in case PUBLIC execute was removed),
-- then take the dangerous ones back from client roles.
grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;

revoke execute on function
  app.merge_user_plays(uuid, uuid),
  app.recompute_profile_stats(uuid),
  app.check_rate_limit(text, int, int),
  app.cleanup_stale_data(),
  app.handle_new_user()
from public, anon, authenticated;
