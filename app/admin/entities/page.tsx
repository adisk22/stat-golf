"use client";
import { useEffect, useState } from "react";
import type { AdminEntity } from "@/lib/admin-types";
import type { AnswerType } from "@/lib/game-types";
import { EntityBadge } from "@/components/ui/entity-badge";
import { EntityPicker } from "@/components/admin/entity-picker";
import { api, useApi } from "@/components/admin/use-api";
import { Badge, Button, Card, Field, Input, Notice, Select } from "@/components/admin/ui";

export default function EntitiesPage() {
  const [type, setType] = useState<AnswerType>("club");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useApi<AdminEntity[]>(`/api/admin/entities?type=${type}&q=${encodeURIComponent(debounced)}`);

  return (
    <Card
      title="Entities"
      actions={
        <Button variant="secondary" onClick={() => setCreating((c) => !c)}>
          {creating ? "Close" : `New ${type}`}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as AnswerType)} className="w-32" aria-label="Type">
          <option value="club">Clubs</option>
          <option value="player">Players</option>
          <option value="nation">Nations</option>
        </Select>
        <Input placeholder="Search names and aliases…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {creating && (
        <EntityEditor
          entity={{ id: "", type, name: "", aliases: [], country: null, disambiguation: null, rankingCount: 0 }}
          onDone={(msg) => {
            setCreating(false);
            setNotice({ tone: "success", text: msg });
            reload();
          }}
        />
      )}
      <p className="text-xs text-zinc-500">{debounced ? "Best matches" : "Recently updated"}</p>
      <ul className="divide-y divide-zinc-100">
        {(data ?? []).map((e) => (
          <EntityRow key={e.id} entity={e} onChanged={(text, tone = "success") => (setNotice({ tone, text }), reload())} />
        ))}
      </ul>
    </Card>
  );
}

function EntityRow({ entity: e, onChanged }: { entity: AdminEntity; onChanged: (msg: string, tone?: "success" | "error") => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "merge">("view");
  const [target, setTarget] = useState<AdminEntity | null>(null);
  const [busy, setBusy] = useState(false);

  async function merge() {
    if (!target) return;
    setBusy(true);
    try {
      await api("/api/admin/entities/merge", { method: "POST", body: JSON.stringify({ keepId: target.id, removeId: e.id }) });
      onChanged(`Merged "${e.name}" into "${target.name}".`);
    } catch (err) {
      onChanged((err as Error).message, "error");
    } finally {
      setBusy(false);
      setMode("view");
    }
  }

  return (
    <li className="space-y-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <EntityBadge name={e.name} size={24} />
        <span className="font-medium">{e.name}</span>
        {e.disambiguation && <span className="text-sm text-zinc-500">({e.disambiguation})</span>}
        {e.country && <Badge tone="zinc">{e.country}</Badge>}
        <Badge tone="blue">in {e.rankingCount} rankings</Badge>
        {e.aliases.length > 0 && <span className="text-xs text-zinc-500">aka {e.aliases.join(", ")}</span>}
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setMode(mode === "merge" ? "view" : "merge")}>
            Merge…
          </Button>
        </span>
      </div>
      {mode === "edit" && <EntityEditor entity={e} onDone={(msg) => (setMode("view"), onChanged(msg))} />}
      {mode === "merge" && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm">
          <p>
            Merge <strong>{e.name}</strong> into another {e.type}. Its rankings and players&apos; guesses move to the
            kept entity, its name becomes an alias, and it is deleted.
          </p>
          {target ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Keep <strong>{target.name}</strong>, remove <strong>{e.name}</strong>?
              </span>
              <Button variant="danger" onClick={merge} disabled={busy}>
                {busy ? "Merging…" : "Merge"}
              </Button>
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Change
              </Button>
            </div>
          ) : (
            <EntityPicker type={e.type} initialQuery={e.name} excludeId={e.id} onPick={setTarget} />
          )}
        </div>
      )}
    </li>
  );
}

function EntityEditor({ entity, onDone }: { entity: AdminEntity; onDone: (msg: string) => void }) {
  const [name, setName] = useState(entity.name);
  const [aliases, setAliases] = useState(entity.aliases.join(", "));
  const [country, setCountry] = useState(entity.country ?? "");
  const [disambiguation, setDisambiguation] = useState(entity.disambiguation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name,
      aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
      country,
      disambiguation,
    };
    try {
      if (entity.id) {
        await api(`/api/admin/entities/${entity.id}`, { method: "PATCH", body: JSON.stringify(body) });
        onDone(`Saved "${name}".`);
      } else {
        await api("/api/admin/entities", { method: "POST", body: JSON.stringify({ ...body, type: entity.type }) });
        onDone(`Created "${name}".`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
      <Field label="Name">
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Aliases" hint="Comma-separated alternative spellings.">
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </Field>
      <Field label="Country">
        <Input value={country} onChange={(e) => setCountry(e.target.value)} />
      </Field>
      <Field label="Disambiguation" hint="Only if two entities share a name.">
        <Input value={disambiguation} onChange={(e) => setDisambiguation(e.target.value)} />
      </Field>
      {error && (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : entity.id ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
