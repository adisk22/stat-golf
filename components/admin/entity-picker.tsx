"use client";
import { useEffect, useState } from "react";
import type { AdminEntity } from "@/lib/admin-types";
import type { AnswerType } from "@/lib/game-types";
import { EntityBadge } from "@/components/ui/entity-badge";
import { api } from "./use-api";
import { Input } from "./ui";

/** Search box over all entities of a type; calls onPick with the chosen one. */
export function EntityPicker({
  type,
  initialQuery = "",
  excludeId,
  onPick,
}: {
  type: AnswerType;
  initialQuery?: string;
  excludeId?: string;
  onPick: (e: AdminEntity) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<AdminEntity[]>([]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const t = setTimeout(() => {
      api<AdminEntity[]>(`/api/admin/entities?type=${type}&q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, type]);

  const shown = q.trim().length >= 2 ? results.filter((r) => r.id !== excludeId) : [];
  return (
    <div className="space-y-1">
      <Input autoFocus placeholder={`Search ${type}s…`} value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length > 0 && (
        <ul className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-white">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-fairway-50"
                onClick={() => onPick(e)}
              >
                <EntityBadge name={e.name} size={20} />
                <span className="flex-1">
                  {e.name}
                  {e.disambiguation && <span className="text-zinc-500"> ({e.disambiguation})</span>}
                </span>
                <span className="text-xs text-zinc-400">{e.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
