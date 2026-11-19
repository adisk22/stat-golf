/**
 * Validates an uploaded ranking CSV with columns `rank,name,value` (header required).
 *
 * Rules:
 *  - rank is a positive integer; value is a finite number.
 *  - Rows are sorted by rank; values run in the declared order (desc: biggest first).
 *  - Ranks follow standard competition ranking of the values: equal values share a
 *    rank and the next rank skips ahead (1, 2, 2, 4). So no gaps except ties.
 *  - No duplicate names (after normalisation). Duplicate *entities* are checked again
 *    after matching, since two spellings can map to one entity.
 */
import { competitionRanks, type ValueOrder } from "@/lib/ranking";
import { CsvSyntaxError, parseCsv } from "./parse";

export interface RankingCsvRow {
  /** 1-based line number in the file (header is line 1). */
  line: number;
  rank: number;
  name: string;
  value: number;
}

export interface RankingCsvIssue {
  line: number | null;
  message: string;
}

export interface RankingCsvResult {
  rows: RankingCsvRow[];
  errors: RankingCsvIssue[];
}

export const MAX_RANKING_ROWS = 2000;

/** Same idea as app.normalize_name in SQL: lowercase, strip accents, collapse punctuation. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/[\s_]/g, "");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseRankingCsv(text: string, order: ValueOrder): RankingCsvResult {
  const errors: RankingCsvIssue[] = [];
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvSyntaxError) return { rows: [], errors: [{ line: null, message: e.message }] };
    throw e;
  }
  if (table.length === 0) return { rows: [], errors: [{ line: null, message: "The file is empty." }] };

  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const idx = { rank: header.indexOf("rank"), name: header.indexOf("name"), value: header.indexOf("value") };
  if (idx.rank < 0 || idx.name < 0 || idx.value < 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Header must contain rank,name,value (got "${table[0]!.join(",")}").` }],
    };
  }
  if (table.length - 1 > MAX_RANKING_ROWS) {
    return { rows: [], errors: [{ line: null, message: `Too many rows (max ${MAX_RANKING_ROWS}).` }] };
  }

  const rows: RankingCsvRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const rawRank = (cells[idx.rank] ?? "").trim();
    const name = (cells[idx.name] ?? "").trim().replace(/\s+/g, " ");
    const value = parseNumber(cells[idx.value] ?? "");
    const rank = /^\d+$/.test(rawRank) ? Number(rawRank) : NaN;
    if (!Number.isInteger(rank) || rank < 1) errors.push({ line, message: `Rank "${rawRank}" is not a positive whole number.` });
    if (!name) errors.push({ line, message: "Name is empty." });
    if (value === null) errors.push({ line, message: `Value "${cells[idx.value] ?? ""}" is not a number.` });
    if (Number.isInteger(rank) && rank >= 1 && name && value !== null) rows.push({ line, rank, name, value });
  });
  if (errors.length > 0) return { rows, errors };
  if (rows.length === 0) return { rows, errors: [{ line: null, message: "No data rows." }] };

  // Sorted by rank, values in the declared direction.
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    if (cur.rank < prev.rank) {
      errors.push({ line: cur.line, message: `Rows must be sorted by rank (${cur.rank} comes after ${prev.rank}).` });
    } else if (order === "desc" ? cur.value > prev.value : cur.value < prev.value) {
      errors.push({
        line: cur.line,
        message: `Value ${cur.value} is ${order === "desc" ? "higher" : "lower"} than the row above (${prev.value}), but the ranking is ${order === "desc" ? "highest first" : "lowest first"}.`,
      });
    }
  }
  if (errors.length > 0) return { rows, errors };

  // Ranks must equal the competition ranking of the values (ties share; no other gaps).
  const expected = competitionRanks(rows.map((r) => r.value));
  rows.forEach((r, i) => {
    if (r.rank !== expected[i]) {
      errors.push({
        line: r.line,
        message: `Expected rank ${expected[i]} for value ${r.value} (equal values share a rank, then ranks skip: 1, 2, 2, 4).`,
      });
    }
  });

  // Duplicate names.
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = normalizeName(r.name);
    const first = seen.get(key);
    if (first !== undefined) errors.push({ line: r.line, message: `"${r.name}" duplicates line ${first}.` });
    else seen.set(key, r.line);
  }

  return { rows, errors };
}

/** Rows mapped to entity ids must not contain the same entity twice. */
export function duplicateEntityIssues(rows: readonly { line: number; entityId: string | null }[]): RankingCsvIssue[] {
  const seen = new Map<string, number>();
  const issues: RankingCsvIssue[] = [];
  for (const r of rows) {
    if (!r.entityId) continue;
    const first = seen.get(r.entityId);
    if (first !== undefined) issues.push({ line: r.line, message: `Matches the same entity as line ${first}.` });
    else seen.set(r.entityId, r.line);
  }
  return issues;
}
