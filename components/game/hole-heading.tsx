import type { HoleQuestion } from "@/lib/game-types";
import { ordinal } from "./format";

/** Prompt, scope note and target for a hole (shared by the game and the admin preview). */
export function HoleHeading({ hole }: { hole: HoleQuestion }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-fairway-700">
        <span>Hole {hole.holeNumber} · par {hole.par}</span>
        <span className="rounded-full bg-fairway-700 px-2.5 py-0.5 text-white" data-testid="target">
          Target: {ordinal(hole.targetRank)}
        </span>
      </p>
      <h2 className="text-xl font-semibold leading-snug text-zinc-900" data-testid="prompt">{hole.prompt}</h2>
      {hole.scopeNote && <p className="text-sm text-zinc-500">{hole.scopeNote}</p>}
      <p className="text-sm text-zinc-600">
        Name the {hole.answerType} ranked <strong>{ordinal(hole.targetRank)}</strong>. Strokes = how far off your pick
        ranks.
      </p>
    </div>
  );
}
