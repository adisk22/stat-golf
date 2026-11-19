"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { EditorHole, PuzzleEditorData } from "@/lib/admin-types";
import { publishErrors, puzzleWarnings } from "@/lib/admin-checks";
import { DEFAULT_PAR, MAX_HOLES_PER_DAY } from "@/lib/config";
import { formatPuzzleDate, puzzleNumber } from "@/lib/dates";
import { HoleHeading } from "@/components/game/hole-heading";
import { ordinal } from "@/components/game/format";
import { api, useApi } from "@/components/admin/use-api";
import { BackLink, Badge, Button, Card, Input, IssueList, Notice, Select } from "@/components/admin/ui";

export default function PuzzleEditorPage() {
  const { date } = useParams<{ date: string }>();
  const { data, error, setData } = useApi<PuzzleEditorData>(`/api/admin/schedule/${date}`);
  const [holes, setHoles] = useState<EditorHole[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // Reset the working copy whenever the server state changes (load, save, publish).
  const [loadedFrom, setLoadedFrom] = useState<PuzzleEditorData | null>(null);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setHoles(data.holes);
  }

  const questions = useMemo(() => data?.questions ?? [], [data]);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const errors = useMemo(() => publishErrors(holes, questions), [holes, questions]);
  const warnings = useMemo(() => puzzleWarnings(date, holes, questions), [date, holes, questions]);
  const dirty = data !== null && JSON.stringify(holes) !== JSON.stringify(data.holes);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;

  const locked = data.published;
  const setHole = (i: number, patch: Partial<EditorHole>) =>
    setHoles((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const move = (i: number, d: -1 | 1) =>
    setHoles((hs) => {
      const next = [...hs];
      [next[i], next[i + d]] = [next[i + d]!, next[i]!];
      return next;
    });

  async function run(fn: () => Promise<PuzzleEditorData>) {
    setBusy(true);
    setActionError(null);
    try {
      setData(await fn());
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const save = () =>
    run(() => api<PuzzleEditorData>(`/api/admin/schedule/${date}`, { method: "PUT", body: JSON.stringify({ holes }) }));
  const publish = (published: boolean) =>
    run(() =>
      api<PuzzleEditorData>(`/api/admin/schedule/${date}/publish`, { method: "POST", body: JSON.stringify({ published }) }),
    );

  const usedIds = new Set(holes.map((h) => h.questionId));
  return (
    <div className="space-y-4">
      <BackLink href="/admin/schedule">Schedule</BackLink>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            #{puzzleNumber(date)} · {formatPuzzleDate(date)}
            {data.published ? (
              <Badge tone="green" testId="puzzle-status">published</Badge>
            ) : data.exists ? (
              <Badge tone="amber" testId="puzzle-status">draft</Badge>
            ) : (
              <Badge tone="zinc" testId="puzzle-status">empty</Badge>
            )}
            {date < data.today && <Badge tone="zinc">past</Badge>}
            {date === data.today && <Badge tone="blue">today</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview((p) => !p)} disabled={holes.length === 0}>
              {preview ? "Edit" : "Preview"}
            </Button>
            {!locked && (
              <Button variant="secondary" onClick={save} disabled={busy || !dirty}>
                Save draft
              </Button>
            )}
            {locked ? (
              <Button
                variant="danger"
                onClick={() => publish(false)}
                disabled={busy || data.hasPlays}
                title={data.hasPlays ? "People have already played this day" : undefined}
              >
                Unpublish
              </Button>
            ) : (
              <Button onClick={() => publish(true)} disabled={busy || dirty || !data.exists || errors.length > 0}>
                Publish
              </Button>
            )}
          </>
        }
      >
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {locked && (
          <Notice tone="info">
            Published{data.hasPlays ? " and already played, so it can't be changed" : ". Unpublish to edit"}.
          </Notice>
        )}
        {!locked && dirty && <Notice tone="info">Unsaved changes: save the draft before publishing.</Notice>}
        <IssueList tone="error" items={errors} />
        <IssueList tone="warning" items={warnings} />

        {preview ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">What players see, one hole at a time</p>
            {holes.map((h, i) => {
              const q = byId.get(h.questionId);
              if (!q) return null;
              return (
                <div key={i} className="max-w-xl space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <HoleHeading
                    hole={{
                      holeNumber: i + 1,
                      par: h.par,
                      targetRank: h.targetRank,
                      prompt: q.prompt,
                      scopeNote: q.scopeNote,
                      statLabel: q.statLabel,
                      answerType: q.answerType,
                    }}
                  />
                  <div className="rounded-lg border border-zinc-300 px-3 py-3 text-zinc-400">Search {q.answerType}s…</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {holes.map((h, i) => {
              const q = byId.get(h.questionId);
              return (
                <div key={i} className="grid gap-2 rounded-md border border-zinc-200 p-2 sm:grid-cols-[auto_1fr_8rem_5rem_auto] sm:items-end">
                  <span className="text-sm font-semibold text-zinc-600">Hole {i + 1}</span>
                  <label className="space-y-0.5 text-xs text-zinc-500">
                    Question
                    <Select
                      aria-label={`Hole ${i + 1} question`}
                      value={h.questionId}
                      disabled={locked}
                      onChange={(e) => {
                        const nq = byId.get(e.target.value);
                        setHole(i, { questionId: e.target.value, targetRank: nq?.heldRanks[0] ?? 1 });
                      }}
                    >
                      {questions
                        .filter((o) => o.id === h.questionId || !usedIds.has(o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.prompt} ({o.rowCount} rows{o.usedDates.length ? `, last used ${o.usedDates.at(-1)}` : ""})
                          </option>
                        ))}
                    </Select>
                  </label>
                  <label className="space-y-0.5 text-xs text-zinc-500">
                    Target rank
                    <Select
                      aria-label={`Hole ${i + 1} target`}
                      value={h.targetRank}
                      disabled={locked}
                      onChange={(e) => setHole(i, { targetRank: Number(e.target.value) })}
                    >
                      {!q?.heldRanks.includes(h.targetRank) && <option value={h.targetRank}>{ordinal(h.targetRank)} (invalid)</option>}
                      {(q?.heldRanks ?? []).map((r) => (
                        <option key={r} value={r}>
                          {ordinal(r)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-0.5 text-xs text-zinc-500">
                    Par
                    <Input
                      aria-label={`Hole ${i + 1} par`}
                      type="number"
                      min={1}
                      max={15}
                      value={h.par}
                      disabled={locked}
                      onChange={(e) => setHole(i, { par: Math.max(1, Math.min(15, Number(e.target.value) || DEFAULT_PAR)) })}
                    />
                  </label>
                  {!locked && (
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move hole ${i + 1} up`}>
                        ↑
                      </Button>
                      <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === holes.length - 1} aria-label={`Move hole ${i + 1} down`}>
                        ↓
                      </Button>
                      <Button variant="ghost" onClick={() => setHoles((hs) => hs.filter((_, j) => j !== i))} aria-label={`Remove hole ${i + 1}`}>
                        ✕
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {!locked && holes.length < MAX_HOLES_PER_DAY && (
              <Button
                variant="secondary"
                disabled={questions.every((q) => usedIds.has(q.id))}
                onClick={() => {
                  const next = questions.find((q) => !usedIds.has(q.id) && q.ready);
                  if (next) setHoles((hs) => [...hs, { questionId: next.id, targetRank: next.heldRanks[0] ?? 1, par: DEFAULT_PAR }]);
                }}
              >
                + Add hole
              </Button>
            )}
            {questions.length === 0 && <Notice tone="info">No questions are marked ready yet.</Notice>}
          </div>
        )}
      </Card>
    </div>
  );
}
