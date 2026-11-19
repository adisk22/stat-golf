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
