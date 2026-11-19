/** Shapes returned by /api/admin/*. */
import type { RankingCsvIssue } from "@/lib/csv/ranking";
import type { AnswerType, EntityOption } from "@/lib/game-types";

export type ValueOrder = "desc" | "asc";
export type QuestionStatus = "draft" | "ready";

export interface AdminMe {
  email: string | null;
}

export interface QuestionMeta {
  prompt: string;
  answerType: AnswerType;
  statLabel: string;
  valueOrder: ValueOrder;
  scopeNote: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  dataAsOf: string | null;
}

export interface QuestionSummary {
  id: string;
  prompt: string;
  answerType: AnswerType;
  statLabel: string;
  status: QuestionStatus;
  dataAsOf: string | null;
  updatedAt: string;
  rowCount: number;
  usedDates: string[];
  locked: boolean;
}

export interface RankingRowView {
  entityId: string;
  name: string;
  rank: number;
  value: number;
}

export interface AdminQuestion extends QuestionMeta {
  id: string;
  status: QuestionStatus;
  locked: boolean;
  usedDates: string[];
  ranking: RankingRowView[];
}

export type MatchMethod = "exact" | "alias" | "fuzzy" | "none";

export interface MatchCandidate extends EntityOption {
  score: number;
}

export interface MatchRow {
  line: number;
  rank: number;
  name: string;
  value: number;
  method: MatchMethod;
  entityId: string | null;
  candidates: MatchCandidate[];
}

export type MatchResponse =
  | { ok: true; rows: MatchRow[] }
  | { ok: false; errors: RankingCsvIssue[] };

export interface CalendarDay {
  date: string;
  published: boolean;
  holeCount: number;
}

export interface ScheduleOverview {
  today: string;
  days: CalendarDay[];
  /** Dates in the next week with no published puzzle. */
  emptySoon: string[];
}

export interface EditorQuestion {
  id: string;
  prompt: string;
  answerType: AnswerType;
  statLabel: string;
  scopeNote: string | null;
  ready: boolean;
  rowCount: number;
  heldRanks: number[];
  usedDates: string[];
}

export interface EditorHole {
  questionId: string;
  targetRank: number;
  par: number;
}

export interface PuzzleEditorData {
  date: string;
  today: string;
  exists: boolean;
  published: boolean;
  hasPlays: boolean;
  holes: EditorHole[];
  /** Ready questions to choose from (plus any already on this date). */
  questions: EditorQuestion[];
  publishErrors: string[];
  warnings: string[];
}

export interface AdminEntity {
  id: string;
  type: AnswerType;
  name: string;
  aliases: string[];
  country: string | null;
  disambiguation: string | null;
  rankingCount: number;
}
