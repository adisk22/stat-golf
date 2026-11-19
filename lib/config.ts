/**
 * Game-wide configuration. Everything a designer might want to tweak lives here.
 * Values are plain constants (not env vars) so the client and server always agree.
 */
export const GAME_NAME = "Stat Golf";

/** Only football at launch; the column exists so other sports can be added later. */
export const DEFAULT_SPORT = "football";

/** Strokes for an off-list guess, and the per-hole cap. */
export const MAX_STROKES_PER_HOLE = 15;

/** Default par per hole (admin can override per hole). */
export const DEFAULT_PAR = 3;

/** Holes per day. */
export const MIN_HOLES_PER_DAY = 3;
export const MAX_HOLES_PER_DAY = 5;

/** IANA timezone whose midnight starts a new puzzle day. Also defines a "day" for streaks. */
export const ROLLOVER_TIMEZONE = "UTC";

/** Puzzle #1 is played on this date (YYYY-MM-DD, in ROLLOVER_TIMEZONE). */
export const EPOCH_DATE = "2026-01-01";

/** Rows shown either side of the target when revealing a hole. */
export const REVEAL_WINDOW = 5;

/** Warn in the scheduler if a question was used within this many days. */
export const QUESTION_REUSE_WARNING_DAYS = 60;

/** Warn in the scheduler if any date in the next N days has no puzzle. */
export const EMPTY_DAYS_LOOKAHEAD = 7;

/** Leaderboard: minimum games to appear on the all-time average board. */
export const LEADERBOARD_MIN_GAMES = 7;
