"use client";
import { useCallback, useEffect, useState } from "react";
import { MAX_STROKES_PER_HOLE } from "@/lib/config";
import { formatPuzzleDate } from "@/lib/dates";
import type { CurrentHole, EntityOption, PlayState, PlayedHole } from "@/lib/game-types";
import { api } from "./api";
import { EndScreen } from "./end-screen";
import { GuessInput } from "./guess-input";
import { HoleHeading } from "./hole-heading";
import { HoleReveal } from "./reveal-table";
import { Scorecard } from "./scorecard";
import { Turnstile } from "./turnstile";
import { useSession } from "./use-session";

export function Game({ date = "today" }: { date?: string }) {
  const session = useSession();
  const [state, setState] = useState<PlayState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  /** Hole whose reveal is shown (just played, or picked from the scorecard). */
  const [viewing, setViewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await api<PlayState>(`/api/play/${date}`));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [date]);

  useEffect(() => {
    if (session.status !== "ready") return;
    let cancelled = false;
    api<PlayState>(`/api/play/${date}`)
      .then((s) => !cancelled && (setState(s), setLoadError(null)))
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [session.status, date]);

  async function submit(entity: EntityOption, hole: CurrentHole) {
    setSubmitting(true);
    setGuessError(null);
    try {
      const next = await api<PlayState>(`/api/play/${date}/guess`, {
        method: "POST",
        body: JSON.stringify({ holeNumber: hole.holeNumber, entityId: entity.id }),
      });
      setState(next);
      setViewing(hole.holeNumber);
    } catch (e) {
      setGuessError((e as Error).message);
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  if (session.status === "needs-captcha" && session.siteKey) {
    return (
      <Shell>
        <p className="text-center text-sm text-zinc-600">Checking you&apos;re human…</p>
        <Turnstile siteKey={session.siteKey} onToken={session.onCaptchaToken} onError={session.onCaptchaError} />
      </Shell>
    );
  }
  if (session.status === "error") return <Shell><ErrorBox message={session.error ?? "Sign-in failed."} /></Shell>;
  if (loadError) return <Shell><ErrorBox message={loadError} /></Shell>;
  if (!state) return <Shell><p className="py-16 text-center text-zinc-500">Loading today&apos;s course…</p></Shell>;

  const current = state.holes.find((h): h is CurrentHole => h.status === "current");
  const viewed = state.holes.find((h): h is PlayedHole => h.status === "played" && h.holeNumber === viewing);

  return (
    <Shell>
      <header className="flex items-baseline justify-between">
        <p className="text-sm text-zinc-500">
          #{state.puzzleNumber} · {formatPuzzleDate(state.date)}
          {state.isArchive && <span className="ml-2 rounded bg-zinc-200 px-1.5 text-xs">Archive</span>}
        </p>
        <p className="text-xs text-zinc-500">Max {MAX_STROKES_PER_HOLE} per hole</p>
      </header>

      <Scorecard
        holes={state.holes}
        strokesSoFar={state.strokesSoFar}
        parSoFar={state.parSoFar}
        selected={viewed?.holeNumber ?? null}
        onSelect={(n) => setViewing(viewing === n ? null : n)}
      />

      {viewed ? (
        <Card>
          <HoleHeading hole={viewed} />
          <HoleReveal hole={viewed} />
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="w-full rounded-lg bg-fairway-700 px-4 py-3 font-semibold text-white hover:bg-fairway-800"
          >
            {current ? `Tee off on hole ${current.holeNumber} →` : "See your round →"}
          </button>
        </Card>
      ) : current ? (
        <Card key={current.holeNumber}>
          <HoleHeading hole={current} />
          <GuessInput answerType={current.answerType} disabled={submitting} onSubmit={(e) => submit(e, current)} />
          {guessError && <p className="text-sm text-red-600" role="alert">{guessError}</p>}
        </Card>
      ) : (
        <EndScreen state={state} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">{children}</section>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700" role="alert">
      {message}
    </div>
  );
}
