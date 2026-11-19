"use client";
import { useParams, useRouter } from "next/navigation";
import type { AdminQuestion } from "@/lib/admin-types";
import { formatPuzzleDate } from "@/lib/dates";
import { QuestionForm } from "@/components/admin/question-form";
import { RankingImport } from "@/components/admin/ranking-import";
import { api, useApi } from "@/components/admin/use-api";
import { BackLink, Badge, Button, Card, Notice } from "@/components/admin/ui";
import { useState } from "react";

export default function QuestionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: q, error, setData } = useApi<AdminQuestion>(`/api/admin/questions/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!q) return <p className="text-sm text-zinc-500">Loading…</p>;

  async function patch(body: object) {
    setActionError(null);
    try {
      setData(await api<AdminQuestion>(`/api/admin/questions/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <BackLink href="/admin">Questions</BackLink>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {q.prompt}
            <Badge tone={q.status === "ready" ? "green" : "amber"} testId="question-status">
              {q.status}
            </Badge>
            {q.locked && <Badge tone="zinc">locked</Badge>}
          </span>
        }
        actions={
          <>
            {q.status === "draft" ? (
              <Button onClick={() => patch({ status: "ready" })} disabled={q.ranking.length === 0}>
                Mark ready
              </Button>
            ) : (
              !q.locked && (
                <Button variant="secondary" onClick={() => patch({ status: "draft" })}>
                  Back to draft
                </Button>
              )
            )}
            {q.usedDates.length === 0 && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Delete this question and its ranking?")) return;
                  try {
                    await api(`/api/admin/questions/${id}`, { method: "DELETE" });
                    router.push("/admin");
                  } catch (e) {
                    setActionError((e as Error).message);
                  }
                }}
              >
                Delete
              </Button>
            )}
          </>
        }
      >
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {q.usedDates.length > 0 && (
          <p className="text-sm text-zinc-600">Scheduled on {q.usedDates.map(formatPuzzleDate).join(", ")}.</p>
        )}
        <QuestionForm
          key={q.id}
          initial={q}
          submitLabel="Save details"
          lockSemantics={q.locked}
          onSubmit={async (meta) => {
            setData(await api<AdminQuestion>(`/api/admin/questions/${id}`, { method: "PATCH", body: JSON.stringify(meta) }));
          }}
        />
      </Card>

      <RankingImport question={q} onSaved={setData} />

      <Card title={`Current ranking (${q.ranking.length} rows)`}>
        {q.ranking.length === 0 ? (
          <p className="text-sm text-zinc-500">No ranking yet. Import a CSV above.</p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 text-right">#</th>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5 text-right">{q.statLabel}</th>
                </tr>
              </thead>
              <tbody>
                {q.ranking.map((r) => (
                  <tr key={r.entityId} className="border-t border-zinc-100">
                    <td className="px-2 py-1 text-right tabular-nums text-zinc-500">{r.rank}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
