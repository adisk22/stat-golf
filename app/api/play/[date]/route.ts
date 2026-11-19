import { dateParam } from "@/lib/schemas";
import { requireUser } from "@/lib/server/auth";
import { loadPlayState, resolvePuzzleDate } from "@/lib/server/game";
import { handle, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, ctx: RouteContext<"/api/play/[date]">) {
  return handle(async () => {
    const parsed = dateParam.safeParse((await ctx.params).date);
    if (!parsed.success) throw new HttpError(400, "Invalid date.");
    const user = await requireUser();
    const db = createAdminClient();
    await rateLimit(db, "state", user.id);
    return loadPlayState(db, user.id, resolvePuzzleDate(parsed.data));
  });
}
