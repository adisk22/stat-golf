import "server-only";
import type {
  AdminEntity,
  AdminQuestion,
  CalendarDay,
  EditorHole,
  EditorQuestion,
  MatchResponse,
  MatchRow,
  PuzzleEditorData,
  QuestionMeta,
  QuestionSummary,
  ScheduleOverview,
} from "@/lib/admin-types";
import { publishErrors, puzzleWarnings } from "@/lib/admin-checks";
import { EMPTY_DAYS_LOOKAHEAD } from "@/lib/config";
import { duplicateEntityIssues, parseRankingCsv } from "@/lib/csv/ranking";
import { addDays, daysBetween, puzzleToday } from "@/lib/dates";
import { competitionRanks, heldRanks } from "@/lib/ranking";
import type { AnswerType } from "@/lib/game-types";
import type { AdminContext } from "./auth";
import { HttpError } from "./http";

type Db = AdminContext["db"];

function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) throw new HttpError(404, "Not found.");
  return res.data as NonNullable<T>;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function listQuestions(db: Db): Promise<QuestionSummary[]> {
  const rows = must(await db.rpc("admin_question_overview"));
  return rows.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    answerType: q.answer_type,
    statLabel: q.stat_label,
    status: q.status,
    dataAsOf: q.data_as_of,
    updatedAt: q.updated_at,
    rowCount: q.row_count,
    usedDates: q.used_dates ?? [],
    locked: q.locked,
  }));
}

function metaToRow(m: Partial<QuestionMeta>) {
  const row: Record<string, unknown> = {};
  if (m.prompt !== undefined) row.prompt = m.prompt;
  if (m.answerType !== undefined) row.answer_type = m.answerType;
  if (m.statLabel !== undefined) row.stat_label = m.statLabel;
  if (m.valueOrder !== undefined) row.value_order = m.valueOrder;
  if (m.scopeNote !== undefined) row.scope_note = m.scopeNote;
  if (m.sourceName !== undefined) row.source_name = m.sourceName;
  if (m.sourceUrl !== undefined) row.source_url = m.sourceUrl;
  if (m.dataAsOf !== undefined) row.data_as_of = m.dataAsOf;
  return row;
}

export async function createQuestion(ctx: AdminContext, meta: QuestionMeta): Promise<{ id: string }> {
  const row = must(
    await ctx.db
      .from("questions")
      .insert({ ...metaToRow(meta), created_by: ctx.user.id, status: "draft" } as never)
      .select("id")
      .single(),
  );
  return { id: row.id };
}

export async function getQuestion(db: Db, id: string): Promise<AdminQuestion> {
  const q = must(await db.from("questions").select("*").eq("id", id).maybeSingle());
  const ranking = must(
    await db
      .from("question_rankings")
      .select("entity_id, rank, value, entity:entities!inner(name)")
      .eq("question_id", id)
      .order("rank")
      .order("entity_id"),
  ) as unknown as { entity_id: string; rank: number; value: number; entity: { name: string } }[];
  const holes = must(await db.from("daily_holes").select("date, daily_puzzles!inner(published)").eq("question_id", id).order("date"));
  return {
    id: q.id,
    prompt: q.prompt,
    answerType: q.answer_type,
    statLabel: q.stat_label,
    valueOrder: q.value_order,
    scopeNote: q.scope_note,
    sourceName: q.source_name,
    sourceUrl: q.source_url,
    dataAsOf: q.data_as_of,
    status: q.status,
    usedDates: holes.map((h) => h.date),
    locked: (holes as unknown as { daily_puzzles: { published: boolean } }[]).some((h) => h.daily_puzzles.published),
    ranking: ranking
      .map((r) => ({ entityId: r.entity_id, name: r.entity.name, rank: r.rank, value: Number(r.value) }))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
  };
}

export async function updateQuestion(db: Db, id: string, patch: Partial<QuestionMeta> & { status?: "draft" | "ready" }) {
  const row = metaToRow(patch);
  if (patch.status !== undefined) {
    if (patch.status === "ready") {
      const { count, error } = await db
        .from("question_rankings")
        .select("entity_id", { count: "exact", head: true })
        .eq("question_id", id);
      if (error) throw error;
      if (!count) throw new HttpError(400, "Import a ranking before marking the question ready.");
    }
    row.status = patch.status;
  }
  if (Object.keys(row).length === 0) return;
  must(await db.from("questions").update(row as never).eq("id", id).select("id").maybeSingle());
}

export async function deleteQuestion(db: Db, id: string) {
  const { data: holes, error } = await db.from("daily_holes").select("date").eq("question_id", id).limit(1);
  if (error) throw error;
  if (holes.length > 0) throw new HttpError(409, "This question is scheduled; remove it from those dates first.");
  must(await db.from("questions").delete().eq("id", id).select("id").maybeSingle());
}

// ---------------------------------------------------------------------------
// CSV import: parse + validate, match names, then save.
// ---------------------------------------------------------------------------

export async function matchCsv(db: Db, questionId: string, csv: string): Promise<MatchResponse> {
  const q = must(await db.from("questions").select("answer_type, value_order").eq("id", questionId).maybeSingle());
  const parsed = parseRankingCsv(csv, q.value_order);
  if (parsed.errors.length > 0) return { ok: false, errors: parsed.errors };

  const matches = must(
    await db.rpc("admin_match_entities", { p_type: q.answer_type, p_names: parsed.rows.map((r) => r.name) }),
  );
  const byIdx = new Map(matches.map((m) => [m.idx, m]));
  const rows: MatchRow[] = parsed.rows.map((r, i) => {
    const m = byIdx.get(i + 1);
    return {
      line: r.line,
      rank: r.rank,
      name: r.name,
      value: r.value,
      method: (m?.method ?? "none") as MatchRow["method"],
      entityId: m?.entity_id ?? null,
      candidates: ((m?.candidates as MatchRow["candidates"] | null) ?? []).map((c) => ({ ...c, score: Number(c.score) })),
    };
  });
  return { ok: true, rows };
}

interface RankingRowInput {
  line: number;
  rank: number;
  value: number;
  entityId?: string | null;
  newEntity?: { name: string; country?: string | null; disambiguation?: string | null } | null;
}

export async function saveRanking(db: Db, questionId: string, rows: RankingRowInput[]): Promise<{ saved: number; created: number }> {
  const q = must(await db.from("questions").select("answer_type, value_order, sport").eq("id", questionId).maybeSingle());

  // Re-validate on the server: sorted, values in order, competition ranks, unique entities.
  const sorted = [...rows].sort((a, b) => a.line - b.line);
  for (let i = 1; i < sorted.length; i++) {
    const [prev, cur] = [sorted[i - 1]!, sorted[i]!];
    const outOfOrder = q.value_order === "desc" ? cur.value > prev.value : cur.value < prev.value;
    if (cur.rank < prev.rank || outOfOrder) throw new HttpError(400, `Line ${cur.line}: rows are out of order.`);
  }
  const expected = competitionRanks(sorted.map((r) => r.value));
  sorted.forEach((r, i) => {
    if (r.rank !== expected[i]) throw new HttpError(400, `Line ${r.line}: expected rank ${expected[i]}.`);
  });
  const dupes = duplicateEntityIssues(sorted.map((r) => ({ line: r.line, entityId: r.entityId ?? null })));
  if (dupes.length > 0) throw new HttpError(400, `Line ${dupes[0]!.line}: ${dupes[0]!.message}`);

  // Existing entities must be of the right type.
  const ids = sorted.flatMap((r) => (r.entityId ? [r.entityId] : []));
  if (ids.length > 0) {
    const found = must(await db.from("entities").select("id, type").in("id", ids));
    const types = new Map(found.map((e) => [e.id, e.type]));
    for (const r of sorted) {
      if (r.entityId && types.get(r.entityId) !== q.answer_type) {
        throw new HttpError(400, `Line ${r.line}: matched entity is not a ${q.answer_type}.`);
      }
    }
  }

  // Create new entities inline (RLS: admins only).
  const toCreate = sorted.filter((r) => r.newEntity);
  let created = 0;
  if (toCreate.length > 0) {
    const inserted = must(
      await db
        .from("entities")
        .insert(
          toCreate.map((r) => ({
            type: q.answer_type,
            sport: q.sport,
            name: r.newEntity!.name,
            country: r.newEntity!.country ?? null,
            disambiguation: r.newEntity!.disambiguation ?? null,
          })),
        )
        .select("id"),
    );
    inserted.forEach((e, i) => (toCreate[i]!.entityId = e.id));
    created = inserted.length;
  }

  const saved = must(
    await db.rpc("admin_replace_ranking", {
      p_question_id: questionId,
      p_rows: sorted.map((r) => ({ entity_id: r.entityId, rank: r.rank, value: r.value })),
    }),
  );
  return { saved, created };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function scheduleOverview(db: Db, from: string, to: string): Promise<ScheduleOverview> {
  if (daysBetween(from, to) > 120 || to < from) throw new HttpError(400, "Pick a range of up to 120 days.");
  const today = puzzleToday();
  const lookaheadEnd = addDays(today, EMPTY_DAYS_LOOKAHEAD - 1);
  const start = from < today ? from : today;
  const end = to > lookaheadEnd ? to : lookaheadEnd;
  const rows = must(
    await db.from("daily_puzzles").select("date, published, daily_holes(count)").gte("date", start).lte("date", end).order("date"),
  ) as unknown as { date: string; published: boolean; daily_holes: { count: number }[] }[];
  const days: CalendarDay[] = rows.map((r) => ({
    date: r.date,
    published: r.published,
    holeCount: r.daily_holes[0]?.count ?? 0,
  }));
  const published = new Set(days.filter((d) => d.published).map((d) => d.date));
  const emptySoon: string[] = [];
  for (let i = 0; i < EMPTY_DAYS_LOOKAHEAD; i++) {
    const d = addDays(today, i);
    if (!published.has(d)) emptySoon.push(d);
  }
  return { today, days: days.filter((d) => d.date >= from && d.date <= to), emptySoon };
}

export async function puzzleEditor(db: Db, date: string): Promise<PuzzleEditorData> {
  const puzzle = (await db.from("daily_puzzles").select("date, published").eq("date", date).maybeSingle());
  if (puzzle.error) throw puzzle.error;
  const holes = must(
    await db.from("daily_holes").select("hole_number, question_id, target_rank, par").eq("date", date).order("hole_number"),
  );
  const { count: plays, error: pErr } = await db
    .from("plays")
    .select("id", { count: "exact", head: true })
    .eq("date", date);
  if (pErr) throw pErr;

  const holeQuestionIds = holes.map((h) => h.question_id);
  const qs = must(
    await db
      .from("questions")
      .select("id, prompt, answer_type, stat_label, scope_note, status")
      .or(`status.eq.ready${holeQuestionIds.length ? `,id.in.(${holeQuestionIds.join(",")})` : ""}`)
      .order("updated_at", { ascending: false }),
  );
  const ids = qs.map((q) => q.id);
  const ranks = ids.length
    ? must(await db.from("question_rankings").select("question_id, rank").in("question_id", ids))
    : [];
  const uses = ids.length ? must(await db.from("daily_holes").select("question_id, date").in("question_id", ids)) : [];

  const ranksBy = new Map<string, number[]>();
  for (const r of ranks) ranksBy.set(r.question_id, [...(ranksBy.get(r.question_id) ?? []), r.rank]);
  const usesBy = new Map<string, string[]>();
  for (const u of uses) usesBy.set(u.question_id, [...(usesBy.get(u.question_id) ?? []), u.date]);

  const questions: EditorQuestion[] = qs.map((q) => {
    const all = ranksBy.get(q.id) ?? [];
    return {
      id: q.id,
      prompt: q.prompt,
      answerType: q.answer_type as AnswerType,
      statLabel: q.stat_label,
      scopeNote: q.scope_note,
      ready: q.status === "ready",
      rowCount: all.length,
      heldRanks: heldRanks(all),
      usedDates: (usesBy.get(q.id) ?? []).sort(),
    };
  });

  const editorHoles: EditorHole[] = holes.map((h) => ({ questionId: h.question_id, targetRank: h.target_rank, par: h.par }));
  return {
    date,
    today: puzzleToday(),
    exists: Boolean(puzzle.data),
    published: puzzle.data?.published ?? false,
    hasPlays: (plays ?? 0) > 0,
    holes: editorHoles,
    questions,
    publishErrors: puzzle.data ? publishErrors(editorHoles, questions) : [],
    warnings: puzzleWarnings(date, editorHoles, questions),
  };
}

export async function savePuzzle(db: Db, date: string, holes: EditorHole[]): Promise<PuzzleEditorData> {
  const current = await puzzleEditor(db, date);
  // Saving a partial day (fewer than 3 holes) is fine; anything else that would block publishing is not.
  const blocking = publishErrors(holes, current.questions).filter((e) => !e.startsWith("A puzzle needs"));
  if (blocking.length > 0) throw new HttpError(400, blocking[0]!);
  must(
    await db.rpc("admin_save_puzzle", {
      p_date: date,
      p_holes: holes.map((h) => ({ question_id: h.questionId, target_rank: h.targetRank, par: h.par })),
    }),
  );
  return puzzleEditor(db, date);
}

export async function setPublished(db: Db, date: string, published: boolean): Promise<PuzzleEditorData> {
  const { error } = await db.rpc("admin_set_published", { p_date: date, p_published: published });
  if (error) throw error;
  return puzzleEditor(db, date);
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export async function searchEntities(db: Db, type: AnswerType, q: string): Promise<AdminEntity[]> {
  let ids: string[] | null = null;
  if (q) {
    const hits = must(await db.rpc("search_entities", { p_type: type, p_query: q, p_limit: 25 }));
    ids = hits.map((h) => h.id);
    if (ids.length === 0) return [];
  }
  let query = db
    .from("entities")
    .select("id, type, name, aliases, country, disambiguation, question_rankings(count)")
    .eq("type", type);
  query = ids ? query.in("id", ids) : query.order("updated_at", { ascending: false }).limit(50);
  const rows = must(await query) as unknown as {
    id: string;
    type: AnswerType;
    name: string;
    aliases: string[];
    country: string | null;
    disambiguation: string | null;
    question_rankings: { count: number }[];
  }[];
  const order = ids ? new Map(ids.map((id, i) => [id, i])) : null;
  return rows
    .map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases,
      country: e.country,
      disambiguation: e.disambiguation,
      rankingCount: e.question_rankings[0]?.count ?? 0,
    }))
    .sort((a, b) => (order ? order.get(a.id)! - order.get(b.id)! : 0));
}

export async function createEntity(
  db: Db,
  e: { type: AnswerType; name: string; aliases: string[]; country?: string | null; disambiguation?: string | null },
) {
  return must(
    await db
      .from("entities")
      .insert({ type: e.type, name: e.name, aliases: e.aliases, country: e.country ?? null, disambiguation: e.disambiguation ?? null })
      .select("id")
      .single(),
  );
}

export async function updateEntity(
  db: Db,
  id: string,
  patch: { name?: string; aliases?: string[]; country?: string | null; disambiguation?: string | null },
) {
  must(await db.from("entities").update(patch).eq("id", id).select("id").maybeSingle());
}

export async function mergeEntities(db: Db, keepId: string, removeId: string) {
  const { error } = await db.rpc("admin_merge_entities", { p_keep: keepId, p_remove: removeId });
  if (error) throw error;
}
