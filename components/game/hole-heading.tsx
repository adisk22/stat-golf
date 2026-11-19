import type { HoleQuestion } from "@/lib/game-types";
import { ordinal } from "./format";

/** Tee-box sign: hole number, par, the target pennant and the question. Shared with the admin preview. */
export function HoleHeading({ hole }: { hole: HoleQuestion }) {
  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col items-center justify-center rounded-md bg-fairway-800 px-3 py-1 text-paper shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]">
          <span className="font-card text-[10px] uppercase tracking-[0.3em] text-fairway-200">Hole</span>
          <span className="font-card text-2xl font-semibold leading-none" data-testid="hole-number">
            {hole.holeNumber}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md border-2 border-fairway-800/15 bg-white px-3 py-1">
          <span className="font-card text-[10px] uppercase tracking-[0.3em] text-zinc-500">Par</span>
          <span className="font-card text-2xl font-semibold leading-none text-zinc-800">{hole.par}</span>
        </div>
        <div className="relative ml-auto flex items-center">
          <span
            className="flag-pennant flex items-center gap-1.5 bg-flag py-1.5 pl-3 pr-6 font-card text-lg font-semibold uppercase tracking-wider text-white shadow"
            data-testid="target"
          >
            Target: {ordinal(hole.targetRank)}
          </span>
        </div>
      </div>
      <h2 className="text-xl font-semibold leading-snug text-zinc-900 sm:text-2xl" data-testid="prompt">
        {hole.prompt}
      </h2>
      {hole.scopeNote && <p className="text-sm text-zinc-500">{hole.scopeNote}</p>}
      <p className="text-sm text-zinc-600">
        Name the {hole.answerType} sitting <strong>{ordinal(hole.targetRank)}</strong>. Every place you miss by is a
        stroke.
      </p>
    </div>
  );
}
