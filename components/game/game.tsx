"use client";
import { useCallback, useEffect, useState } from "react";
import { MAX_STROKES_PER_HOLE } from "@/lib/config";
import { shotLanding } from "@/lib/golf-terms";
import type { CurrentHole, EntityOption, PlayState, PlayedHole } from "@/lib/game-types";
import { api } from "./api";
import { EndScreen } from "./end-screen";
import { GuessInput } from "./guess-input";
import { HoleHeading } from "./hole-heading";
import { HoleReveal } from "./reveal-table";
import { Scorecard } from "./scorecard";
import { ShotScene } from "./shot-scene";
import { Turnstile } from "./turnstile";
import { useSession } from "./use-session";

export function Game({ date = "today" }: { date?: string }) {
  const session = useSession();
  const [state, setState] = useState<PlayState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  /** Played hole on screen: just hit (animate the shot) or picked from the scorecard (show the result). */
  const [viewing, setViewing] = useState<{ hole: number; animate: boolean } | null>(null);
  const [shotDone, setShotDone] = useState(false);

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
      setShotDone(false);
      setViewing({ hole: hole.holeNumber, animate: true });
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
  if (!state) return <Shell><p className="py-16 text-center font-card uppercase tracking-[0.25em] text-fairway-800/70">Walking to the first tee…</p></Shell>;

  const current = state.holes.find((h): h is CurrentHole => h.status === "current");
  const viewed = state.holes.find((h): h is PlayedHole => h.status === "played" && h.holeNumber === viewing?.hole);
  const revealed = shotDone || viewing?.animate === false;

  return (
    <Shell>
      <Scorecard
        puzzleNumber={state.puzzleNumber}
        date={state.date}
        isArchive={state.isArchive}
        holes={state.holes}
        strokesSoFar={state.strokesSoFar}
        parSoFar={state.parSoFar}
        selected={viewed?.holeNumber ?? null}
        current={current?.holeNumber ?? null}
        onSelect={(n) => setViewing(viewing?.hole === n ? null : { hole: n, animate: false })}
      />

      {viewed ? (
        <Card key={`played-${viewed.holeNumber}`}>
          <HoleHeading hole={viewed} />
          <ShotScene
            targetRank={viewed.targetRank}
            landing={shotLanding(viewed.guess.actualRank, viewed.targetRank, viewed.guess.strokes, MAX_STROKES_PER_HOLE)}
            animate={viewing?.animate ?? false}
            onDone={() => setShotDone(true)}
          />
          {revealed ? (
            <>
              <HoleReveal hole={viewed} />
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="w-full animate-rise-in rounded-lg bg-fairway-800 px-4 py-3 font-card text-lg font-semibold uppercase tracking-wider text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)] hover:bg-fairway-700"
              >
                {current ? `Tee off on hole ${current.holeNumber} →` : "See your round →"}
              </button>
            </>
          ) : (
            <p className="text-center text-xs text-zinc-400">Tap the course to skip</p>
          )}
        </Card>
      ) : current ? (
        <Card key={`current-${current.holeNumber}`}>
          <HoleHeading hole={current} />
          <ShotScene targetRank={current.targetRank} landing={null} animate={false} waiting={submitting} />
          <GuessInput answerType={current.answerType} disabled={submitting} onSubmit={(e) => submit(e, current)} />
          {guessError && <p className="text-sm text-red-600" role="alert">{guessError}</p>}
          <p className="text-center font-card text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Max {MAX_STROKES_PER_HOLE} strokes per hole · not in the list = lost ball
          </p>
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
  return (
    <section className="animate-rise-in space-y-4 rounded-xl border-t-4 border-fairway-700 bg-white/95 p-4 shadow-[0_12px_30px_-14px_rgb(21_58_34/0.45)] sm:p-6">
      {children}
    </section>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700" role="alert">
      {message}
    </div>
  );
}
