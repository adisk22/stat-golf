import "server-only";
import { DEFAULT_PAR } from "@/lib/config";
import { isIsoDate, puzzleNumber, puzzleToday } from "@/lib/dates";
import type { HoleView, PlayState, PlayedHole } from "@/lib/game-types";
import { revealSlice, type RankingRow } from "@/lib/reveal";
import { scoreGuess } from "@/lib/scoring";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { HttpError } from "./http";

type Admin = ReturnType<typeof createAdminClient>;
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];

interface HoleRow {
  hole_number: number;
  target_rank: number;
  par: number;
  question: QuestionRow;
}

/** "today" or an ISO date that is not in the future. */
export function resolvePuzzleDate(param: string): string {
  const today = puzzleToday();
  const date = param === "today" ? today : param;
  if (!isIsoDate(date)) throw new HttpError(400, "Invalid date.");
  if (date > today) throw new HttpError(404, "No puzzle for that date yet.");
  return date;
}

async function loadHoles(db: Admin, date: string): Promise<HoleRow[]> {
  const { data: puzzle, error: pErr } = await db
    .from("daily_puzzles")
    .select("date")
    .eq("date", date)
    .eq("published", true)
    .lte("date", puzzleToday())
    .maybeSingle();
  if (pErr) throw pErr;
  if (!puzzle) throw new HttpError(404, "No puzzle for that date.");

  const { data, error } = await db
    .from("daily_holes")
    .select("hole_number, target_rank, par, question:questions!inner(*)")
    .eq("date", date)
    .order("hole_number");
  if (error) throw error;
  return data as unknown as HoleRow[];
}

async function loadPlay(db: Admin, userId: string, date: string) {
  const { data, error } = await db
    .from("plays")
    .select("id, is_archive, completed_at, total_strokes, guesses(hole_number, entity_id, actual_rank, actual_value, strokes)")
    .eq("date", date)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadRankings(db: Admin, questionIds: string[]): Promise<Map<string, RankingRow[]>> {
  const out = new Map<string, RankingRow[]>();
  if (questionIds.length === 0) return out;
  const { data, error } = await db
    .from("question_rankings")
    .select("question_id, entity_id, rank, value, entity:entities!inner(name)")
    .in("question_id", questionIds);
  if (error) throw error;
  for (const r of data as unknown as {
    question_id: string;
    entity_id: string;
    rank: number;
    value: number;
    entity: { name: string };
  }[]) {
    const list = out.get(r.question_id) ?? [];
    list.push({ entityId: r.entity_id, name: r.entity.name, rank: r.rank, value: Number(r.value) });
    out.set(r.question_id, list);
  }
  return out;
}

async function entityNames(db: Admin, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("entities").select("id, name").in("id", ids);
  if (error) throw error;
  return new Map(data.map((e) => [e.id, e.name]));
}

/** Builds the player's view of a day. Prompts and rankings are included only when allowed. */
export async function loadPlayState(db: Admin, userId: string, date: string): Promise<PlayState> {
  const holes = await loadHoles(db, date);
  const play = await loadPlay(db, userId, date);
  const guesses = new Map((play?.guesses ?? []).map((g) => [g.hole_number, g]));

  const playedHoles = holes.filter((h) => guesses.has(h.hole_number));
  const rankings = await loadRankings(db, playedHoles.map((h) => h.question.id));
  const names = await entityNames(db, [...guesses.values()].map((g) => g.entity_id));

  let currentAssigned = false;
  let strokesSoFar = 0;
  let parSoFar = 0;
  const views: HoleView[] = holes.map((h) => {
    const q = h.question;
    const base = {
      holeNumber: h.hole_number,
      par: h.par ?? DEFAULT_PAR,
      targetRank: h.target_rank,
      prompt: q.prompt,
      scopeNote: q.scope_note,
      statLabel: q.stat_label,
      answerType: q.answer_type,
    };
    const g = guesses.get(h.hole_number);
    if (g) {
      strokesSoFar += g.strokes;
      parSoFar += base.par;
      const played: PlayedHole = {
        ...base,
        status: "played",
        valueOrder: q.value_order,
        sourceName: q.source_name,
        sourceUrl: q.source_url,
        dataAsOf: q.data_as_of,
        guess: {
          entityId: g.entity_id,
          name: names.get(g.entity_id) ?? "Unknown",
          actualRank: g.actual_rank,
          actualValue: g.actual_value === null ? null : Number(g.actual_value),
          strokes: g.strokes,
        },
        reveal: revealSlice(rankings.get(q.id) ?? [], h.target_rank, g.entity_id),
      };
      return played;
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...base, status: "current" };
    }
    return { status: "locked", holeNumber: h.hole_number, par: base.par };
  });

  return {
    date,
    puzzleNumber: puzzleNumber(date),
    isArchive: play ? play.is_archive : date < puzzleToday(),
    holes: views,
    totalPar: views.reduce((s, h) => s + h.par, 0),
    completed: Boolean(play?.completed_at),
    strokesSoFar,
    parSoFar,
  };
}

/** Scores and records one guess, completing the play after the last hole. */
export async function submitGuess(
  db: Admin,
  userId: string,
  date: string,
  holeNumber: number,
  entityId: string,
): Promise<PlayState> {
  const holes = await loadHoles(db, date);
  const hole = holes.find((h) => h.hole_number === holeNumber);
  if (!hole) throw new HttpError(400, "That hole doesn't exist.");

  const existing = await loadPlay(db, userId, date);
  if (existing?.completed_at) throw new HttpError(409, "You've already finished this round.");
  const guessed = new Set((existing?.guesses ?? []).map((g) => g.hole_number));
  if (guessed.has(holeNumber)) throw new HttpError(409, "You've already played this hole.");
  const nextHole = holes.find((h) => !guessed.has(h.hole_number));
  if (nextHole?.hole_number !== holeNumber) throw new HttpError(409, "Play the holes in order.");

  const { data: entity, error: eErr } = await db
    .from("entities")
    .select("id, type, sport")
    .eq("id", entityId)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!entity || entity.type !== hole.question.answer_type || entity.sport !== hole.question.sport) {
    throw new HttpError(400, "Pick an answer from the list.");
  }

  const { data: rows, error: rErr } = await db
    .from("question_rankings")
    .select("entity_id, rank, value")
    .eq("question_id", hole.question.id);
  if (rErr) throw rErr;
  const score = scoreGuess({
    ranking: rows.map((r) => ({ entityId: r.entity_id, rank: r.rank, value: Number(r.value) })),
    targetRank: hole.target_rank,
    guessEntityId: entityId,
  });

  let playId = existing?.id;
  if (!playId) {
    const { error: insErr } = await db
      .from("plays")
      .upsert(
        { date, user_id: userId, is_archive: date < puzzleToday() },
        { onConflict: "date,user_id", ignoreDuplicates: true },
      );
    if (insErr) throw insErr;
    const created = await loadPlay(db, userId, date);
    if (!created) throw new Error("Play was not created");
    playId = created.id;
  }

  const { error: gErr } = await db.from("guesses").insert({
    play_id: playId,
    hole_number: holeNumber,
    entity_id: entityId,
    actual_rank: score.actualRank,
    actual_value: score.actualValue,
    strokes: score.strokes,
  });
  if (gErr) {
    // 23505 = unique violation (double submit); 23514 = trigger check (order/availability)
    if (gErr.code === "23505") throw new HttpError(409, "You've already played this hole.");
    if (gErr.code === "23514") throw new HttpError(409, gErr.message);
    throw gErr;
  }

  if (holeNumber === holes.at(-1)!.hole_number) {
    await completePlay(db, userId, playId);
  }
  return loadPlayState(db, userId, date);
}

async function completePlay(db: Admin, userId: string, playId: string) {
  const { data: gs, error } = await db.from("guesses").select("strokes").eq("play_id", playId);
  if (error) throw error;
  const total = gs.reduce((s, g) => s + g.strokes, 0);
  const { error: uErr } = await db
    .from("plays")
    .update({ completed_at: new Date().toISOString(), total_strokes: total })
    .eq("id", playId)
    .is("completed_at", null);
  if (uErr) throw uErr;
  const { error: sErr } = await db.rpc("server_recompute_profile_stats", { p_user_id: userId });
  if (sErr) throw sErr;
}
