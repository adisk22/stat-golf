/** Admin RPCs and admin RLS, against the local stack. */
import { beforeAll, describe, expect, it } from "vitest";
import { anonymousUser, dayOffset, emailUser, must, ok, serviceClient } from "./helpers";

const service = serviceClient();
let admin: Awaited<ReturnType<typeof emailUser>>;

beforeAll(async () => {
  admin = await emailUser({ admin: true });
});

async function newQuestion(prompt = `TEST question ${crypto.randomUUID()}`) {
  const [q] = await must(
    admin.client
      .from("questions")
      .insert({ prompt, answer_type: "club", stat_label: "Points", value_order: "desc" })
      .select("id"),
  );
  return q!.id;
}

async function clubIds(n: number) {
  const rows = await must(service.from("entities").select("id, name").eq("type", "club").order("name").limit(n));
  return rows;
}

describe("access control", () => {
  it("rejects guests and signed-in non-admins", async () => {
    const guest = await anonymousUser();
    const user = await emailUser();
    for (const c of [guest.client, user.client]) {
      const { error } = await c.rpc("admin_question_overview");
      expect(error?.code).toBe("42501");
      const ins = await c.from("questions").insert({ prompt: "nope", answer_type: "club", stat_label: "x" });
      expect(ins.error).not.toBeNull();
      const ent = await c.from("entities").insert({ type: "club", name: "Hacker FC" });
      expect(ent.error).not.toBeNull();
    }
  });

  it("lets admins list questions", async () => {
    const rows = await must(admin.client.rpc("admin_question_overview"));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows[0]).toHaveProperty("row_count");
  });
});

describe("admin_match_entities", () => {
  it("matches by exact name, alias, fuzzy, or not at all", async () => {
    const rows = await must(
      admin.client.rpc("admin_match_entities", {
        p_type: "club",
        p_names: ["fakeville united", "FVU", "Fakevile Untied", "Completely Unknown Athletic"],
      }),
    );
    expect(rows.map((r) => [r.idx, r.method])).toEqual([
      [1, "exact"],
      [2, "alias"],
      [3, "fuzzy"],
      [4, "none"],
    ]);
    const fakeville = (await must(service.from("entities").select("id").eq("name", "Fakeville United")))[0]!.id;
    expect(rows[0]!.entity_id).toBe(fakeville);
    expect(rows[1]!.entity_id).toBe(fakeville);
    expect(rows[2]!.entity_id).toBe(fakeville);
    expect(rows[3]!.entity_id).toBeNull();
  });

  it("only matches entities of the requested type", async () => {
    const rows = await must(admin.client.rpc("admin_match_entities", { p_type: "player", p_names: ["Fakeville United"] }));
    expect(rows[0]!.method).toBe("none");
  });
});

describe("admin_replace_ranking", () => {
  it("replaces the ranking atomically", async () => {
    const qid = await newQuestion();
    const clubs = await clubIds(3);
    const rows = clubs.map((c, i) => ({ entity_id: c.id, rank: i + 1, value: 30 - i }));
    expect(await must(admin.client.rpc("admin_replace_ranking", { p_question_id: qid, p_rows: rows }))).toBe(3);
    expect(await must(admin.client.rpc("admin_replace_ranking", { p_question_id: qid, p_rows: rows.slice(0, 2) }))).toBe(2);
    const stored = await must(service.from("question_rankings").select("rank").eq("question_id", qid));
    expect(stored).toHaveLength(2);
  });

  it("rolls back entirely when a row is invalid", async () => {
    const qid = await newQuestion();
    const clubs = await clubIds(2);
    await must(
      admin.client.rpc("admin_replace_ranking", {
        p_question_id: qid,
        p_rows: [{ entity_id: clubs[0]!.id, rank: 1, value: 9 }],
      }),
    );
    // Same entity twice -> PK violation -> nothing changes.
    const res = await admin.client.rpc("admin_replace_ranking", {
      p_question_id: qid,
      p_rows: [
        { entity_id: clubs[1]!.id, rank: 1, value: 9 },
        { entity_id: clubs[1]!.id, rank: 2, value: 8 },
      ],
    });
    expect(res.error).not.toBeNull();
    const stored = await must(service.from("question_rankings").select("entity_id").eq("question_id", qid));
    expect(stored).toEqual([{ entity_id: clubs[0]!.id }]);
  });

  it("refuses to change a ranking used in a published puzzle", async () => {
    const { data: hole } = await service.from("daily_holes").select("question_id").eq("date", dayOffset(0)).limit(1).single();
    const res = await admin.client.rpc("admin_replace_ranking", {
      p_question_id: hole!.question_id,
      p_rows: [{ entity_id: (await clubIds(1))[0]!.id, rank: 1, value: 1 }],
    });
    expect(res.error?.message).toMatch(/locked/);
  });
});

describe("admin_save_puzzle and publishing", () => {
  it("saves holes, reports publish errors, then publishes", async () => {
    const date = dayOffset(50 + Math.floor(Math.random() * 200));
    const clubs = await clubIds(26);
    const qids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const qid = await newQuestion();
      // values 26..1 with a tie at ranks 2/2 -> rank 3 not held
      const rows = clubs.map((c, j) => ({ entity_id: c.id, rank: j === 2 ? 2 : j + 1, value: j === 2 ? 25 : 26 - j }));
      await must(admin.client.rpc("admin_replace_ranking", { p_question_id: qid, p_rows: rows }));
      await ok(admin.client.from("questions").update({ status: "ready" }).eq("id", qid));
      qids.push(qid);
    }

    const errs = await must(
      admin.client.rpc("admin_save_puzzle", {
        p_date: date,
        p_holes: [
          { question_id: qids[0], target_rank: 1, par: 3 },
          { question_id: qids[1], target_rank: 3, par: 3 },
        ],
      }),
    );
    expect(errs).toEqual(["A puzzle needs 3-5 holes (has 2).", "Hole 2: no entity holds target rank 3."]);

    const blocked = await admin.client.rpc("admin_set_published", { p_date: date, p_published: true });
    expect(blocked.error?.message).toMatch(/Cannot publish/);

    const fixed = await must(
      admin.client.rpc("admin_save_puzzle", {
        p_date: date,
        p_holes: qids.map((id, i) => ({ question_id: id, target_rank: [1, 4, 10][i], par: 3 })),
      }),
    );
    expect(fixed).toEqual([]);
    await ok(admin.client.rpc("admin_set_published", { p_date: date, p_published: true }));
    const [p] = await must(service.from("daily_puzzles").select("published").eq("date", date));
    expect(p!.published).toBe(true);

    // Published days can't be edited until unpublished.
    const edit = await admin.client.rpc("admin_save_puzzle", { p_date: date, p_holes: [] });
    expect(edit.error?.message).toMatch(/published/);
    await ok(admin.client.rpc("admin_set_published", { p_date: date, p_published: false }));
    await must(admin.client.rpc("admin_save_puzzle", { p_date: date, p_holes: [] }));
    expect(await must(service.from("daily_puzzles").select("date").eq("date", date))).toEqual([]);
  });
});

describe("admin_merge_entities", () => {
  it("moves rankings and guesses, keeps the old name as an alias, deletes the duplicate", async () => {
    const [keep] = await must(admin.client.from("entities").insert({ type: "club", name: `Merge Keep ${crypto.randomUUID()}` }).select("id, name"));
    const [dupe] = await must(
      admin.client.from("entities").insert({ type: "club", name: `Merge Dupe ${crypto.randomUUID()}`, aliases: ["MD"] }).select("id, name"),
    );
    const qid = await newQuestion();
    await must(
      admin.client.rpc("admin_replace_ranking", { p_question_id: qid, p_rows: [{ entity_id: dupe!.id, rank: 1, value: 5 }] }),
    );

    await ok(admin.client.rpc("admin_merge_entities", { p_keep: keep!.id, p_remove: dupe!.id }));

    const ranking = await must(service.from("question_rankings").select("entity_id").eq("question_id", qid));
    expect(ranking).toEqual([{ entity_id: keep!.id }]);
    const [kept] = await must(service.from("entities").select("aliases").eq("id", keep!.id));
    expect(kept!.aliases).toEqual(expect.arrayContaining([dupe!.name, "MD"]));
    expect(await must(service.from("entities").select("id").eq("id", dupe!.id))).toEqual([]);
  });

  it("refuses when both entities are in the same ranking", async () => {
    const [a] = await must(admin.client.from("entities").insert({ type: "club", name: `Conflict A ${crypto.randomUUID()}` }).select("id"));
    const [b] = await must(admin.client.from("entities").insert({ type: "club", name: `Conflict B ${crypto.randomUUID()}` }).select("id"));
    const qid = await newQuestion("TEST conflict question");
    await must(
      admin.client.rpc("admin_replace_ranking", {
        p_question_id: qid,
        p_rows: [
          { entity_id: a!.id, rank: 1, value: 2 },
          { entity_id: b!.id, rank: 2, value: 1 },
        ],
      }),
    );
    const res = await admin.client.rpc("admin_merge_entities", { p_keep: a!.id, p_remove: b!.id });
    expect(res.error?.message).toMatch(/Both entities are ranked in: TEST conflict question/);
  });
});
