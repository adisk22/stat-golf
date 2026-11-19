import { EntityBadge } from "@/components/ui/entity-badge";
import type { PlayedHole } from "@/lib/game-types";
import type { RevealRow } from "@/lib/reveal";
import { formatPuzzleDate } from "@/lib/dates";
import { formatValue, ordinal, strokesLabel } from "./format";

/** After a guess: the guess's rank and value, strokes, and the table around the target. */
export function HoleReveal({ hole }: { hole: PlayedHole }) {
  const { guess, reveal } = hole;
  return (
    <div className="space-y-4" data-testid={`reveal-${hole.holeNumber}`}>
      <div className="rounded-lg bg-fairway-50 p-4 text-center">
        <p className="text-sm text-zinc-600">
          <span className="font-semibold text-zinc-900">{guess.name}</span>{" "}
          {guess.actualRank === null
            ? "isn't in this ranking."
            : `ranks ${ordinal(guess.actualRank)} with ${formatValue(guess.actualValue)} (${hole.statLabel.toLowerCase()}).`}
        </p>
        <p className="mt-1 text-2xl font-bold text-fairway-800" data-testid="hole-result">
          {strokesLabel(guess.strokes)}
        </p>
        <p className="text-xs text-zinc-500">Target was {ordinal(hole.targetRank)}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-12 px-2 py-1.5 text-right">#</th>
              <th className="px-2 py-1.5 text-left">Name</th>
              <th className="px-2 py-1.5 text-right">{hole.statLabel}</th>
            </tr>
          </thead>
          <tbody>
            {reveal.rows.map((r) => (
              <Row key={r.entityId} r={r} />
            ))}
            {reveal.guessOutside && (
              <>
                <tr>
                  <td colSpan={3} className="px-2 text-center text-zinc-400">⋯</td>
                </tr>
                <Row r={reveal.guessOutside} />
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Source:{" "}
        {hole.sourceUrl ? (
          <a href={hole.sourceUrl} className="underline" target="_blank" rel="noreferrer noopener">
            {hole.sourceName ?? hole.sourceUrl}
          </a>
        ) : (
          (hole.sourceName ?? "unknown")
        )}
        {hole.dataAsOf && <> · data as of {formatPuzzleDate(hole.dataAsOf)}</>}
        {` · ${reveal.totalRows} ranked`}
      </p>
    </div>
  );
}

function Row({ r }: { r: RevealRow }) {
  const tone = r.isGuess && r.isTarget ? "bg-fairway-200" : r.isGuess ? "bg-amber-100" : r.isTarget ? "bg-fairway-100" : "";
  return (
    <tr className={`border-t border-zinc-100 ${tone}`} data-target={r.isTarget || undefined} data-guess={r.isGuess || undefined}>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{r.rank}</td>
      <td className="px-2 py-1.5">
        <span className="flex items-center gap-2">
          <EntityBadge name={r.name} size={20} />
          <span className={r.isTarget || r.isGuess ? "font-semibold" : ""}>{r.name}</span>
          {r.isTarget && <span className="rounded bg-fairway-700 px-1 text-[10px] font-semibold text-white">TARGET</span>}
          {r.isGuess && <span className="rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">YOU</span>}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(r.value)}</td>
    </tr>
  );
}
