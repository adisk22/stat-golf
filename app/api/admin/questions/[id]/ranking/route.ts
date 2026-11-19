import { rankingInput } from "@/lib/schemas";
import { getQuestion, saveRanking } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { uuidParam } from "@/lib/server/params";

/** Replaces the ranking with reviewed rows (creating any new entities first). */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/questions/[id]/ranking">) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const id = uuidParam((await ctx.params).id);
    const { rows } = await readJson(req, rankingInput);
    const result = await saveRanking(db, id, rows);
    return { ...result, question: await getQuestion(db, id) };
  });
}
