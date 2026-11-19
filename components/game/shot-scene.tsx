"use client";
import { useEffect, useRef, useState } from "react";
import type { Landing } from "@/lib/golf-terms";
import { ordinal } from "./format";

/**
 * Side-on mini course. Before a guess the ball sits on the tee; after one it flies and
 * lands at a distance from the cup that reflects the strokes:
 *   exact → drops in the cup · better rank than target → short · worse → long · off-list → water.
 */

const W = 640;
const H = 220;
const GROUND = 168;
const TEE_X = 54;
const HOLE_X = 500;
const WATER = { x1: 118, x2: 186 };
const BALL_R = 5;

const FLIGHT_MS = 1150;
const ROLL_MS = 650;
const DROP_MS = 300;

interface Props {
  targetRank: number;
  /** null = ball still on the tee. */
  landing: Landing | null;
  /** Play the shot (false = show the final position immediately). */
  animate: boolean;
  /** Ball wobbles on the tee while a guess is being scored. */
  waiting?: boolean;
  caption?: string;
  onDone?: () => void;
}

function restX(l: Landing): number {
  switch (l.kind) {
    case "hole":
      return HOLE_X;
    case "water":
      return (WATER.x1 + WATER.x2) / 2;
    case "short":
      return HOLE_X - (22 + 230 * Math.sqrt(l.fraction));
    case "long":
      return HOLE_X + (22 + 108 * Math.sqrt(l.fraction));
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 2;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function ballAt(l: Landing, ms: number): { x: number; y: number; visible: boolean; inAir: boolean } {
  const final = restX(l);
  const rolls = l.kind !== "water";
  const roll = rolls ? Math.min(34, Math.abs(final - TEE_X) * 0.12) : 0;
  const touch = final - roll; // first bounce point, then roll forward to rest
  const peak = 70 + 60 * clamp01((touch - TEE_X) / (HOLE_X - TEE_X));

  if (ms <= FLIGHT_MS) {
    const t = ms / FLIGHT_MS;
    return { x: TEE_X + (touch - TEE_X) * t, y: GROUND - BALL_R - peak * 4 * t * (1 - t), visible: true, inAir: true };
  }
  if (!rolls) {
    // Splash: the ball sinks below the surface.
    const t = clamp01((ms - FLIGHT_MS) / 400);
    return { x: touch, y: GROUND - BALL_R + 10 * t, visible: t < 1, inAir: false };
  }
  const rt = clamp01((ms - FLIGHT_MS) / ROLL_MS);
  const x = touch + roll * easeOut(rt);
  const bounce = Math.abs(Math.sin(rt * Math.PI * 2)) * 10 * (1 - rt) ** 2;
  if (l.kind === "hole" && ms > FLIGHT_MS + ROLL_MS) {
    const dt = clamp01((ms - FLIGHT_MS - ROLL_MS) / DROP_MS);
    return { x: HOLE_X, y: GROUND - BALL_R + 14 * dt, visible: dt < 1, inAir: false };
  }
  return { x, y: GROUND - BALL_R - bounce, visible: true, inAir: false };
}

function totalMs(l: Landing) {
  return FLIGHT_MS + (l.kind === "water" ? 450 : ROLL_MS) + (l.kind === "hole" ? DROP_MS : 0);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function ShotScene({ targetRank, landing, animate, waiting, caption, onDone }: Props) {
  const [ms, setMs] = useState(() => (landing && !animate ? Number.POSITIVE_INFINITY : 0));
  const done = useRef(false);
  const doneCb = useRef(onDone);
  useEffect(() => {
    doneCb.current = onDone;
  }, [onDone]);

  // Depend on the landing's value, not object identity (callers rebuild it each render).
  const landingKey = landing ? JSON.stringify(landing) : null;
  useEffect(() => {
    if (!landingKey) return;
    const l = JSON.parse(landingKey) as Landing;
    done.current = false;
    const end = totalMs(l);
    const finish = () => {
      setMs(Number.POSITIVE_INFINITY);
      if (!done.current) {
        done.current = true;
        doneCb.current?.();
      }
    };
    if (!animate || prefersReducedMotion()) {
      const id = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= end) return finish();
      setMs(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landingKey, animate]);

  const finished = landing !== null && ms === Number.POSITIVE_INFINITY;
  const t = landing ? (finished ? totalMs(landing) : ms) : 0;
  const ball = landing ? ballAt(landing, t) : { x: TEE_X, y: GROUND - 9 - BALL_R, visible: true, inAir: false };
  const settledX = landing ? restX(landing) : TEE_X;
  const sinceLanding = landing ? t - FLIGHT_MS : -1;
  const flagWave = landing?.kind === "hole" && finished;

  return (
    <figure
      className="relative overflow-hidden rounded-xl border border-fairway-800/20 shadow-inner"
      onClick={() => landing && !finished && setMs(Number.POSITIVE_INFINITY)}
      aria-label={caption ?? `Hole with the flag at ${ordinal(targetRank)}`}
      role="img"
      data-testid="shot-scene"
      data-finished={finished || undefined}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe3f2" />
            <stop offset="1" stopColor="#eef8f0" />
          </linearGradient>
          <pattern id="mow" width="48" height="60" patternUnits="userSpaceOnUse">
            <rect width="24" height="60" fill="#5aa35f" />
            <rect x="24" width="24" height="60" fill="#4f9855" />
          </pattern>
          <pattern id="greenMow" width="20" height="60" patternUnits="userSpaceOnUse">
            <rect width="10" height="60" fill="#79c27a" />
            <rect x="10" width="10" height="60" fill="#70ba72" />
          </pattern>
        </defs>

        <rect width={W} height={H} fill="url(#sky)" />
        {/* distant hills and trees */}
        <path d={`M0 ${GROUND - 30} Q 120 ${GROUND - 70} 260 ${GROUND - 34} T 640 ${GROUND - 44} V ${GROUND} H0Z`} fill="#a7d3a3" />
        {[30, 70, 250, 290, 590, 620].map((x, i) => (
          <g key={x} transform={`translate(${x} ${GROUND - 34 - (i % 2) * 6})`}>
            <rect x="-2" y="10" width="4" height="16" fill="#6b4f35" />
            <circle r="14" fill={i % 2 ? "#3f8a4a" : "#367b41"} />
          </g>
        ))}

        {/* fairway, water, green, bunker */}
        <rect y={GROUND} width={W} height={H - GROUND} fill="url(#mow)" />
        <rect x={WATER.x1} y={GROUND - 1} width={WATER.x2 - WATER.x1} height="14" rx="6" fill="#3d8fc9" />
        <rect x={WATER.x1 + 6} y={GROUND + 2} width="18" height="2" rx="1" fill="#9fd0f0" opacity="0.8" />
        <rect x={HOLE_X - 82} y={GROUND} width="164" height="12" rx="6" fill="url(#greenMow)" />
        <ellipse cx={HOLE_X + 116} cy={GROUND + 4} rx="22" ry="5" fill="#ecd9a2" />

        {/* tee */}
        <rect x={TEE_X - 1.5} y={GROUND - 9} width="3" height="10" fill="#f4f1ea" stroke="#c9c2b4" strokeWidth="0.5" />

        {/* cup + flag */}
        <ellipse cx={HOLE_X} cy={GROUND + 1} rx="8" ry="2.6" fill="#1d2a1f" />
        <line x1={HOLE_X} y1={GROUND} x2={HOLE_X} y2={GROUND - 78} stroke="#f4f1ea" strokeWidth="2.2" />
        <g className={flagWave ? "animate-flag-wave" : undefined} style={{ transformOrigin: `${HOLE_X}px ${GROUND - 78}px` }}>
          <path d={`M${HOLE_X} ${GROUND - 78} L${HOLE_X + 46} ${GROUND - 68} L${HOLE_X} ${GROUND - 56} Z`} fill="#d9363e" />
          <text x={HOLE_X + 6} y={GROUND - 64} fontSize="10" fontWeight="700" fill="#fff" fontFamily="var(--font-card), sans-serif">
            {ordinal(targetRank)}
          </text>
        </g>

        {/* distance marker once the ball has stopped */}
        {finished && landing && landing.kind !== "hole" && landing.kind !== "water" && (
          <g className="animate-fade-in">
            <line
              x1={Math.min(settledX, HOLE_X)}
              x2={Math.max(settledX, HOLE_X)}
              y1={GROUND + 18}
              y2={GROUND + 18}
              stroke="#fff"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </g>
        )}

        {/* splash rings */}
        {landing?.kind === "water" && sinceLanding > 0 &&
          [0, 140, 280].map((delay) => {
            const p = clamp01((sinceLanding - delay) / 500);
            return p > 0 && p < 1 ? (
              <ellipse key={delay} cx={(WATER.x1 + WATER.x2) / 2} cy={GROUND + 1} rx={4 + 26 * p} ry={1.5 + 5 * p} fill="none" stroke="#e6f4ff" strokeWidth={2 * (1 - p)} />
            ) : null;
          })}

        {/* confetti for a hole in one */}
        {landing?.kind === "hole" && sinceLanding > ROLL_MS &&
          Array.from({ length: 18 }, (_, i) => {
            const p = clamp01((sinceLanding - ROLL_MS) / 900);
            const angle = (-Math.PI / 2) + ((i / 17) - 0.5) * 2.4;
            const dist = 30 + (i % 4) * 14;
            const x = HOLE_X + Math.cos(angle) * dist * p;
            const y = GROUND - 6 + Math.sin(angle) * dist * p + 40 * p * p;
            const colors = ["#f6c945", "#d9363e", "#2e7d43", "#3d8fc9", "#fff"];
            return (
              <rect key={i} x={x} y={y} width="4" height="7" rx="1" fill={colors[i % colors.length]} transform={`rotate(${i * 37 + p * 360} ${x + 2} ${y + 3})`} opacity={1 - p * 0.6} />
            );
          })}

        {/* ball shadow + ball */}
        {ball.visible && (
          <>
            {ball.inAir && <ellipse cx={ball.x} cy={GROUND + 1} rx="4" ry="1.4" fill="#000" opacity="0.18" />}
            <g className={waiting && !landing ? "animate-ball-wobble" : undefined} style={{ transformOrigin: `${ball.x}px ${ball.y + BALL_R}px` }}>
              <circle cx={ball.x} cy={ball.y} r={BALL_R} fill="#fff" stroke="#c8ccd0" strokeWidth="0.8" />
              <circle cx={ball.x - 1.5} cy={ball.y - 1.5} r="1.3" fill="#e8ebee" />
            </g>
          </>
        )}
      </svg>
      {caption && (
        <figcaption className="pointer-events-none absolute inset-x-0 top-2 text-center font-card text-sm font-semibold uppercase tracking-[0.2em] text-fairway-800/80">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
