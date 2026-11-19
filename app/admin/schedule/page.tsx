"use client";
import Link from "next/link";
import { useState } from "react";
import type { ScheduleOverview } from "@/lib/admin-types";
import { addDays, formatPuzzleDate, puzzleToday } from "@/lib/dates";
import { useApi } from "@/components/admin/use-api";
import { Button, Card, Notice } from "@/components/admin/ui";

function monthGrid(month: string) {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(month: string, delta: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export default function SchedulePage() {
  const [month, setMonth] = useState(() => puzzleToday().slice(0, 7));
  const cells = monthGrid(month);
  const { data, error } = useApi<ScheduleOverview>(`/api/admin/schedule?from=${cells[0]}&to=${cells.at(-1)}`);
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));
  const emptySoon = new Set(data?.emptySoon ?? []);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <Card
      title={`Schedule · ${label}`}
      actions={
        <>
          <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            ←
          </Button>
          <Button variant="secondary" onClick={() => setMonth(puzzleToday().slice(0, 7))}>
            Today
          </Button>
          <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            →
          </Button>
        </>
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {data && data.emptySoon.length > 0 && (
        <Notice tone="warning">
          No published puzzle for {data.emptySoon.length === 7 ? "any of the next 7 days" : data.emptySoon.map(formatPuzzleDate).join(", ")}.
        </Notice>
      )}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const day = byDate.get(date);
          const inMonth = date.startsWith(month);
          const isToday = date === data?.today;
          const tone = day?.published
            ? "border-fairway-300 bg-fairway-50"
            : day
              ? "border-amber-300 bg-amber-50"
              : emptySoon.has(date)
                ? "border-red-300 bg-white"
                : "border-zinc-200 bg-white";
          return (
            <Link
              key={date}
              href={`/admin/schedule/${date}`}
              data-testid={`day-${date}`}
              className={`flex min-h-16 flex-col rounded-md border p-1.5 text-left text-xs hover:ring-2 hover:ring-fairway-200 ${tone} ${inMonth ? "" : "opacity-40"} ${isToday ? "ring-2 ring-fairway-600" : ""}`}
            >
              <span className="font-semibold text-zinc-800">{Number(date.slice(8))}</span>
              {day ? (
                <span className={day.published ? "text-fairway-800" : "text-amber-800"}>
                  {day.holeCount} holes · {day.published ? "live" : "draft"}
                </span>
              ) : (
                emptySoon.has(date) && <span className="text-red-700">empty</span>
              )}
            </Link>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        Green = published · amber = draft · red outline = no puzzle in the next 7 days. Dates use {""}
        the rollover timezone; click a day to edit it.
      </p>
    </Card>
  );
}
