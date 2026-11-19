import { matchInput } from "@/lib/schemas";
import { matchCsv } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { uuidParam } from "@/lib/server/params";

/** Parses + validates the CSV and matches each name to an entity (exact → alias → fuzzy). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/questions/[id]/match">) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const { csv } = await readJson(req, matchInput);
    return matchCsv(db, uuidParam((await ctx.params).id), csv);
  });
}
