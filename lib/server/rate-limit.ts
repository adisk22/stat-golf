import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "./http";

type Admin = ReturnType<typeof createAdminClient>;

export const LIMITS = {
  guess: { limit: 20, windowSeconds: 60 },
  search: { limit: 90, windowSeconds: 60 },
  state: { limit: 120, windowSeconds: 60 },
} as const;

/** Fixed-window limiter backed by Postgres (works across serverless instances). */
export async function rateLimit(db: Admin, bucket: keyof typeof LIMITS, subject: string) {
  const { limit, windowSeconds } = LIMITS[bucket];
  const { data, error } = await db.rpc("server_check_rate_limit", {
    p_key: `${bucket}:${subject}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new HttpError(429, "Too many requests. Slow down a little.");
}
