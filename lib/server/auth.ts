import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { HttpError } from "./http";

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
}

/** The caller's verified user (anonymous users included), or a 401. */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Not signed in.");
  return { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false };
}

export interface AdminContext {
  user: SessionUser & { email: string | null };
  /** Client acting as the admin: RLS and the admin RPCs' is_admin checks still apply. */
  db: Awaited<ReturnType<typeof createUserClient>>;
}

/** A signed-in (non-anonymous) admin, or 401/403. */
export async function requireAdmin(): Promise<AdminContext> {
  const db = await createUserClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new HttpError(401, "Sign in with your admin email.");
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("is_admin")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile?.is_admin) throw new HttpError(403, "This account is not an admin.");
  return { user: { id: data.user.id, isAnonymous: false, email: data.user.email ?? null }, db };
}
