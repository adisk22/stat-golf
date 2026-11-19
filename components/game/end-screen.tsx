"use client";
import { useState } from "react";
import type { PlayState, PlayedHole } from "@/lib/game-types";
import { scoreName } from "@/lib/golf-terms";
import { shareText, strokeEmoji } from "@/lib/share";
import { HoleReveal } from "./reveal-table";
import { ordinal } from "./format";

export function EndScreen({ state }: { state: PlayState }) {
  const played = state.holes.filter((h): h is PlayedHole => h.status === "played");
  const total = state.strokesSoFar;
  const relative = total - state.totalPar;
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [open, setOpen] = useState<number | null>(null);

  const text = shareText({
    puzzleNumber: state.puzzleNumber,
    totalStrokes: total,
    relativeToPar: relative,
    holeStrokes: played.map((h) => h.guess.strokes),
    url: typeof window !== "undefined" ? window.location.origin : undefined,
  });

  async function share() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const verdict = relative === 0 ? "Level par" : relative < 0 ? `${-relative} under par` : `${relative} over par`;
  const aces = played.filter((h) => h.guess.strokes === 0).length;

  return (
    <section className="space-y-5" data-testid="end-screen">
      <div className="paper relative animate-rise-in overflow-hidden rounded-md border border-[#d8cfb3] px-5 pb-5 pt-4 text-center shadow-[0_2px_0_#d8cfb3,0_18px_36px_-16px_rgb(0_0_0/0.4)]">
        <p className="font-card text-xs font-semibold uppercase tracking-[0.35em] text-fairway-800">
          Round complete{state.isArchive ? " · archive" : ""}
        </p>
        <p className="mt-1 font-hand text-7xl font-bold leading-none text-pencil" data-testid="final-total">
          {total}
        </p>
        <p className="font-card text-lg uppercase tracking-wider text-zinc-700">
          {verdict} <span className="text-zinc-400">· par {state.totalPar}</span>
        </p>
        {aces > 0 && (
          <p className="mt-1 inline-block animate-stamp rounded-md border-[3px] border-flag px-2 font-card text-sm font-bold uppercase tracking-wider text-flag">
            {aces === 1 ? "Hole in one!" : `${aces} holes in one!`}
          </p>
        )}
        <p className="mt-3 text-3xl tracking-[0.3em]" aria-label="Per-hole result">
          {played.map((h) => strokeEmoji(h.guess.strokes)).join("")}
        </p>
        <div className="mx-auto mt-4 flex max-w-xs items-end justify-between gap-4 border-t border-dashed border-paper-line pt-2 text-left">
          <span className="font-card text-[10px] uppercase tracking-[0.25em] text-zinc-400">Attested</span>
          <span className="font-hand text-2xl leading-none text-pencil/80">Guest</span>
        </div>
        <button
          type="button"
          onClick={share}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-fairway-800 px-7 py-2.5 font-card text-lg font-semibold uppercase tracking-wider text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)] hover:bg-fairway-700"
        >
          Share scorecard
        </button>
        <p className="mt-2 h-4 text-xs text-zinc-500" role="status">
          {copied === "copied" ? "Copied to clipboard" : copied === "failed" ? "Couldn't copy. Select the text below." : ""}
        </p>
        {copied === "failed" && (
          <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-left text-sm">{text}</pre>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-card text-sm font-semibold uppercase tracking-[0.25em] text-fairway-800">Hole by hole</h2>
        {played.map((h) => (
          <div key={h.holeNumber} className="overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-sm">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setOpen(open === h.holeNumber ? null : h.holeNumber)}
              aria-expanded={open === h.holeNumber}
            >
              <span className="text-lg">{strokeEmoji(h.guess.strokes)}</span>
              <span className="flex-1">
                <span className="block text-xs text-zinc-500">Hole {h.holeNumber} · target {ordinal(h.targetRank)}</span>
                <span className="block text-sm font-medium">{h.prompt}</span>
              </span>
              <span className="text-right">
                <span className="block font-hand text-2xl font-bold leading-none text-pencil">{h.guess.strokes}</span>
                <span className="block font-card text-[10px] uppercase tracking-wider text-zinc-500">
                  {scoreName(h.guess.strokes, h.par, h.guess.actualRank !== null).label}
                </span>
              </span>
            </button>
            {open === h.holeNumber && (
              <div className="border-t border-zinc-100 p-4">
                <HoleReveal hole={h} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
