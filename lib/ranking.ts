/**
 * Ranking helpers shared by the CSV validator and the scheduler.
 */
import { MAX_STROKES_PER_HOLE } from "./config";

export type ValueOrder = "desc" | "asc";

/**
 * Standard competition ranking ("1224"): equal values share a rank and the
 * next distinct value skips ahead. Input must already be sorted by `order`.
 */
export function competitionRanks(sortedValues: readonly number[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < sortedValues.length; i++) {
    ranks.push(i > 0 && sortedValues[i] === sortedValues[i - 1] ? ranks[i - 1] : i + 1);
  }
  return ranks;
}

/** Distinct ranks actually held by at least one entity, ascending. */
export function heldRanks(ranks: readonly number[]): number[] {
  return [...new Set(ranks)].sort((a, b) => a - b);
}

export type TargetCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string };

/**
 * A target is valid only if some entity holds that exact rank (so a hole in one
 * is possible). It warns when the stored list is too short below the target,
 * because then genuinely-ranked guesses could get the off-list penalty.
 */
export function checkTargetRank(
  targetRank: number,
  ranks: readonly number[],
  maxStrokes: number = MAX_STROKES_PER_HOLE,
): TargetCheck {
  if (!Number.isInteger(targetRank) || targetRank < 1) {
    return { ok: false, error: "Target rank must be a positive whole number." };
  }
  if (ranks.length === 0) {
    return { ok: false, error: "This question has no ranking yet." };
  }
  if (!ranks.includes(targetRank)) {
    const held = heldRanks(ranks);
    const below = held.filter((r) => r < targetRank).at(-1);
    const above = held.find((r) => r > targetRank);
    const near = [below, above].filter((r) => r !== undefined).join(" or ");
    return {
      ok: false,
      error: `No entity holds rank ${targetRank} (it falls inside a tie or past the end of the list). Try ${near}.`,
    };
  }
  const warnings: string[] = [];
  const rowsNeeded = targetRank + maxStrokes;
  if (ranks.length < rowsNeeded) {
    warnings.push(
      `The list has ${ranks.length} rows; ${rowsNeeded} are recommended for target ${targetRank} unless it is the complete list.`,
    );
  }
  return { ok: true, warnings };
}
