import { describe, expect, it } from "vitest";
import { checkTargetRank, competitionRanks, heldRanks } from "./ranking";

describe("competitionRanks", () => {
  it("assigns 1224 ranking to ties", () => {
    expect(competitionRanks([10, 8, 8, 5])).toEqual([1, 2, 2, 4]);
  });
  it("handles a leading tie and a trailing tie", () => {
    expect(competitionRanks([9, 9, 9, 4, 1, 1])).toEqual([1, 1, 1, 4, 5, 5]);
  });
  it("works for ascending lists too (input is pre-sorted)", () => {
    expect(competitionRanks([0.5, 0.7, 0.7, 1.2])).toEqual([1, 2, 2, 4]);
  });
  it("handles empty input", () => {
    expect(competitionRanks([])).toEqual([]);
  });
});

describe("heldRanks", () => {
  it("dedupes and sorts", () => {
    expect(heldRanks([4, 1, 2, 2])).toEqual([1, 2, 4]);
  });
});

describe("checkTargetRank", () => {
  const ranks = Array.from({ length: 30 }, (_, i) => i + 1);
  ranks[2] = 2; // 1, 2, 2, 4, 5 ... -> rank 3 is not held

  it("accepts a held rank", () => {
    expect(checkTargetRank(4, ranks, 15)).toEqual({ ok: true, warnings: [] });
  });

  it("rejects a rank that falls inside a tie and suggests neighbours", () => {
    const res = checkTargetRank(3, ranks, 15);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("2 or 4");
  });

  it("rejects ranks past the end of the list", () => {
    expect(checkTargetRank(31, ranks, 15).ok).toBe(false);
  });

  it("rejects non-integer and non-positive targets", () => {
    expect(checkTargetRank(0, ranks).ok).toBe(false);
    expect(checkTargetRank(2.5, ranks).ok).toBe(false);
  });

  it("rejects an empty ranking", () => {
    expect(checkTargetRank(1, []).ok).toBe(false);
  });

  it("warns when the list is shorter than target + max strokes", () => {
    const res = checkTargetRank(20, ranks, 15);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings).toHaveLength(1);
  });
});
