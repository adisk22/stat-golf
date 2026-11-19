import { dateParam, guessBody } from "@/lib/schemas";
import { requireUser } from "@/lib/server/auth";
import { resolvePuzzleDate, submitGuess } from "@/lib/server/game";
import { handle, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request, ctx: RouteContext<"/api/play/[date]/guess">) {
  return handle(async () => {
    const date = dateParam.safeParse((await ctx.params).date);
    if (!date.success) throw new HttpError(400, "Invalid date.");
    const body = guessBody.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Invalid guess.");
    const user = await requireUser();
    const db = createAdminClient();
    await rateLimit(db, "guess", user.id);
    return submitGuess(db, user.id, resolvePuzzleDate(date.data), body.data.holeNumber, body.data.entityId);
  });
}
