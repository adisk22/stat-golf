import { connection } from "next/server";
import { questionPatch } from "@/lib/schemas";
import { deleteQuestion, getQuestion, updateQuestion } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { uuidParam } from "@/lib/server/params";

type Ctx = RouteContext<"/api/admin/questions/[id]">;

export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  return handle(async () => getQuestion((await requireAdmin()).db, uuidParam((await ctx.params).id)));
}

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const id = uuidParam((await ctx.params).id);
    await updateQuestion(db, id, await readJson(req, questionPatch));
    return getQuestion(db, id);
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    await deleteQuestion((await requireAdmin()).db, uuidParam((await ctx.params).id));
    return { ok: true };
  });
}
