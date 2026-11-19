import { describe, expect, it } from "vitest";
import { MAX_STROKES_PER_HOLE } from "./config";
import {
  formatRelativeToPar,
  scoreGuess,
  scoreRound,
  strokesFor,
  type RankedEntity,
} from "./scoring";

// Competition ranking with a tie at 3 and a tie at the bottom: 1, 2, 3, 3, 5, ..., 40, 40
function makeRanking(): RankedEntity[] {
  const rows: RankedEntity[] = [
    { entityId: "a", rank: 1, value: 100 },
    { entityId: "b", rank: 2, value: 90 },
    { entityId: "c", rank: 3, value: 80 },
    { entityId: "d", rank: 3, value: 80 },
  ];
  for (let r = 5; r <= 39; r++) rows.push({ entityId: `e${r}`, rank: r, value: 100 - r });
  rows.push({ entityId: "z1", rank: 40, value: 1 }, { entityId: "z2", rank: 40, value: 1 });
  return rows;
}

const ranking = makeRanking();

describe("scoreGuess", () => {
  it("scores an exact hit as a hole in one", () => {
    expect(scoreGuess({ ranking, targetRank: 2, guessEntityId: "b" })).toEqual({
      actualRank: 2,
      actualValue: 90,
      strokes: 0,
      onList: true,
    });
  });

  it("scores guesses ranked higher (better) than the target", () => {
    expect(scoreGuess({ ranking, targetRank: 10, guessEntityId: "a" }).strokes).toBe(9);
  });

  it("scores guesses ranked lower (worse) than the target", () => {
    expect(scoreGuess({ ranking, targetRank: 10, guessEntityId: "e14" }).strokes).toBe(4);
  });

  it("gives 0 to every entity tied at the target rank", () => {
    expect(scoreGuess({ ranking, targetRank: 3, guessEntityId: "c" }).strokes).toBe(0);
    expect(scoreGuess({ ranking, targetRank: 3, guessEntityId: "d" }).strokes).toBe(0);
  });

  it("measures distance from a tied rank using the shared rank", () => {
    // d shares rank 3; target 5 -> |3 - 5| = 2 (not its list position 4)
    expect(scoreGuess({ ranking, targetRank: 5, guessEntityId: "d" }).strokes).toBe(2);
  });

  it("gives the fixed penalty for an off-list guess", () => {
    expect(scoreGuess({ ranking, targetRank: 3, guessEntityId: "not-ranked" })).toEqual({
      actualRank: null,
      actualValue: null,
      strokes: MAX_STROKES_PER_HOLE,
      onList: false,
    });
  });

  it("caps strokes at the per-hole maximum", () => {
    // |40 - 1| = 39 -> capped
    expect(scoreGuess({ ranking, targetRank: 1, guessEntityId: "z1" }).strokes).toBe(
      MAX_STROKES_PER_HOLE,
    );
    expect(scoreGuess({ ranking, targetRank: 1, guessEntityId: "z1", maxStrokes: 20 }).strokes).toBe(20);
  });

  it("does not cap distances just under the maximum", () => {
    const target = 5;
    const guess = `e${target + MAX_STROKES_PER_HOLE - 1}`;
    expect(scoreGuess({ ranking, targetRank: target, guessEntityId: guess }).strokes).toBe(
      MAX_STROKES_PER_HOLE - 1,
    );
  });

  it("uses a custom off-list penalty", () => {
    expect(scoreGuess({ ranking, targetRank: 3, guessEntityId: "nope", maxStrokes: 7 }).strokes).toBe(7);
  });

  it("rejects invalid target ranks", () => {
    expect(() => scoreGuess({ ranking, targetRank: 0, guessEntityId: "a" })).toThrow(RangeError);
    expect(() => scoreGuess({ ranking, targetRank: 2.5, guessEntityId: "a" })).toThrow(RangeError);
  });
});

describe("strokesFor", () => {
  it("is symmetric", () => {
    expect(strokesFor(3, 8)).toBe(strokesFor(13, 8));
  });
});

describe("scoreRound", () => {
  it("sums strokes and par across holes", () => {
    expect(
      scoreRound([
        { strokes: 0, par: 3 },
        { strokes: 4, par: 3 },
        { strokes: MAX_STROKES_PER_HOLE, par: 4 },
      ]),
    ).toEqual({ totalStrokes: 4 + MAX_STROKES_PER_HOLE, totalPar: 10, relativeToPar: MAX_STROKES_PER_HOLE - 6 });
  });

  it("uses the default par when a hole has none", () => {
    expect(scoreRound([{ strokes: 1 }, { strokes: 1 }, { strokes: 1 }])).toEqual({
      totalStrokes: 3,
      totalPar: 9,
      relativeToPar: -6,
    });
  });

  it("handles an empty round", () => {
    expect(scoreRound([])).toEqual({ totalStrokes: 0, totalPar: 0, relativeToPar: 0 });
  });

  it("rejects negative strokes", () => {
    expect(() => scoreRound([{ strokes: -1 }])).toThrow(RangeError);
  });
});

describe("formatRelativeToPar", () => {
  it("formats even, over and under", () => {
    expect(formatRelativeToPar(0)).toBe("E");
    expect(formatRelativeToPar(2)).toBe("+2");
    expect(formatRelativeToPar(-3)).toBe("-3");
  });
});
