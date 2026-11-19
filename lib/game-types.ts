/**
 * Shapes returned by the game API. Shared by route handlers and client
 * components; contains nothing secret by construction: a hole's prompt is only
 * present once it is the current hole, and its ranking only once guessed.
 */
import type { RevealSlice } from "./reveal";

export type AnswerType = "club" | "player" | "nation";

export interface LockedHole {
  status: "locked";
  holeNumber: number;
  par: number;
}

export interface HoleQuestion {
  holeNumber: number;
  par: number;
  targetRank: number;
  prompt: string;
  scopeNote: string | null;
  statLabel: string;
  answerType: AnswerType;
}

export interface CurrentHole extends HoleQuestion {
  status: "current";
}

export interface PlayedHole extends HoleQuestion {
  status: "played";
  valueOrder: "desc" | "asc";
  sourceName: string | null;
  sourceUrl: string | null;
  dataAsOf: string | null;
  guess: {
    entityId: string;
    name: string;
    actualRank: number | null;
    actualValue: number | null;
    strokes: number;
  };
  reveal: RevealSlice;
}

export type HoleView = LockedHole | CurrentHole | PlayedHole;

export interface PlayState {
  date: string;
  puzzleNumber: number;
  isArchive: boolean;
  holes: HoleView[];
  totalPar: number;
  completed: boolean;
  /** Sum of strokes on played holes so far. */
  strokesSoFar: number;
  /** Par of played holes so far, for a running "relative to par". */
  parSoFar: number;
}

export interface EntityOption {
  id: string;
  name: string;
  disambiguation: string | null;
  country: string | null;
}

export interface ApiError {
  error: string;
}
