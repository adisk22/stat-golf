import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

interface LocalEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
}

let cached: LocalEnv | undefined;

/** Reads keys from env, falling back to the local Supabase CLI stack. */
export function localEnv(): LocalEnv {
  if (cached) return cached;
  const fromEnv = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    dbUrl: process.env.SUPABASE_DB_URL,
  };
  if (fromEnv.url && fromEnv.anonKey && fromEnv.serviceRoleKey) {
    cached = { ...fromEnv, dbUrl: fromEnv.dbUrl ?? "" } as LocalEnv;
    return cached;
  }
  const status = JSON.parse(
    execSync("pnpm exec supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  ) as Record<string, string>;
  cached = {
    url: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    dbUrl: status.DB_URL,
  };
  return cached;
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): Client {
  const env = localEnv();
  return createClient<Database>(env.url, env.serviceRoleKey, noPersist);
}

export async function anonymousUser(): Promise<{ client: Client; userId: string }> {
  const env = localEnv();
  const client = createClient<Database>(env.url, env.anonKey, noPersist);
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("anonymous sign-in failed");
  return { client, userId: data.user.id };
}

/** UTC date string offset from today (seed uses current_date in UTC). */
export function dayOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Unwraps a Supabase response, throwing on error or a null result. */
export async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data === null || data === undefined) throw new Error("Expected data, got null");
  return data;
}

/** Awaits a Supabase write that returns no rows, throwing on error. */
export async function ok(p: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await p;
  if (error) throw error;
}
