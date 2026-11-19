import { connection } from "next/server";
import type { EntityOption } from "@/lib/game-types";
import { searchQuery } from "@/lib/schemas";
import { requireUser } from "@/lib/server/auth";
import { handle, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Searches ALL entities of a type, never just a question's ranking (no answer leaks). */
export async function GET(req: Request) {
  await connection(); // always run at request time, never prerender
  return handle(async (): Promise<EntityOption[]> => {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = searchQuery.safeParse(params);
    if (!parsed.success) throw new HttpError(400, "Invalid search.");
    const user = await requireUser();
    const db = createAdminClient();
    await rateLimit(db, "search", user.id);
    const { data, error } = await db.rpc("search_entities", {
      p_type: parsed.data.type,
      p_query: parsed.data.q,
      p_limit: parsed.data.limit,
    });
    if (error) throw error;
    return data.map(({ id, name, disambiguation, country }) => ({ id, name, disambiguation, country }));
  });
}
