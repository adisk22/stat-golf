import type { HoleView } from "@/lib/game-types";
import { formatRelativeToPar } from "@/lib/scoring";
import { ordinal } from "./format";

interface Props {
  holes: HoleView[];
  strokesSoFar: number;
  parSoFar: number;
  selected: number | null;
  onSelect: (holeNumber: number) => void;
}

/** Golf-card header: one column per hole, then the running total. */
export function Scorecard({ holes, strokesSoFar, parSoFar, selected, onSelect }: Props) {
  const cell = "px-1 py-1.5 text-center tabular-nums";
  return (
    <div className="overflow-hidden rounded-xl border border-fairway-200 bg-white shadow-sm" data-testid="scorecard">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-fairway-700 text-xs font-semibold uppercase tracking-wide text-fairway-50">
          <tr>
            <th className={`${cell} w-16 text-left pl-3`}>Hole</th>
            {holes.map((h) => (
              <th key={h.holeNumber} className={cell}>
                <button
                  type="button"
                  onClick={() => onSelect(h.holeNumber)}
                  disabled={h.status !== "played"}
                  aria-label={`Hole ${h.holeNumber}`}
                  className={`w-full rounded ${selected === h.holeNumber ? "bg-fairway-500" : ""} disabled:cursor-default`}
                >
                  {h.holeNumber}
                </button>
              </th>
            ))}
            <th className={`${cell} w-14`}>Tot</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fairway-100">
          <tr>
            <th className={`${cell} text-left pl-3 font-medium text-zinc-500`}>Target</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={`${cell} text-zinc-700`}>
                {h.status === "locked" ? "–" : ordinal(h.targetRank)}
              </td>
            ))}
            <td className={cell} />
          </tr>
          <tr>
            <th className={`${cell} text-left pl-3 font-medium text-zinc-500`}>Par</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={`${cell} text-zinc-700`}>{h.par}</td>
            ))}
            <td className={`${cell} text-zinc-700`}>{holes.reduce((s, h) => s + h.par, 0)}</td>
          </tr>
          <tr className="font-semibold">
            <th className={`${cell} text-left pl-3 text-zinc-500`}>Strokes</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={cell} data-testid={`strokes-${h.holeNumber}`}>
                {h.status === "played" ? <StrokeChip strokes={h.guess.strokes} par={h.par} /> : ""}
              </td>
            ))}
            <td className={cell} data-testid="strokes-total">
              {strokesSoFar}
              {parSoFar > 0 && (
                <span className="ml-0.5 block text-[10px] font-normal text-zinc-500">
                  {formatRelativeToPar(strokesSoFar - parSoFar)}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StrokeChip({ strokes, par }: { strokes: number; par: number }) {
  const tone =
    strokes === 0
      ? "bg-fairway-600 text-white"
      : strokes < par
        ? "bg-fairway-100 text-fairway-800"
        : strokes === par
          ? "text-zinc-800"
          : "bg-red-50 text-red-700";
  return <span className={`inline-block min-w-6 rounded-full px-1.5 ${tone}`}>{strokes}</span>;
}
