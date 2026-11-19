/**
 * Golf names for a hole result. Our strokes are distance in ranks (0 = exact), so a
 * 0 is a "hole in one" and everything else is named relative to the hole's par.
 */
export type ScoreTone = "ace" | "under" | "par" | "over" | "lost";

export interface ScoreName {
  label: string;
  tone: ScoreTone;
}

export function scoreName(strokes: number, par: number, onList = true): ScoreName {
  if (!onList) return { label: "Lost ball", tone: "lost" };
  if (strokes === 0) return { label: "Hole in one!", tone: "ace" };
  const rel = strokes - par;
  if (rel <= -3) return { label: "Albatross", tone: "under" };
  if (rel === -2) return { label: "Eagle", tone: "under" };
  if (rel === -1) return { label: "Birdie", tone: "under" };
  if (rel === 0) return { label: "Par", tone: "par" };
  if (rel === 1) return { label: "Bogey", tone: "over" };
  if (rel === 2) return { label: "Double bogey", tone: "over" };
  if (rel === 3) return { label: "Triple bogey", tone: "over" };
  return { label: `+${rel}`, tone: "over" };
}

/** Where the ball ends up relative to the hole. Better rank than target = short, worse = long. */
export type Landing =
  | { kind: "hole" }
  | { kind: "short" | "long"; fraction: number }
  | { kind: "water" };

export function shotLanding(
  actualRank: number | null,
  targetRank: number,
  strokes: number,
  maxStrokes: number,
): Landing {
  if (actualRank === null) return { kind: "water" };
  if (strokes === 0) return { kind: "hole" };
  const fraction = Math.min(1, strokes / maxStrokes);
  return { kind: actualRank < targetRank ? "short" : "long", fraction };
}
