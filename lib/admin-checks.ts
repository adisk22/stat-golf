/** Scheduler checks shared by the admin editor (live feedback) and the server (enforcement). */
import type { EditorHole, EditorQuestion } from "./admin-types";
import { MAX_HOLES_PER_DAY, MAX_STROKES_PER_HOLE, MIN_HOLES_PER_DAY, QUESTION_REUSE_WARNING_DAYS } from "./config";
import { daysBetween } from "./dates";
import { checkTargetRank } from "./ranking";

/** Mirrors app.puzzle_publish_errors: reasons a day can't be published. */
export function publishErrors(holes: readonly EditorHole[], questions: readonly EditorQuestion[]): string[] {
  const errors: string[] = [];
  if (holes.length < MIN_HOLES_PER_DAY || holes.length > MAX_HOLES_PER_DAY) {
    errors.push(`A puzzle needs ${MIN_HOLES_PER_DAY}-${MAX_HOLES_PER_DAY} holes (has ${holes.length}).`);
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  holes.forEach((h, i) => {
    const q = byId.get(h.questionId);
    if (!q || !q.ready) {
      errors.push(`Hole ${i + 1}: question is not marked ready.`);
      return;
    }
    const check = checkTargetRank(h.targetRank, q.heldRanks);
    if (!check.ok) errors.push(`Hole ${i + 1}: ${check.error}`);
  });
  if (new Set(holes.map((h) => h.questionId)).size !== holes.length) {
    errors.push("Each question can only be used once per day.");
  }
  return errors;
}

/** Non-blocking warnings: recent reuse and short lists. */
export function puzzleWarnings(date: string, holes: readonly EditorHole[], questions: readonly EditorQuestion[]): string[] {
  const warnings: string[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  holes.forEach((h, i) => {
    const q = byId.get(h.questionId);
    if (!q) return;
    const near = q.usedDates.filter((d) => d !== date && Math.abs(daysBetween(d, date)) <= QUESTION_REUSE_WARNING_DAYS);
    if (near.length > 0) {
      warnings.push(`Hole ${i + 1}: question also used on ${near.join(", ")} (within ${QUESTION_REUSE_WARNING_DAYS} days).`);
    }
    const needed = h.targetRank + MAX_STROKES_PER_HOLE;
    if (q.rowCount < needed) {
      warnings.push(`Hole ${i + 1}: ${q.rowCount} rows stored; ${needed} recommended for target ${h.targetRank} unless the list is complete.`);
    }
  });
  return warnings;
}
