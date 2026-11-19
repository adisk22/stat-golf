/**
 * Integration tests against the local Supabase stack (`pnpm supabase start`
 * then `pnpm db:reset`). Run with `pnpm test:db`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymousUser, dayOffset, must, ok, serviceClient } from "./helpers";

const admin = serviceClient();
const today = dayOffset(0);
const yesterday = dayOffset(-1);
const tomorrow = dayOffset(1);

interface Hole {
  hole_number: number;
  question_id: string;
  target_rank: number;
}

async function holesFor(date: string): Promise<Hole[]> {
  return must(
    admin.from("daily_holes").select("hole_number, question_id, target_rank").eq("date", date).order("hole_number"),
  );
}

async function anyClubId(): Promise<string> {
  const rows = await must(admin.from("entities").select("id").eq("type", "club").limit(1));
  return rows[0].id;
}

async function createPlay(userId: string, date: string, extra: Record<string, unknown> = {}) {
  const rows = await must(admin.from("plays").insert({ user_id: userId, date, ...extra }).select("id"));
  return rows[0].id as string;
}

async function guess(playId: string, hole: number, entityId: string) {
  return admin.from("guesses").insert({ play_id: playId, hole_number: hole, entity_id: entityId, strokes: 1 });
}

const createdDates: string[] = [];
afterAll(async () => {
  for (const d of createdDates) {
    await admin.from("daily_puzzles").delete().eq("date", d);
  }
});

describe("anonymous player access", () => {
  let player: Awaited<ReturnType<typeof anonymousUser>>;
  beforeAll(async () => {
    player = await anonymousUser();
  });

  it("gets a profile automatically", async () => {
    const rows = await must(player.client.from("profiles").select("user_id, is_admin"));
    expect(rows).toEqual([{ user_id: player.userId, is_admin: false }]);
  });

  it("can read all entities (autocomplete) and search them", async () => {
    const rows = await must(player.client.from("entities").select("id"));
    expect(rows.length).toBeGreaterThanOrEqual(30);
    const hits = await must(player.client.rpc("search_entities", { p_type: "club", p_query: "mockford" }));
    expect((hits as { name: string }[])[0].name).toBe("Mockford Town");
  });

  it("cannot read puzzles, holes or rankings before guessing", async () => {
    for (const table of ["daily_puzzles", "daily_holes", "question_rankings"] as const) {
      const rows = await must(player.client.from(table).select("*"));
      expect(rows, table).toEqual([]);
    }
  });

  it("can see only hole 1's question for published, non-future dates", async () => {
    const visible = (await must(player.client.from("questions").select("id"))).map((r) => r.id);
    const firstHoles = [...(await holesFor(yesterday)), ...(await holesFor(today))]
      .filter((h) => h.hole_number === 1)
      .map((h) => h.question_id);
    expect(visible.sort()).toEqual(firstHoles.sort());
    const tomorrowHole1 = (await holesFor(tomorrow))[0].question_id;
    expect(visible).not.toContain(tomorrowHole1);
  });

  it("cannot write plays or guesses directly", async () => {
    const { error } = await player.client.from("plays").insert({ user_id: player.userId, date: today });
    expect(error).not.toBeNull();
  });

  it("cannot call server-only functions", async () => {
    const { error } = await player.client.rpc("server_check_rate_limit", {
      p_key: "x",
      p_limit: 1,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
  });

  it("can rename itself but cannot make itself admin or edit stats", async () => {
    await ok(player.client.from("profiles").update({ display_name: "Tester" }).eq("user_id", player.userId));
    const { error: adminErr } = await player.client
      .from("profiles")
      .update({ is_admin: true })
      .eq("user_id", player.userId);
    expect(adminErr).not.toBeNull();
    const { error: statErr } = await player.client
      .from("profiles")
      .update({ best_streak: 99 })
      .eq("user_id", player.userId);
    expect(statErr).not.toBeNull();
  });
});

describe("guess flow and reveal rules", () => {
  it("enforces hole order, one guess per hole, and reveals only guessed holes", async () => {
    const player = await anonymousUser();
    const holes = await holesFor(today);
    const club = await anyClubId();
    const playId = await createPlay(player.userId, today);

    // Out of order
    const outOfOrder = await guess(playId, 2, club);
    expect(outOfOrder.error?.message).toMatch(/must be played before/);

    // Nothing revealed yet
    expect(await must(player.client.from("question_rankings").select("question_id"))).toEqual([]);

    // Hole 1
    await ok(guess(playId, 1, club));
    const duplicate = await guess(playId, 1, club);
    expect(duplicate.error).not.toBeNull();

    const revealed = await must(player.client.from("question_rankings").select("question_id"));
    expect(new Set(revealed.map((r) => r.question_id))).toEqual(new Set([holes[0].question_id]));

    // Hole 2's prompt is now visible; hole 3's is not
    const qs = (await must(player.client.from("questions").select("id"))).map((r) => r.id);
    expect(qs).toContain(holes[1].question_id);
    expect(qs).not.toContain(holes[2].question_id);

    // Guesses are immutable
    const upd = await admin.from("guesses").update({ strokes: 0 }).eq("play_id", playId);
    expect(upd.error).not.toBeNull();
  });

  it("rejects guesses for a future puzzle", async () => {
    const player = await anonymousUser();
    const playId = await createPlay(player.userId, tomorrow);
    const res = await guess(playId, 1, await anyClubId());
    expect(res.error?.message).toMatch(/not available/);
  });

  it("rejects guesses after the play is complete", async () => {
    const player = await anonymousUser();
    const playId = await createPlay(player.userId, yesterday, {
      completed_at: new Date().toISOString(),
      total_strokes: 5,
    });
    const res = await guess(playId, 1, await anyClubId());
    expect(res.error?.message).toMatch(/already complete/);
  });
});

describe("admin integrity rules", () => {
  it("locks rankings of questions used in published puzzles", async () => {
    const hole = (await holesFor(today))[0];
    const res = await admin
      .from("question_rankings")
      .update({ value: 1 })
      .eq("question_id", hole.question_id)
      .eq("rank", 1);
    expect(res.error?.message).toMatch(/locked/);
  });

  it("refuses to unpublish a puzzle that has plays", async () => {
    const player = await anonymousUser();
    await createPlay(player.userId, yesterday);
    const res = await admin.from("daily_puzzles").update({ published: false }).eq("date", yesterday);
    expect(res.error?.message).toMatch(/already has plays/);
  });

  it("blocks publishing with too few holes or a target inside a tie", async () => {
    const date = dayOffset(40);
    createdDates.push(date);
    await ok(admin.from("daily_puzzles").insert({ date }));

    // Find a question with a tie gap (a rank no entity holds).
    const questions = await must(admin.from("questions").select("id"));
    let gap: { questionId: string; rank: number } | undefined;
    for (const q of questions) {
      const ranks = (await must(admin.from("question_rankings").select("rank").eq("question_id", q.id))).map(
        (r) => r.rank as number,
      );
      const held = new Set(ranks);
      const missing = ranks.find((r) => !held.has(r + 1) && r + 1 <= ranks.length);
      if (missing !== undefined) {
        gap = { questionId: q.id, rank: missing + 1 };
        break;
      }
    }
    expect(gap).toBeDefined();

    const others = questions.filter((q) => q.id !== gap!.questionId).slice(0, 2);
    await ok(
      admin.from("daily_holes").insert([
        { date, hole_number: 1, question_id: others[0].id, target_rank: 1 },
        { date, hole_number: 2, question_id: others[1].id, target_rank: 1 },
      ]),
    );
    const tooFew = await admin.from("daily_puzzles").update({ published: true }).eq("date", date);
    expect(tooFew.error?.message).toMatch(/3-5 holes/);

    await ok(
      admin.from("daily_holes").insert({ date, hole_number: 3, question_id: gap!.questionId, target_rank: gap!.rank }),
    );
    const tieGap = await admin.from("daily_puzzles").update({ published: true }).eq("date", date);
    expect(tieGap.error?.message).toMatch(new RegExp(`no entity holds target rank ${gap!.rank}`));

    const errors = await must(admin.rpc("server_puzzle_publish_errors", { p_date: date }));
    expect(errors).toHaveLength(1);
  });
});

describe("stats, streaks and account merge", () => {
  const done = { completed_at: new Date().toISOString() };

  it("computes streaks from consecutive completed daily plays", async () => {
    const p = await anonymousUser();
    await createPlay(p.userId, yesterday, { ...done, total_strokes: 6 });
    await createPlay(p.userId, today, { ...done, total_strokes: 4 });
    await ok(admin.rpc("server_recompute_profile_stats", { p_user_id: p.userId }));
    const [profile] = await must(
      admin.from("profiles").select("current_streak, best_streak, games_played, total_strokes").eq("user_id", p.userId),
    );
    expect(profile).toEqual({ current_streak: 2, best_streak: 2, games_played: 2, total_strokes: 10 });
  });

  it("does not count archive plays toward streaks", async () => {
    const p = await anonymousUser();
    await createPlay(p.userId, yesterday, { ...done, total_strokes: 6, is_archive: true });
    await ok(admin.rpc("server_recompute_profile_stats", { p_user_id: p.userId }));
    const [profile] = await must(
      admin.from("profiles").select("current_streak, games_played").eq("user_id", p.userId),
    );
    expect(profile).toEqual({ current_streak: 0, games_played: 1 });
  });

  it("merges guest plays, keeping the account's play on conflicts", async () => {
    const guest = await anonymousUser();
    const account = await anonymousUser(); // stands in for a signed-in account
    const guestYesterday = await createPlay(guest.userId, yesterday, { ...done, total_strokes: 9 });
    const guestToday = await createPlay(guest.userId, today, { ...done, total_strokes: 3 });
    const accountYesterday = await createPlay(account.userId, yesterday, { ...done, total_strokes: 7 });

    const [result] = await must(
      admin.rpc("server_merge_user_plays", { p_from: guest.userId, p_to: account.userId }),
    );
    expect(result).toEqual({ merged: 1, skipped: 1 });

    const plays = await must(admin.from("plays").select("id, date").eq("user_id", account.userId).order("date"));
    expect(plays.map((p) => p.id)).toEqual([accountYesterday, guestToday]);
    const gone = await must(admin.from("plays").select("id").eq("id", guestYesterday));
    expect(gone).toEqual([]);

    const [profile] = await must(
      admin.from("profiles").select("current_streak, games_played, total_strokes").eq("user_id", account.userId),
    );
    expect(profile).toEqual({ current_streak: 2, games_played: 2, total_strokes: 10 });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        (await must(admin.rpc("server_check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 3600 }))) as boolean,
      );
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
