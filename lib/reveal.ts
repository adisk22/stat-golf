import { REVEAL_WINDOW } from "./config";

export interface RankingRow {
  entityId: string;
  name: string;
  rank: number;
  value: number;
}

export interface RevealRow extends RankingRow {
  isTarget: boolean;
  isGuess: boolean;
}

export interface RevealSlice {
  rows: RevealRow[];
  /** The guess's row when it falls outside the window (shown separately). */
  guessOutside: RevealRow | null;
  totalRows: number;
}

/**
 * Rows around the target: every row whose rank is within `window` of the
 * target rank (ties included), sorted by rank then name.
 */
export function revealSlice(
  ranking: readonly RankingRow[],
  targetRank: number,
  guessEntityId: string | null,
  window: number = REVEAL_WINDOW,
): RevealSlice {
  const sorted = [...ranking].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const mark = (r: RankingRow): RevealRow => ({
    ...r,
    isTarget: r.rank === targetRank,
    isGuess: r.entityId === guessEntityId,
  });
  const rows = sorted.filter((r) => Math.abs(r.rank - targetRank) <= window).map(mark);
  const guessRow = sorted.find((r) => r.entityId === guessEntityId);
  const guessOutside = guessRow && !rows.some((r) => r.isGuess) ? mark(guessRow) : null;
  return { rows, guessOutside, totalRows: sorted.length };
}
