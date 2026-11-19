-- Local development seed. EVERYTHING HERE IS FAKE: invented clubs, invented
-- players and invented numbers. Do not mistake any of it for real statistics.
--
-- Creates 26 fictional clubs, 6 fictional players, 10 "SAMPLE" questions and
-- three published puzzles: yesterday (3 holes), today (4 holes), tomorrow (3 holes),
-- relative to the date the seed runs (UTC).

insert into public.entities (type, name, aliases, country) values
  ('club', 'Fakeville United',      '{Fakeville,FVU}',      'Sampleland'),
  ('club', 'Mockford Town',         '{Mockford}',           'Sampleland'),
  ('club', 'Placeholder City',      '{PHC}',                'Sampleland'),
  ('club', 'Lorem Athletic',        '{Lorem}',              'Sampleland'),
  ('club', 'Ipsum Wanderers',       '{Ipsum}',              'Sampleland'),
  ('club', 'Dummy Rovers',          '{}',                   'Sampleland'),
  ('club', 'Sampleton Albion',      '{Sampleton}',          'Sampleland'),
  ('club', 'Testbury FC',           '{Testbury}',           'Sampleland'),
  ('club', 'Example Park Rangers',  '{EPR}',                'Sampleland'),
  ('club', 'Stubford Orient',       '{}',                   'Sampleland'),
  ('club', 'Mockingham Forest',     '{}',                   'Sampleland'),
  ('club', 'Fixture County',        '{}',                   'Sampleland'),
  ('club', 'Seedvale Harriers',     '{Seedvale}',           'Sampleland'),
  ('club', 'Prototype Vale',        '{}',                   'Sampleland'),
  ('club', 'Draftmouth Argyle',     '{Draftmouth}',         'Sampleland'),
  ('club', 'Pseudo Real',           '{"Real Pseudo"}',      'Mockovia'),
  ('club', 'Atlético Ficticio',     '{Ficticio}',           'Mockovia'),
  ('club', 'Sporting Dummyhaven',   '{}',                   'Mockovia'),
  ('club', 'Faux Olympique',        '{Faux}',               'Mockovia'),
  ('club', 'Nullchester Wednesday', '{Nullchester}',        'Sampleland'),
  ('club', 'Undefined Borough',     '{}',                   'Sampleland'),
  ('club', 'Foobar Thistle',        '{Foobar}',             'Mockovia'),
  ('club', 'Quux Celtic',           '{Quux}',               'Mockovia'),
  ('club', 'Bazport Athletic',      '{Bazport}',            'Mockovia'),
  ('club', 'Widget Town',           '{}',                   'Sampleland'),
  ('club', 'Gadget Dynamo',         '{Gadget}',             'Mockovia'),
  ('player', 'Jon Placeholder',     '{}',                   'Sampleland'),
  ('player', 'Ana Mockup',          '{}',                   'Mockovia'),
  ('player', 'Lee Fakename',        '{}',                   'Sampleland'),
  ('player', 'Sam Dummy',           '{}',                   'Mockovia'),
  ('player', 'Kit Testcase',        '{}',                   'Sampleland'),
  ('player', 'Max Stubbs',          '{}',                   'Mockovia');

insert into public.questions
  (prompt, answer_type, stat_label, value_order, scope_note, source_name, source_url, data_as_of, status)
select
  format('SAMPLE — not real data: Most made-up points (set %s)', lpad(q::text, 2, '0')),
  'club', 'Made-up points', 'desc',
  'Fabricated numbers for local development only.',
  'Seed script (fake data)', null, date '2026-01-01', 'ready'
from generate_series(1, 10) as q;

-- Deterministic fake values. n and n+23 collide, so each list has three tied pairs,
-- which exercises competition ranking (1, 2, 2, 4).
with q as (
  select id, row_number() over (order by prompt) as qn from public.questions
), e as (
  select id, row_number() over (order by name) as n from public.entities where type = 'club'
), v as (
  select q.id as question_id, e.id as entity_id,
         ((e.n * (q.qn * 5 + 2)) % 23) * 3 + 10 as value
  from q cross join e
)
insert into public.question_rankings (question_id, entity_id, rank, value)
select question_id, entity_id,
       rank() over (partition by question_id order by value desc),
       value
from v;

-- Puzzles: yesterday (sets 1-3), today (sets 4-7), tomorrow (sets 8-10).
insert into public.daily_puzzles (date)
select current_date + d from generate_series(-1, 1) as d;

with q as (
  select id, row_number() over (order by prompt) as qn from public.questions
), plan(qn, day_offset, hole_number, target_offset, par) as (
  values
    (1, -1, 1, 4, 3), (2, -1, 2, 7, 3), (3, -1, 3, 10, 4),
    (4,  0, 1, 3, 3), (5,  0, 2, 6, 3), (6,  0, 3, 9, 3), (7, 0, 4, 11, 4),
    (8,  1, 1, 5, 3), (9,  1, 2, 8, 3), (10, 1, 3, 2, 3)
)
insert into public.daily_holes (date, hole_number, question_id, target_rank, par)
select current_date + p.day_offset, p.hole_number, q.id,
       -- target = the rank held by the entity at this row position, so it always exists
       (select r.rank from public.question_rankings r
         where r.question_id = q.id order by r.rank, r.entity_id offset p.target_offset limit 1),
       p.par
from plan p join q using (qn);

update public.daily_puzzles set published = true;
