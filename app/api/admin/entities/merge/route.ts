import { mergeInput } from "@/lib/schemas";
import { mergeEntities } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin();
    const { keepId, removeId } = await readJson(req, mergeInput);
    await mergeEntities(db, keepId, removeId);
    return { ok: true };
  });
}
