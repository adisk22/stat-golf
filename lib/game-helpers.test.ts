import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isIsoDate, puzzleNumber, puzzleToday } from "./dates";
import { revealSlice, type RankingRow } from "./reveal";
import { shareText, strokeEmoji } from "./share";

describe("dates", () => {
  it("computes the puzzle date in the rollover timezone", () => {
    const instant = new Date("2026-03-01T23:30:00Z");
    expect(puzzleToday(instant, "UTC")).toBe("2026-03-01");
    expect(puzzleToday(instant, "Europe/Berlin")).toBe("2026-03-02");
    expect(puzzleToday(instant, "America/New_York")).toBe("2026-03-01");
  });

  it("numbers puzzles from the epoch", () => {
    expect(puzzleNumber("2026-01-01", "2026-01-01")).toBe(1);
    expect(puzzleNumber("2026-02-11", "2026-01-01")).toBe(42);
  });

  it("does date arithmetic across month and DST boundaries", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-11-19")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("19/11/2026")).toBe(false);
    expect(isIsoDate("today")).toBe(false);
  });
});

describe("share", () => {
  it("buckets strokes into emoji", () => {
    expect([0, 1, 3, 4, 8, 9, 15].map(strokeEmoji).join("")).toBe("🟢🟡🟡🟠🟠🔴🔴");
  });

  it("builds spoiler-free share text", () => {
    expect(
      shareText({ puzzleNumber: 42, totalStrokes: 7, relativeToPar: -2, holeStrokes: [0, 2, 5] }),
    ).toBe("Stat Golf #42  ⛳ 7 (-2)\n🟢🟡🟠");
  });

  it("appends a URL when given", () => {
    expect(
      shareText({ puzzleNumber: 1, totalStrokes: 9, relativeToPar: 0, holeStrokes: [3, 3, 3], url: "https://x.test" }),
    ).toBe("Stat Golf #1  ⛳ 9 (E)\n🟡🟡🟡\nhttps://x.test");
  });
});

describe("revealSlice", () => {
  const ranking: RankingRow[] = Array.from({ length: 30 }, (_, i) => ({
    entityId: `e${i + 1}`,
    name: `Entity ${String(i + 1).padStart(2, "0")}`,
    rank: i + 1,
    value: 100 - i,
  }));
  // tie at 12: e12 and e13 both rank 12
  ranking[12] = { ...ranking[12], rank: 12, value: ranking[11].value };

  it("returns target ±window rows with the target and guess flagged", () => {
    const s = revealSlice(ranking, 10, "e8", 5);
    expect(s.rows.map((r) => r.rank)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 12, 14, 15]);
    expect(s.rows.filter((r) => r.isTarget).map((r) => r.entityId)).toEqual(["e10"]);
    expect(s.rows.filter((r) => r.isGuess).map((r) => r.entityId)).toEqual(["e8"]);
    expect(s.guessOutside).toBeNull();
    expect(s.totalRows).toBe(30);
  });

  it("flags every entity tied at the target", () => {
    const s = revealSlice(ranking, 12, null, 1);
    expect(s.rows.filter((r) => r.isTarget).map((r) => r.entityId)).toEqual(["e12", "e13"]);
  });

  it("returns the guess separately when outside the window", () => {
    const s = revealSlice(ranking, 3, "e25", 5);
    expect(s.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.guessOutside?.entityId).toBe("e25");
  });

  it("handles an off-list guess", () => {
    const s = revealSlice(ranking, 3, "unknown", 5);
    expect(s.guessOutside).toBeNull();
    expect(s.rows.some((r) => r.isGuess)).toBe(false);
  });
});
