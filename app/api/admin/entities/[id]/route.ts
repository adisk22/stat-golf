import { entityPatch } from "@/lib/schemas";
import { updateEntity } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { uuidParam } from "@/lib/server/params";

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/entities/[id]">) {
  return handle(async () => {
    const { db } = await requireAdmin();
    await updateEntity(db, uuidParam((await ctx.params).id), await readJson(req, entityPatch));
    return { ok: true };
  });
}
