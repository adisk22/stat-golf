/**
 * Pure scoring rules for Stat Golf. No I/O; call it only from server code so
 * clients never need the ranking.
 *
 * Rules:
 *  - strokes = |actual_rank - target_rank|, 0 is a hole in one.
 *  - Ranks use standard competition ranking (1, 2, 2, 4); every entity sharing
 *    the target rank scores 0.
 *  - A guess that is not in the stored ranking scores `maxStrokes`.
 *  - Strokes per hole never exceed `maxStrokes`.
 */
import { DEFAULT_PAR, MAX_STROKES_PER_HOLE } from "./config";

export interface RankedEntity {
  entityId: string;
  rank: number;
  value: number;
}

export interface HoleScore {
  /** null when the guess is not in the stored ranking. */
  actualRank: number | null;
  actualValue: number | null;
  strokes: number;
  onList: boolean;
}

export interface ScoreGuessInput {
  ranking: readonly RankedEntity[];
  targetRank: number;
  guessEntityId: string;
  maxStrokes?: number;
}

function assertPositiveInt(name: string, n: number) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${n}`);
  }
}

export function strokesFor(
  actualRank: number | null,
  targetRank: number,
  maxStrokes: number = MAX_STROKES_PER_HOLE,
): number {
  assertPositiveInt("targetRank", targetRank);
  assertPositiveInt("maxStrokes", maxStrokes);
  if (actualRank === null) return maxStrokes;
  assertPositiveInt("actualRank", actualRank);
  return Math.min(Math.abs(actualRank - targetRank), maxStrokes);
}

export function scoreGuess({
  ranking,
  targetRank,
  guessEntityId,
  maxStrokes = MAX_STROKES_PER_HOLE,
}: ScoreGuessInput): HoleScore {
  const row = ranking.find((r) => r.entityId === guessEntityId);
  const actualRank = row ? row.rank : null;
  return {
    actualRank,
    actualValue: row ? row.value : null,
    strokes: strokesFor(actualRank, targetRank, maxStrokes),
    onList: row !== undefined,
  };
}

export interface RoundHole {
  strokes: number;
  par?: number;
}

export interface RoundTotal {
  totalStrokes: number;
  totalPar: number;
  /** totalStrokes - totalPar; negative is under par. */
  relativeToPar: number;
}

export function scoreRound(holes: readonly RoundHole[]): RoundTotal {
  let totalStrokes = 0;
  let totalPar = 0;
  for (const h of holes) {
    if (!Number.isInteger(h.strokes) || h.strokes < 0) {
      throw new RangeError(`strokes must be a non-negative integer, got ${h.strokes}`);
    }
    totalStrokes += h.strokes;
    totalPar += h.par ?? DEFAULT_PAR;
  }
  return { totalStrokes, totalPar, relativeToPar: totalStrokes - totalPar };
}

/** "E" for even, "+2" over, "-1" under. */
export function formatRelativeToPar(relative: number): string {
  if (relative === 0) return "E";
  return relative > 0 ? `+${relative}` : `${relative}`;
}
