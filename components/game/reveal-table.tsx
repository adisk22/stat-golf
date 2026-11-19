import { EntityBadge } from "@/components/ui/entity-badge";
import type { PlayedHole } from "@/lib/game-types";
import type { RevealRow } from "@/lib/reveal";
import { formatPuzzleDate } from "@/lib/dates";
import { formatValue } from "./format";
import { ShotResult } from "./shot-result";

/** After a guess: the guess's rank and value, strokes, and the table around the target. */
export function HoleReveal({ hole }: { hole: PlayedHole }) {
  const { reveal } = hole;
  return (
    <div className="animate-rise-in space-y-3" data-testid={`reveal-${hole.holeNumber}`}>
      <ShotResult hole={hole} />

      <div className="paper overflow-hidden rounded-lg border border-[#d8cfb3]">
        <table className="w-full text-sm">
          <thead className="bg-fairway-800 font-card text-xs uppercase tracking-widest text-paper">
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
    <tr className={`border-t border-paper-line ${tone}`} data-target={r.isTarget || undefined} data-guess={r.isGuess || undefined}>
      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{r.rank}</td>
      <td className="px-2 py-1.5">
        <span className="flex items-center gap-2">
          <EntityBadge name={r.name} size={20} />
          <span className={r.isTarget || r.isGuess ? "font-semibold" : ""}>{r.name}</span>
          {r.isTarget && <span className="rounded-sm bg-flag px-1 font-card text-[10px] font-semibold tracking-wider text-white">⛳ PIN</span>}
          {r.isGuess && <span className="rounded-sm bg-pencil px-1 font-card text-[10px] font-semibold tracking-wider text-white">YOUR BALL</span>}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(r.value)}</td>
    </tr>
  );
}
