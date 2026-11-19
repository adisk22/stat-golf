import { connection } from "next/server";
import { entityInput, entitySearch } from "@/lib/schemas";
import { createEntity, searchEntities } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, HttpError, readJson } from "@/lib/server/http";

export async function GET(req: Request) {
  await connection();
  return handle(async () => {
    const { db } = await requireAdmin();
    const parsed = entitySearch.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) throw new HttpError(400, "Invalid search.");
    return searchEntities(db, parsed.data.type, parsed.data.q);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin();
    return createEntity(db, await readJson(req, entityInput));
  });
}
