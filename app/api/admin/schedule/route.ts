import { connection } from "next/server";
import { scheduleRange } from "@/lib/schemas";
import { scheduleOverview } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, HttpError } from "@/lib/server/http";

export async function GET(req: Request) {
  await connection();
  return handle(async () => {
    const { db } = await requireAdmin();
    const range = scheduleRange.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!range.success) throw new HttpError(400, "Pass from and to as YYYY-MM-DD.");
    return scheduleOverview(db, range.data.from, range.data.to);
  });
}
