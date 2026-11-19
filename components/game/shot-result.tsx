import type { PlayedHole } from "@/lib/game-types";
import { scoreName } from "@/lib/golf-terms";
import { formatValue, ordinal, strokesLabel } from "./format";

const TONES = {
  ace: "border-flag text-flag",
  under: "border-fairway-700 text-fairway-700",
  par: "border-zinc-700 text-zinc-700",
  over: "border-amber-700 text-amber-700",
  lost: "border-sky-700 text-sky-700",
} as const;

/** The stamp + one-line explanation shown once the ball stops. */
export function ShotResult({ hole }: { hole: PlayedHole }) {
  const { guess } = hole;
  const name = scoreName(guess.strokes, hole.par, guess.actualRank !== null);
  const where =
    guess.actualRank === null
      ? "isn't in this ranking. Into the water."
      : guess.actualRank === hole.targetRank
        ? `sits exactly ${ordinal(guess.actualRank)}.`
        : `is ${ordinal(guess.actualRank)} (${formatValue(guess.actualValue)} ${hole.statLabel.toLowerCase()}), ${guess.actualRank < hole.targetRank ? "short of" : "past"} the flag.`;
  return (
    <div className="flex items-center gap-4 rounded-lg bg-white/70 p-3">
      <span
        className={`inline-block shrink-0 animate-stamp rounded-md border-[3px] px-2.5 py-1 font-card text-xl font-bold uppercase tracking-wider ${TONES[name.tone]}`}
        data-testid="score-name"
      >
        {name.label}
      </span>
      <div className="min-w-0 text-sm text-zinc-700">
        <p>
          <span className="font-semibold text-zinc-900">{guess.name}</span> {where}
        </p>
        <p className="font-card text-base font-semibold uppercase tracking-wide text-zinc-900" data-testid="hole-result">
          {strokesLabel(guess.strokes)}
        </p>
      </div>
    </div>
  );
}
