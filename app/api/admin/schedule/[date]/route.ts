import { connection } from "next/server";
import { puzzleInput } from "@/lib/schemas";
import { puzzleEditor, savePuzzle } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";
import { dateParam } from "@/lib/server/params";

type Ctx = RouteContext<"/api/admin/schedule/[date]">;

export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  return handle(async () => puzzleEditor((await requireAdmin()).db, dateParam((await ctx.params).date)));
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const { holes } = await readJson(req, puzzleInput);
    return savePuzzle(db, dateParam((await ctx.params).date), holes);
  });
}
