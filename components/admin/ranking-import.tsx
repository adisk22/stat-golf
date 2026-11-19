"use client";
import { useMemo, useState } from "react";
import type { AdminQuestion, MatchResponse, MatchRow } from "@/lib/admin-types";
import { duplicateEntityIssues, type RankingCsvIssue } from "@/lib/csv/ranking";
import { EntityPicker } from "./entity-picker";
import { api } from "./use-api";
import { Badge, Button, Card, Input, IssueList, Notice, Select, Textarea } from "./ui";

type Choice =
  | { kind: "entity"; id: string; name: string }
  | { kind: "new"; name: string; country: string; disambiguation: string };

interface ReviewRow extends MatchRow {
  choice: Choice | null;
  confirmed: boolean;
  searching: boolean;
}

function initialChoice(r: MatchRow): Choice | null {
  if (!r.entityId) return null;
  const c = r.candidates.find((c) => c.id === r.entityId);
  return { kind: "entity", id: r.entityId, name: c?.name ?? r.name };
}

const METHOD_BADGE = {
  exact: { tone: "green", label: "exact" },
  alias: { tone: "green", label: "alias" },
  fuzzy: { tone: "amber", label: "fuzzy" },
  none: { tone: "red", label: "no match" },
} as const;

/**
 * CSV import in three steps: paste/upload → server parses, validates and matches →
 * review every row (confirm, pick another, or create a new entity) → save.
 */
export function RankingImport({ question, onSaved }: { question: AdminQuestion; onSaved: (q: AdminQuestion) => void }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<RankingCsvIssue[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setErrors([]);
    setFailure(null);
    setSaved(null);
    try {
      const res = await api<MatchResponse>(`/api/admin/questions/${question.id}/match`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      if (!res.ok) {
        setErrors(res.errors);
        setRows(null);
      } else {
        setRows(
          res.rows.map((r) => ({
            ...r,
            choice: initialChoice(r),
            confirmed: r.method === "exact" || r.method === "alias",
            searching: false,
          })),
        );
      }
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const update = (line: number, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs && rs.map((r) => (r.line === line ? { ...r, ...patch } : r)));

  const dupes = useMemo(
    () =>
      rows
        ? duplicateEntityIssues(rows.map((r) => ({ line: r.line, entityId: r.choice?.kind === "entity" ? r.choice.id : null })))
        : [],
    [rows],
  );
  const dupeLines = new Set(dupes.map((d) => d.line));
  const pending = rows?.filter((r) => !r.choice || !r.confirmed || (r.choice.kind === "new" && !r.choice.name.trim())) ?? [];
  const canSave = rows !== null && pending.length === 0 && dupes.length === 0;

  async function save() {
    if (!rows) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api<{ saved: number; created: number; question: AdminQuestion }>(
        `/api/admin/questions/${question.id}/ranking`,
        {
          method: "PUT",
          body: JSON.stringify({
            rows: rows.map((r) => ({
              line: r.line,
              rank: r.rank,
              value: r.value,
              ...(r.choice!.kind === "entity"
                ? { entityId: r.choice!.id }
                : {
                    newEntity: {
                      name: r.choice!.name.trim(),
                      country: r.choice!.country.trim() || null,
                      disambiguation: r.choice!.disambiguation.trim() || null,
                    },
                  }),
            })),
          }),
        },
      );
      setSaved(`Saved ${res.saved} rows${res.created ? `, created ${res.created} new ${question.answerType}s` : ""}.`);
      setRows(null);
      setCsv("");
      onSaved(res.question);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (question.locked) {
    return (
      <Card title="Import ranking">
        <Notice tone="info">This question is in a published puzzle, so its ranking is locked.</Notice>
      </Card>
    );
  }

  const visible = rows?.filter((r) => !onlyReview || !r.confirmed || !r.choice || dupeLines.has(r.line)) ?? [];

  return (
    <Card title="Import ranking (CSV)">
      <p className="text-sm text-zinc-600">
        Columns <code>rank,name,value</code> with a header row, sorted by rank (
        {question.valueOrder === "desc" ? "highest value first" : "lowest value first"}). Ties share a rank: 1, 2, 2, 4.
        Importing replaces the current ranking.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
        />
      </div>
      <Textarea
        rows={6}
        placeholder={"rank,name,value\n1,Example FC,123\n2,Sample United,120"}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        aria-label="CSV text"
      />
      <Button onClick={check} disabled={busy || !csv.trim()}>
        {busy && !rows ? "Checking…" : "Check & match names"}
      </Button>

      {saved && <Notice tone="success">{saved}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      <IssueList tone="error" items={errors.map((e) => (e.line ? `Line ${e.line}: ${e.message}` : e.message))} />

      {rows && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>{rows.length}</strong> rows · <strong>{pending.length}</strong> need review
            </span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} /> Only show rows
              needing review
            </label>
            <Button
              variant="secondary"
              onClick={() => setRows((rs) => rs && rs.map((r) => (r.choice ? { ...r, confirmed: true } : r)))}
            >
              Accept all suggestions
            </Button>
          </div>
          <IssueList tone="error" items={dupes.map((d) => `Line ${d.line}: ${d.message}`)} />

          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5">Line</th>
                  <th className="px-2 py-1.5 text-right">Rank</th>
                  <th className="px-2 py-1.5">CSV name</th>
                  <th className="px-2 py-1.5 text-right">Value</th>
                  <th className="px-2 py-1.5">Match</th>
                  <th className="px-2 py-1.5">OK</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <ReviewRowView
                    key={r.line}
                    row={r}
                    duplicate={dupeLines.has(r.line)}
                    answerType={question.answerType}
                    onChange={(p) => update(r.line, p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={!canSave || busy}>
              {busy ? "Saving…" : `Save ${rows.length} rows`}
            </Button>
            <Button variant="ghost" onClick={() => setRows(null)}>
              Cancel
            </Button>
            {!canSave && <span className="text-xs text-zinc-500">Resolve every row (and duplicates) to save.</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReviewRowView({
  row: r,
  duplicate,
  answerType,
  onChange,
}: {
  row: ReviewRow;
  duplicate: boolean;
  answerType: AdminQuestion["answerType"];
  onChange: (p: Partial<ReviewRow>) => void;
}) {
  const badge = METHOD_BADGE[r.method];
  const selectValue = r.searching ? "__search" : r.choice?.kind === "new" ? "__new" : (r.choice?.id ?? "");
  const ch = r.choice;
  const options = r.candidates.map((c) => ({
    id: c.id,
    name: c.name,
    label: `${c.name}${c.disambiguation ? ` (${c.disambiguation})` : ""} · ${Math.round(c.score * 100)}%`,
  }));
  if (ch?.kind === "entity" && !options.some((o) => o.id === ch.id)) {
    options.unshift({ id: ch.id, name: ch.name, label: ch.name });
  }

  return (
    <tr className={`border-t border-zinc-100 align-top ${duplicate ? "bg-red-50" : !r.confirmed || !r.choice ? "bg-amber-50/50" : ""}`}>
      <td className="px-2 py-1.5 text-zinc-500">{r.line}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.rank}</td>
      <td className="px-2 py-1.5">
        {r.name} <Badge tone={badge.tone}>{badge.label}</Badge>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.value}</td>
      <td className="min-w-64 space-y-1 px-2 py-1.5">
        <Select
          aria-label={`Match for line ${r.line}`}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new") {
              onChange({ choice: { kind: "new", name: r.name, country: "", disambiguation: "" }, searching: false, confirmed: true });
            } else if (v === "__search") {
              onChange({ searching: true });
            } else if (v === "") {
              onChange({ choice: null, searching: false, confirmed: false });
            } else {
              const c = options.find((o) => o.id === v)!;
              onChange({ choice: { kind: "entity", id: c.id, name: c.name }, searching: false, confirmed: true });
            }
          }}
        >
          <option value="">— choose —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
          <option value="__search">Search for another…</option>
          <option value="__new">Create new {answerType}…</option>
        </Select>
        {r.searching && (
          <EntityPicker
            type={answerType}
            initialQuery={r.name}
            onPick={(e) => onChange({ choice: { kind: "entity", id: e.id, name: e.name }, searching: false, confirmed: true })}
          />
        )}
        {r.choice?.kind === "new" && (
          <div className="grid grid-cols-3 gap-1">
            <Input
              aria-label="New name"
              value={r.choice.name}
              onChange={(e) => onChange({ choice: { ...(r.choice as Extract<Choice, { kind: "new" }>), name: e.target.value } })}
            />
            <Input
              aria-label="New country"
              placeholder="Country"
              value={r.choice.country}
              onChange={(e) => onChange({ choice: { ...(r.choice as Extract<Choice, { kind: "new" }>), country: e.target.value } })}
            />
            <Input
              aria-label="New disambiguation"
              placeholder="Disambiguation"
              value={r.choice.disambiguation}
              onChange={(e) =>
                onChange({ choice: { ...(r.choice as Extract<Choice, { kind: "new" }>), disambiguation: e.target.value } })
              }
            />
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        <input
          type="checkbox"
          aria-label={`Confirm line ${r.line}`}
          disabled={!r.choice}
          checked={r.confirmed && Boolean(r.choice)}
          onChange={(e) => onChange({ confirmed: e.target.checked })}
        />
      </td>
    </tr>
  );
}
