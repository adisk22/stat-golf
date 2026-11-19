import { publishInput } from "@/lib/schemas";
import { setPublished } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { dateParam } from "@/lib/server/params";

export async function POST(req: Request, ctx: RouteContext<"/api/admin/schedule/[date]/publish">) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const { published } = await readJson(req, publishInput);
    return setPublished(db, dateParam((await ctx.params).date), published);
  });
}
