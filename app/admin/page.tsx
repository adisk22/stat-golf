"use client";
import Link from "next/link";
import { useState } from "react";
import type { QuestionSummary } from "@/lib/admin-types";
import { formatPuzzleDate } from "@/lib/dates";
import { Badge, Card, Input, Notice } from "@/components/admin/ui";
import { useApi } from "@/components/admin/use-api";

export default function QuestionsPage() {
  const { data, error } = useApi<QuestionSummary[]>("/api/admin/questions");
  const [filter, setFilter] = useState("");
  const rows = (data ?? []).filter((q) => q.prompt.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card
      title="Questions"
      actions={
        <Link href="/admin/questions/new" className="rounded-md bg-fairway-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-fairway-800">
          New question
        </Link>
      }
    >
      <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}
      {data && rows.length === 0 && <p className="text-sm text-zinc-500">No questions yet.</p>}
      <ul className="divide-y divide-zinc-100">
        {rows.map((q) => {
          const lastUsed = q.usedDates.at(-1);
          return (
            <li key={q.id}>
              <Link href={`/admin/questions/${q.id}`} className="flex flex-wrap items-center gap-2 px-1 py-2.5 hover:bg-zinc-50">
                <span className="min-w-0 flex-1 truncate font-medium">{q.prompt}</span>
                <Badge tone="zinc">{q.answerType}</Badge>
                <Badge tone={q.rowCount ? "blue" : "red"}>{q.rowCount} rows</Badge>
                <Badge tone={q.status === "ready" ? "green" : "amber"}>{q.status}</Badge>
                {q.locked && <Badge tone="zinc">locked</Badge>}
                <span className="w-32 text-right text-xs text-zinc-500">
                  {lastUsed ? `used ${formatPuzzleDate(lastUsed)}` : "never used"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
