"use client";
import { useState } from "react";
import type { PlayState, PlayedHole } from "@/lib/game-types";
import { formatRelativeToPar } from "@/lib/scoring";
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

  return (
    <section className="space-y-5" data-testid="end-screen">
      <div className="rounded-xl bg-fairway-700 p-6 text-center text-white shadow">
        <p className="text-sm uppercase tracking-widest text-fairway-200">Round complete{state.isArchive ? " · archive" : ""}</p>
        <p className="mt-1 text-5xl font-bold tabular-nums" data-testid="final-total">{total}</p>
        <p className="text-lg text-fairway-100">
          {formatRelativeToPar(relative)} · par {state.totalPar}
        </p>
        <p className="mt-3 text-2xl tracking-widest" aria-label="Per-hole result">
          {played.map((h) => strokeEmoji(h.guess.strokes)).join("")}
        </p>
        <button
          type="button"
          onClick={share}
          className="mt-4 rounded-full bg-white px-6 py-2 font-semibold text-fairway-800 shadow hover:bg-fairway-50"
        >
          Share result
        </button>
        <p className="mt-2 h-4 text-xs text-fairway-100" role="status">
          {copied === "copied" ? "Copied to clipboard" : copied === "failed" ? "Couldn't copy. Select the text below." : ""}
        </p>
        {copied === "failed" && (
          <pre className="mt-2 whitespace-pre-wrap rounded bg-fairway-800 p-2 text-left text-sm">{text}</pre>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Your round</h2>
        {played.map((h) => (
          <div key={h.holeNumber} className="rounded-lg border border-zinc-200 bg-white">
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
              <span className="font-semibold tabular-nums">{h.guess.strokes}</span>
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
