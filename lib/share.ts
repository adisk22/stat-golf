import { GAME_NAME } from "./config";
import { formatRelativeToPar } from "./scoring";

/** 🟢 0, 🟡 1–3, 🟠 4–8, 🔴 9+ */
export function strokeEmoji(strokes: number): string {
  if (strokes <= 0) return "🟢";
  if (strokes <= 3) return "🟡";
  if (strokes <= 8) return "🟠";
  return "🔴";
}

export interface ShareInput {
  puzzleNumber: number;
  totalStrokes: number;
  relativeToPar: number;
  holeStrokes: readonly number[];
  url?: string;
}

/** Spoiler-free share text: no prompts, targets or entity names. */
export function shareText({ puzzleNumber, totalStrokes, relativeToPar, holeStrokes, url }: ShareInput): string {
  const lines = [
    `${GAME_NAME} #${puzzleNumber}  ⛳ ${totalStrokes} (${formatRelativeToPar(relativeToPar)})`,
    holeStrokes.map(strokeEmoji).join(""),
  ];
  if (url) lines.push(url);
  return lines.join("\n");
}
