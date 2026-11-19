-- Admin RPCs. Each is SECURITY DEFINER and starts by checking app.is_admin(), so it is
-- safe to expose to `authenticated`: non-admins get an error before anything happens.

create or replace function app.require_admin()
returns void language plpgsql stable
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Admins only' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Name matching for CSV import: exact name, then alias, then fuzzy suggestions.
-- ---------------------------------------------------------------------------

create or replace function public.admin_match_entities(
  p_type public.entity_type,
  p_names text[],
  p_sport text default 'football'
)
returns table (
  idx int,
  input text,
  method text,             -- 'exact' | 'alias' | 'fuzzy' | 'none'
  entity_id uuid,          -- best match (null for 'none')
  candidates jsonb         -- up to 5 alternatives: [{id, name, disambiguation, country, score}]
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  n record;
  q text;
  v_exact uuid[];
  v_alias uuid[];
  v_cands jsonb;
begin
  perform app.require_admin();
  if cardinality(p_names) > 2000 then
    raise exception 'Too many names (max 2000)' using errcode = 'check_violation';
  end if;

  for n in select t.name, t.ord::int as ord from unnest(p_names) with ordinality as t(name, ord) loop
    q := app.normalize_name(n.name);

    select array_agg(e.id) into v_exact
    from public.entities e
    where e.sport = p_sport and e.type = p_type and app.normalize_name(e.name) = q;

    select array_agg(e.id) into v_alias
    from public.entities e
    where e.sport = p_sport and e.type = p_type
      and exists (select 1 from unnest(e.aliases) a where app.normalize_name(a) = q);

    select coalesce(jsonb_agg(c order by c.score desc, c.name), '[]'::jsonb) into v_cands
    from (
      select e.id, e.name, e.disambiguation, e.country,
             round(greatest(
               extensions.similarity(q, e.search_text),
               extensions.word_similarity(q, e.search_text)
             )::numeric, 3) as score
      from public.entities e
      where e.sport = p_sport and e.type = p_type and length(q) > 0
        and (extensions.word_similarity(q, e.search_text) >= 0.35
             or e.search_text like '%' || q || '%')
      order by score desc, e.name
      limit 5
    ) c;

    idx := n.ord;
    input := n.name;
    candidates := v_cands;
    if cardinality(v_exact) = 1 then
      method := 'exact'; entity_id := v_exact[1];
    elsif cardinality(v_exact) > 1 then
      -- Same name, different disambiguation: the admin must pick.
      method := 'fuzzy'; entity_id := v_exact[1];
    elsif cardinality(v_alias) = 1 then
      method := 'alias'; entity_id := v_alias[1];
    elsif jsonb_array_length(v_cands) > 0 then
      method := 'fuzzy'; entity_id := (v_cands -> 0 ->> 'id')::uuid;
    else
      method := 'none'; entity_id := null;
    end if;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Replace a question's ranking atomically. Rows: [{entity_id, rank, value}].
-- The rankings trigger refuses if the question is in a published puzzle.
-- ---------------------------------------------------------------------------

create or replace function public.admin_replace_ranking(p_question_id uuid, p_rows jsonb)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform app.require_admin();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Ranking must have at least one row' using errcode = 'check_violation';
  end if;

  delete from public.question_rankings where question_id = p_question_id;
  insert into public.question_rankings (question_id, entity_id, rank, value)
  select p_question_id, (r ->> 'entity_id')::uuid, (r ->> 'rank')::int, (r ->> 'value')::numeric
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Save a date's holes (replacing any existing ones). Holes: [{question_id, target_rank, par}]
-- in play order. Returns the reasons it can't be published yet (empty = ready).
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_puzzle(p_date date, p_holes jsonb)
returns text[]
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.require_admin();
  if jsonb_typeof(p_holes) <> 'array' or jsonb_array_length(p_holes) > 5 then
    raise exception 'A puzzle has at most 5 holes' using errcode = 'check_violation';
  end if;

  insert into public.daily_puzzles (date) values (p_date) on conflict (date) do nothing;
  delete from public.daily_holes where date = p_date;  -- trigger refuses if published
  insert into public.daily_holes (date, hole_number, question_id, target_rank, par)
  select p_date, h.ord::smallint, (h.v ->> 'question_id')::uuid, (h.v ->> 'target_rank')::int,
         coalesce((h.v ->> 'par')::smallint, 3)
  from jsonb_array_elements(p_holes) with ordinality as h(v, ord);

  if jsonb_array_length(p_holes) = 0 then
    delete from public.daily_puzzles where date = p_date;
    return '{}';
  end if;
  return app.puzzle_publish_errors(p_date);
end $$;

-- Publish / unpublish (the daily_puzzles trigger validates and blocks unpublishing played days).
create or replace function public.admin_set_published(p_date date, p_published boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.require_admin();
  update public.daily_puzzles set published = p_published where date = p_date;
  if not found then
    raise exception 'No puzzle on %', p_date using errcode = 'no_data_found';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Merge duplicate entities: everything pointing at p_remove moves to p_keep,
-- p_remove's name and aliases become aliases of p_keep, then p_remove is deleted.
-- Refuses if both appear in the same ranking (that would be a real conflict).
-- ---------------------------------------------------------------------------

create or replace function public.admin_merge_entities(p_keep uuid, p_remove uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.entities;
  r public.entities;
  v_conflicts text;
begin
  perform app.require_admin();
  if p_keep = p_remove then
    raise exception 'Pick two different entities' using errcode = 'check_violation';
  end if;
  select * into k from public.entities where id = p_keep for update;
  select * into r from public.entities where id = p_remove for update;
  if k.id is null or r.id is null then
    raise exception 'Entity not found' using errcode = 'no_data_found';
  end if;
  if k.type <> r.type or k.sport <> r.sport then
    raise exception 'Can only merge entities of the same type' using errcode = 'check_violation';
  end if;

  select string_agg(q.prompt, '; ') into v_conflicts
  from public.question_rankings a
  join public.question_rankings b on b.question_id = a.question_id and b.entity_id = p_remove
  join public.questions q on q.id = a.question_id
  where a.entity_id = p_keep;
  if v_conflicts is not null then
    raise exception 'Both entities are ranked in: %', v_conflicts using errcode = 'check_violation';
  end if;

  -- Rankings may be locked and guesses are immutable; this is a deliberate correction.
  perform set_config('app.allow_locked_edit', 'on', true);
  update public.question_rankings set entity_id = p_keep where entity_id = p_remove;
  update public.guesses set entity_id = p_keep where entity_id = p_remove;
  perform set_config('app.allow_locked_edit', 'off', true);

  update public.entities set
    aliases = k.aliases || r.name || r.aliases,
    external_ids = r.external_ids || k.external_ids,
    country = coalesce(k.country, r.country)
  where id = p_keep;
  delete from public.entities where id = p_remove;
end $$;

-- ---------------------------------------------------------------------------
-- Overview for the admin question list.
-- ---------------------------------------------------------------------------

create or replace function public.admin_question_overview()
returns table (
  id uuid, prompt text, answer_type public.entity_type, stat_label text,
  value_order public.value_order, status public.question_status,
  data_as_of date, updated_at timestamptz,
  row_count int, used_dates date[], locked boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.require_admin();
  return query
  select q.id, q.prompt, q.answer_type, q.stat_label, q.value_order, q.status,
         q.data_as_of, q.updated_at,
         (select count(*)::int from public.question_rankings r where r.question_id = q.id),
         coalesce((select array_agg(h.date order by h.date) from public.daily_holes h where h.question_id = q.id), '{}'),
         app.question_is_locked(q.id)
  from public.questions q
  order by q.updated_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated may call these (each checks is_admin first).
-- ---------------------------------------------------------------------------

revoke execute on function
  public.admin_match_entities(public.entity_type, text[], text),
  public.admin_replace_ranking(uuid, jsonb),
  public.admin_save_puzzle(date, jsonb),
  public.admin_set_published(date, boolean),
  public.admin_merge_entities(uuid, uuid),
  public.admin_question_overview()
from public, anon;

grant execute on function
  public.admin_match_entities(public.entity_type, text[], text),
  public.admin_replace_ranking(uuid, jsonb),
  public.admin_save_puzzle(date, jsonb),
  public.admin_set_published(date, boolean),
  public.admin_merge_entities(uuid, uuid),
  public.admin_question_overview()
to authenticated, service_role;

grant execute on function app.require_admin() to anon, authenticated, service_role;
