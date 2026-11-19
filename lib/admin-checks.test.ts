import { describe, expect, it } from "vitest";
import type { EditorQuestion } from "./admin-types";
import { publishErrors, puzzleWarnings } from "./admin-checks";

const q = (id: string, over: Partial<EditorQuestion> = {}): EditorQuestion => ({
  id,
  prompt: id,
  answerType: "club",
  statLabel: "x",
  scopeNote: null,
  ready: true,
  rowCount: 40,
  heldRanks: [1, 2, 4, 5, 6, 7, 8, 9, 10],
  usedDates: [],
  ...over,
});

describe("publishErrors", () => {
  const qs = [q("a"), q("b"), q("c"), q("d", { ready: false })];

  it("accepts 3 valid holes", () => {
    const holes = ["a", "b", "c"].map((id) => ({ questionId: id, targetRank: 4, par: 3 }));
    expect(publishErrors(holes, qs)).toEqual([]);
  });

  it("requires 3-5 holes", () => {
    expect(publishErrors([{ questionId: "a", targetRank: 1, par: 3 }], qs)[0]).toMatch(/3-5 holes/);
  });

  it("rejects a target inside a tie, unready questions and duplicates", () => {
    const errs = publishErrors(
      [
        { questionId: "a", targetRank: 3, par: 3 },
        { questionId: "d", targetRank: 1, par: 3 },
        { questionId: "a", targetRank: 1, par: 3 },
      ],
      qs,
    );
    expect(errs).toEqual([
      expect.stringMatching(/^Hole 1: No entity holds rank 3/),
      "Hole 2: question is not marked ready.",
      "Each question can only be used once per day.",
    ]);
  });
});

describe("puzzleWarnings", () => {
  it("warns on reuse within 60 days and short lists", () => {
    const qs = [q("a", { usedDates: ["2026-01-01", "2026-04-15"], rowCount: 10 })];
    expect(puzzleWarnings("2026-02-01", [{ questionId: "a", targetRank: 2, par: 3 }], qs)).toEqual([
      "Hole 1: question also used on 2026-01-01 (within 60 days).",
      "Hole 1: 10 rows stored; 17 recommended for target 2 unless the list is complete.",
    ]);
  });

  it("ignores the date itself and older uses", () => {
    const qs = [q("a", { usedDates: ["2025-06-01", "2026-02-01"] })];
    expect(puzzleWarnings("2026-02-01", [{ questionId: "a", targetRank: 2, par: 3 }], qs)).toEqual([]);
  });
});
