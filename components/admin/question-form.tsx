"use client";
import { useState } from "react";
import type { QuestionMeta } from "@/lib/admin-types";
import { Button, Field, Input, Notice, Select } from "./ui";

export const EMPTY_QUESTION: QuestionMeta = {
  prompt: "",
  answerType: "club",
  statLabel: "",
  valueOrder: "desc",
  scopeNote: null,
  sourceName: null,
  sourceUrl: null,
  dataAsOf: null,
};

interface Props {
  initial: QuestionMeta;
  submitLabel: string;
  /** Answer type and order can't change once the question is in a published puzzle. */
  lockSemantics?: boolean;
  onSubmit: (meta: QuestionMeta) => Promise<void>;
}

export function QuestionForm({ initial, submitLabel, lockSemantics, onSubmit }: Props) {
  const [m, setM] = useState<QuestionMeta>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof QuestionMeta>(k: K, v: QuestionMeta[K]) => setM((p) => ({ ...p, [k]: v }));
  const text = (k: "scopeNote" | "sourceName" | "sourceUrl" | "dataAsOf") => ({
    value: m[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value || null),
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit(m);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Prompt" hint='Shown to players, e.g. "Most all-time UCL goals conceded".'>
          <Input required minLength={3} maxLength={200} value={m.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </Field>
      </div>
      <Field label="Answer type">
        <Select
          value={m.answerType}
          disabled={lockSemantics}
          onChange={(e) => set("answerType", e.target.value as QuestionMeta["answerType"])}
        >
          <option value="club">Club</option>
          <option value="player">Player</option>
          <option value="nation">Nation</option>
        </Select>
      </Field>
      <Field label="Ranking order" hint="Which way the values run from rank 1.">
        <Select
          value={m.valueOrder}
          disabled={lockSemantics}
          onChange={(e) => set("valueOrder", e.target.value as QuestionMeta["valueOrder"])}
        >
          <option value="desc">Highest value is rank 1</option>
          <option value="asc">Lowest value is rank 1</option>
        </Select>
      </Field>
      <Field label="Stat label" hint='Column heading, e.g. "Goals conceded".'>
        <Input required maxLength={60} value={m.statLabel} onChange={(e) => set("statLabel", e.target.value)} />
      </Field>
      <Field label="Data as of">
        <Input type="date" {...text("dataAsOf")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Scope note" hint='Competition, seasons, cut-off, e.g. "Group stage onwards, 1992/93 – 2025/26".'>
          <Input maxLength={300} {...text("scopeNote")} />
        </Field>
      </div>
      <Field label="Source name">
        <Input maxLength={120} {...text("sourceName")} />
      </Field>
      <Field label="Source URL">
        <Input type="url" placeholder="https://" {...text("sourceUrl")} />
      </Field>
      {error && (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
