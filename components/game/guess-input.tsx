"use client";
import { useEffect, useId, useRef, useState } from "react";
import { EntityBadge } from "@/components/ui/entity-badge";
import type { AnswerType, EntityOption } from "@/lib/game-types";
import { api } from "./api";

interface Props {
  answerType: AnswerType;
  disabled: boolean;
  onSubmit: (entity: EntityOption) => void;
}

const PLACEHOLDER: Record<AnswerType, string> = {
  club: "Search clubs…",
  player: "Search players…",
  nation: "Search nations…",
};

/** Accessible combobox over ALL entities of the answer type (server-side fuzzy search). */
export function GuessInput({ answerType, disabled, onSubmit }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EntityOption | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected && query === selected.name) return;
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<EntityOption[]>(`/api/entities/search?type=${answerType}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => {
          setOptions(res);
          setActive(0);
          setOpen(true);
          setSearchError(null);
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setSearchError(e.message);
        });
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, answerType, selected]);

  // Short queries show nothing (derived, so no state reset is needed).
  const visible = query.trim().length >= 2 ? options : [];

  function choose(o: EntityOption) {
    setSelected(o);
    setQuery(o.name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visible.length === 0) {
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        onSubmit(selected);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + visible.length) % visible.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(visible[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) onSubmit(selected);
      }}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
          aria-label="Your guess"
          placeholder={PLACEHOLDER[answerType]}
          value={query}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => visible.length > 0 && !selected && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base shadow-sm outline-none focus:border-fairway-600 focus:ring-2 focus:ring-fairway-200 disabled:bg-zinc-100"
        />
        {open && query.trim().length >= 2 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {visible.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No matches</li>}
            {visible.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${i === active ? "bg-fairway-50" : ""}`}
              >
                <EntityBadge name={o.name} size={24} />
                <span className="flex-1">
                  {o.name}
                  {o.disambiguation && <span className="text-zinc-500"> ({o.disambiguation})</span>}
                </span>
                {o.country && <span className="text-xs text-zinc-400">{o.country}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {searchError && <p className="text-sm text-red-600">{searchError}</p>}
      <button
        type="submit"
        disabled={disabled || !selected}
        className="w-full rounded-lg bg-flag px-4 py-3 font-card text-lg font-semibold uppercase tracking-wider text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
      >
        {disabled ? "Scoring…" : "Take the shot"}
      </button>
    </form>
  );
}
