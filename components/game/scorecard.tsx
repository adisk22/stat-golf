import type { HoleView } from "@/lib/game-types";
import { GAME_NAME } from "@/lib/config";
import { formatPuzzleDate } from "@/lib/dates";
import { formatRelativeToPar } from "@/lib/scoring";
import { ordinal } from "./format";

interface Props {
  puzzleNumber: number;
  date: string;
  holes: HoleView[];
  strokesSoFar: number;
  parSoFar: number;
  selected: number | null;
  /** Hole currently being played (gets a pencil marker). */
  current: number | null;
  isArchive?: boolean;
  onSelect: (holeNumber: number) => void;
}

/** A paper golf scorecard: under par circled, over par boxed, scores in pencil. */
export function Scorecard({ puzzleNumber, date, holes, strokesSoFar, parSoFar, selected, current, isArchive, onSelect }: Props) {
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const label = "border-r-2 border-fairway-800/70 bg-fairway-800 px-2 text-left font-card text-[11px] font-semibold uppercase tracking-widest text-paper";
  const cell = "border-r border-paper-line text-center align-middle";

  return (
    <div
      className="paper relative overflow-hidden rounded-md border border-[#d8cfb3] shadow-[0_2px_0_#d8cfb3,0_10px_24px_-12px_rgb(0_0_0/0.35)]"
      data-testid="scorecard"
    >
      <div className="flex items-baseline justify-between border-b-2 border-dashed border-paper-line px-3 py-1.5">
        <span className="font-card text-xs font-semibold uppercase tracking-[0.25em] text-fairway-800">
          Course card <span className="sr-only">{GAME_NAME}</span>
        </span>
        <span className="whitespace-nowrap font-card text-xs uppercase tracking-wider text-zinc-500">
          No. {puzzleNumber} · {formatPuzzleDate(date).replace(/ \d{4}$/, "")}
          {isArchive && <span className="ml-1.5 rounded-sm bg-zinc-700 px-1 text-[10px] text-white">Archive</span>}
        </span>
      </div>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[4.6rem]" />
          {holes.map((h) => (
            <col key={h.holeNumber} />
          ))}
          <col className="w-[3.6rem]" />
        </colgroup>
        <thead>
          <tr className="h-8 bg-fairway-800 text-paper">
            <th className={label}>Hole</th>
            {holes.map((h) => (
              <th key={h.holeNumber} className="border-r border-fairway-700 p-0 font-card text-base font-semibold">
                <button
                  type="button"
                  onClick={() => onSelect(h.holeNumber)}
                  disabled={h.status !== "played"}
                  aria-label={`Hole ${h.holeNumber}`}
                  aria-pressed={selected === h.holeNumber}
                  className={`h-8 w-full transition-colors disabled:cursor-default ${selected === h.holeNumber ? "bg-flag text-white" : h.status === "played" ? "hover:bg-fairway-700" : ""}`}
                >
                  {h.holeNumber}
                </button>
              </th>
            ))}
            <th className="font-card text-xs font-semibold uppercase tracking-widest">Out</th>
          </tr>
        </thead>
        <tbody className="font-card text-sm text-zinc-700">
          <tr className="h-8 border-b border-paper-line">
            <th className={label}>Target</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={`${cell} text-[13px]`}>
                {h.status === "locked" ? <span className="text-zinc-300">·</span> : ordinal(h.targetRank)}
              </td>
            ))}
            <td className={cell} />
          </tr>
          <tr className="h-8 border-b border-paper-line">
            <th className={label}>Par</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={cell}>
                {h.par}
              </td>
            ))}
            <td className={`${cell} font-semibold`}>{totalPar}</td>
          </tr>
          <tr className="h-12 border-b border-paper-line">
            <th className={label}>Score</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={`${cell} relative`}>
                {h.status === "played" ? (
                  <ScoreMark strokes={h.guess.strokes} par={h.par} holeNumber={h.holeNumber} />
                ) : h.holeNumber === current ? (
                  <span aria-hidden className="inline-block -rotate-45 text-lg text-zinc-400">✎</span>
                ) : null}
              </td>
            ))}
            <td className={`${cell} font-hand text-[26px] font-bold leading-none text-pencil`} data-testid="strokes-total">
              {parSoFar > 0 ? strokesSoFar : ""}
            </td>
          </tr>
          <tr className="h-7">
            <th className={label}>+/−</th>
            {holes.map((h) => (
              <td key={h.holeNumber} className={`${cell} font-hand text-lg leading-none text-pencil/80`}>
                {h.status === "played" ? formatRelativeToPar(h.guess.strokes - h.par) : ""}
              </td>
            ))}
            <td className={`${cell} font-hand text-lg font-bold leading-none text-pencil`}>
              {parSoFar > 0 ? formatRelativeToPar(strokesSoFar - parSoFar) : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Pencilled score with the golf convention: ○ under par, ◎ hole in one / eagle, □ bogey, ⧈ double+. */
function ScoreMark({ strokes, par, holeNumber }: { strokes: number; par: number; holeNumber: number }) {
  const rel = strokes - par;
  const ring =
    strokes === 0 || rel <= -2
      ? "rounded-full outline outline-2 outline-offset-[3px] outline-flag border-2 border-flag"
      : rel === -1
        ? "rounded-full border-2 border-flag"
        : rel === 1
          ? "border-2 border-pencil/70"
          : rel >= 2
            ? "border-2 border-pencil/70 outline outline-2 outline-offset-[3px] outline-pencil/50"
            : "";
  return (
    <span
      className={`inline-grid h-8 min-w-8 animate-pencil place-items-center px-1 font-hand text-[26px] font-bold leading-none text-pencil ${ring}`}
      data-testid={`strokes-${holeNumber}`}
    >
      {strokes}
    </span>
  );
}
